# RFC-001: DSP Engine — Component Specifications

Companion to [rfc-001-dsp-engine.md](rfc-001-01-dsp-engine.md). Contains detailed algorithms, structs, and
implementation guidance for each DSP component.

---

## 1. SVF Filter (Cytomic)

### What It Does

Removes or emphasizes frequencies in the audio signal. The single most important component for the perceived "sound" of
the synth. A lowpass filter at 2kHz removes everything above 2kHz, making the sound darker/warmer.

### Why This Algorithm

Andrew Simper (Cytomic) published the **linear trapezoidal integrated SVF** — the same topology used by u-he Diva,
Bitwig, Vital. It is:

- **Stable** at all cutoff frequencies and resonance values (many filter designs blow up at extreme settings)
- **Self-oscillating** cleanly at high Q (produces a pure sine tone — desirable for acid bass sounds)
- **Multi-mode** from a single computation (LP, HP, BP, Notch, Peak, AllPass — just change mix coefficients)
- **Cheap** — 5 multiplies + 5 additions per sample

**Reference paper**: https://cytomic.com/files/dsp/SvfLinearTrapOptimised2.pdf

### Structs

```rust
/// Per-voice filter state. Stored in Entry Store (2 i32 slots, bit-cast from f32).
pub struct SvfState {
    ic1eq: f32,  // first integrator state
    ic2eq: f32,  // second integrator state
}

/// Pre-computed coefficients. Recalculated when cutoff or Q changes.
/// Stored in node attrs (MEM plane) for instant modulation.
pub struct SvfCoeffs {
    a1: f32,
    a2: f32,
    a3: f32,
    m0: f32,  // mix coefficient — selects filter mode
    m1: f32,
    m2: f32,
}
```

### Algorithm

**Coefficient calculation** (called when cutoff or Q changes):

```rust
fn compute_coeffs(cutoff_hz: f32, q: f32, sample_rate: f32, mode: FilterMode) -> SvfCoeffs {
    let g = (std::f32::consts::PI * cutoff_hz / sample_rate).tan();
    let k = 1.0 / q;  // damping factor
    let a1 = 1.0 / (1.0 + g * (g + k));
    let a2 = g * a1;
    let a3 = g * a2;
    let (m0, m1, m2) = match mode {
        FilterMode::Lowpass => (0.0, 0.0, 1.0),
        FilterMode::Highpass => (1.0, -k, -1.0),
        FilterMode::Bandpass => (0.0, 1.0, 0.0),
        FilterMode::Notch => (1.0, -k, 0.0),
        FilterMode::Peak => (1.0, -k, -2.0),
        FilterMode::Allpass => (1.0, -2.0 * k, 0.0),
    };
    SvfCoeffs { a1, a2, a3, m0, m1, m2 }
}
```

**Per-sample processing** (called 44,100+ times per second per voice):

```rust
#[inline(always)]
fn tick(state: &mut SvfState, input: f32, c: &SvfCoeffs) -> f32 {
    let v3 = input - state.ic2eq;
    let v1 = c.a1 * state.ic1eq + c.a2 * v3;
    let v2 = state.ic2eq + c.a2 * state.ic1eq + c.a3 * v3;
    state.ic1eq = 2.0 * v1 - state.ic1eq;
    state.ic2eq = 2.0 * v2 - state.ic2eq;
    c.m0 * input + c.m1 * v1 + c.m2 * v2
}
```

### Verification

Generate a sine sweep (20Hz–20kHz) through the filter. FFT the output. Compare the magnitude response curve to the
expected transfer function:

- LP at 1kHz cutoff: -3dB at 1kHz, -12dB/octave rolloff above
- HP at 1kHz cutoff: -3dB at 1kHz, -12dB/octave rolloff below
- BP: peak at cutoff, rolloff both sides

---

## 2. Wavetable Oscillator

### What It Does

Reads through a table of pre-computed waveform samples to generate sound. The wavetable contains multiple "frames" —
scanning through frames morphs the timbre in real-time.

### Algorithm: Mip-Mapped Wavetable with Bilinear Interpolation

**Load-time (offline):**

1. For each waveform frame (e.g., 2048 samples per frame):
2. FFT the frame → frequency domain
3. For mip level L: zero out all harmonics above `2^(max_level - L)`
4. IFFT back → time domain
5. Store as `mip_levels[L][frame][sample]`

This gives you progressively "smoother" versions of each waveform. At high pitches, the oscillator uses smoother
versions, preventing aliasing.

**Runtime (per sample):**

1. Calculate which mip level to use: `max_harmonics = nyquist / frequency`, then
   `level = log2(total_harmonics / max_harmonics)`
2. Bilinear interpolation between: (a) adjacent samples within a frame, and (b) adjacent frames for wavetable position
   morphing
3. Advance phase: `phase += frequency / sample_rate`

```rust
pub struct Wavetable {
    /// mip_levels[level][frame_index][sample_index]
    mip_levels: Vec<Vec<Vec<f32>>>,
    samples_per_frame: usize,  // typically 2048
    num_frames: usize,         // e.g. 256 frames for a rich evolving wavetable
    num_mip_levels: usize,     // log2(samples_per_frame) + 1
}

/// Per-voice oscillator state. Stored in Entry Store.
pub struct WavetableOscState {
    phase: f32,       // 0.0..1.0, current position within one cycle
    frame_pos: f32,   // 0.0..num_frames, wavetable scan position (modulatable)
}

impl Wavetable {
    /// Read with bilinear interpolation (between samples + between frames).
    #[inline]
    fn read_bilinear(&self, level: usize, frame_pos: f32, phase: f32) -> f32 {
        let frame_a = frame_pos.floor() as usize;
        let frame_b = (frame_a + 1).min(self.num_frames - 1);
        let frame_frac = frame_pos - frame_pos.floor();

        let sample_pos = phase * self.samples_per_frame as f32;
        let idx_a = sample_pos.floor() as usize;
        let idx_b = (idx_a + 1) % self.samples_per_frame;
        let sample_frac = sample_pos - sample_pos.floor();

        let s00 = self.mip_levels[level][frame_a][idx_a];
        let s01 = self.mip_levels[level][frame_a][idx_b];
        let s10 = self.mip_levels[level][frame_b][idx_a];
        let s11 = self.mip_levels[level][frame_b][idx_b];

        let top = s00 + sample_frac * (s01 - s00);
        let bot = s10 + sample_frac * (s11 - s10);
        top + frame_frac * (bot - top)
    }
}
```

### MIDI Note to Frequency

```rust
fn midi_to_hz(note: u8) -> f32 {
    440.0 * 2.0_f32.powf((note as f32 - 69.0) / 12.0)
}
// MIDI 69 = A4 = 440 Hz
// MIDI 60 = C4 = 261.63 Hz
```

---

## 3. ADSR Envelope

### What It Does

Controls how a parameter (usually volume or filter cutoff) changes over the lifetime of a note:

- **Attack**: 0 → 1 over configured time (key press → full level)
- **Decay**: 1 → sustain level over configured time
- **Sustain**: Hold at sustain level while key is held
- **Release**: sustain → 0 over configured time (after key release)

### Algorithm

Exponential curves sound more natural than linear (human hearing is logarithmic). Use
`target + (current - target) * decay_rate` per sample.

```rust
#[repr(u8)]
pub enum Stage { Idle = 0, Attack = 1, Decay = 2, Sustain = 3, Release = 4 }

pub struct EnvelopeState {
    stage: Stage,
    level: f32,
}

pub struct EnvelopeParams {
    attack_rate: f32,   // per-sample multiplier, pre-computed from time
    decay_rate: f32,
    sustain_level: f32, // 0.0..1.0
    release_rate: f32,
}

// Pre-computation: time (seconds) → per-sample rate
fn time_to_rate(time_seconds: f32, sample_rate: f32) -> f32 {
    if time_seconds <= 0.0 { return 0.0; }
    // Exponential: reaches ~99.3% of target in `time_seconds`
    (-1.0 / (time_seconds * sample_rate)).exp()
}

#[inline(always)]
fn tick(state: &mut EnvelopeState, params: &EnvelopeParams, gate: bool) -> f32 {
    match state.stage {
        Stage::Attack => {
            // Exponential approach to 1.0
            state.level = 1.0 + (state.level - 1.0) * params.attack_rate;
            if state.level >= 0.999 {
                state.level = 1.0;
                state.stage = Stage::Decay;
            }
        }
        Stage::Decay => {
            state.level = params.sustain_level
                + (state.level - params.sustain_level) * params.decay_rate;
            if (state.level - params.sustain_level).abs() < 0.001 {
                state.level = params.sustain_level;
                state.stage = Stage::Sustain;
            }
        }
        Stage::Sustain => {
            if !gate { state.stage = Stage::Release; }
        }
        Stage::Release => {
            state.level = state.level * params.release_rate;
            if state.level < 0.0001 {
                state.level = 0.0;
                state.stage = Stage::Idle;
            }
        }
        Stage::Idle => {}
    }
    state.level
}
```

---

## 4. Parameter Smoothing

### What It Does

When a parameter changes (e.g., user turns a knob, modulation changes filter cutoff), jumping instantly to the new value
causes an audible click. Smoothing interpolates gradually.

### Algorithm: One-Pole Lowpass

```rust
pub struct SmoothedParam {
    current: f32,
    target: f32,
    coeff: f32, // pre-computed: exp(-1.0 / (smooth_time_seconds * sample_rate))
}

impl SmoothedParam {
    pub fn new(initial: f32, smooth_time_ms: f32, sample_rate: f32) -> Self {
        Self {
            current: initial,
            target: initial,
            coeff: (-1000.0 / (smooth_time_ms * sample_rate)).exp(),
        }
    }

    #[inline(always)]
    pub fn tick(&mut self) -> f32 {
        self.current = self.target + (self.current - self.target) * self.coeff;
        self.current
    }

    pub fn set(&mut self, value: f32) { self.target = value; }
    pub fn snap(&mut self, value: f32) {
        self.current = value;
        self.target = value;
    }
}
```

Typical smooth time: 5-10ms for knobs, 1-2ms for modulation, 0ms for note-on triggers.

---

## 5. Delay Line

### What It Does

Stores audio samples in a circular buffer and reads them back with a configurable delay. Foundation for echo, chorus,
flanger, comb filter, and Karplus-Strong synthesis.

### Algorithm: Power-of-2 Circular Buffer + Cubic Hermite Interpolation

```rust
pub struct DelayLine {
    buffer: Vec<f32>,     // length is power of 2
    write_pos: usize,
    mask: usize,          // buffer.len() - 1, for fast wrapping via bitwise AND
}

impl DelayLine {
    pub fn new(max_delay_samples: usize) -> Self {
        let size = max_delay_samples.next_power_of_two();
        Self {
            buffer: vec![0.0; size],
            write_pos: 0,
            mask: size - 1,
        }
    }

    #[inline(always)]
    pub fn write(&mut self, sample: f32) {
        self.buffer[self.write_pos] = sample;
        self.write_pos = (self.write_pos + 1) & self.mask;
    }

    /// Read at integer delay (no interpolation)
    #[inline(always)]
    pub fn read(&self, delay: usize) -> f32 {
        self.buffer[(self.write_pos.wrapping_sub(delay)) & self.mask]
    }

    /// Read at fractional delay using cubic Hermite interpolation.
    /// Required for chorus/flanger where the delay time is modulated smoothly.
    #[inline(always)]
    pub fn read_cubic(&self, delay: f32) -> f32 {
        let d = delay.floor() as usize;
        let frac = delay - delay.floor();
        let y0 = self.read(d + 1); // one sample before
        let y1 = self.read(d);
        let y2 = self.read(d.wrapping_sub(1));
        let y3 = self.read(d.wrapping_sub(2));
        // Cubic Hermite coefficients
        let c0 = y1;
        let c1 = 0.5 * (y2 - y0);
        let c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
        let c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
        ((c3 * frac + c2) * frac + c1) * frac + c0
    }
}
```

Power-of-2 sizing enables `& mask` instead of `% length` — branchless, no division.

---

## 6. Effects

### 6.1 Chorus

Delay line with LFO-modulated read position. Creates a "thickening" effect by mixing the original signal with a slightly
detuned copy.

```
input ──┬──────────────────────────────► mix ──► output
        │                                 ↑
        └──► [DelayLine] ──► read_cubic ──┘
                  ↑
              delay = base_delay + lfo * depth
              (base: 7ms, depth: ±3ms, lfo: 0.5Hz sine)
```

### 6.2 Flanger

Same as chorus but shorter delay (0.1–5ms) and feedback. The short delay creates comb-filter resonances that sweep
through the spectrum.

```
input ──┬──────────────────────────────────► mix ──► output
        │                                     ↑
        └──► [DelayLine] ──► read_cubic ──┬───┘
                  ↑                       │
                  └───── feedback ◄───────┘
              delay = base_delay + lfo * depth
              (base: 1ms, depth: ±0.5ms, lfo: 0.3Hz, feedback: 0.7)
```

### 6.3 Distortion / Waveshaper

Apply a nonlinear function to each sample. Different functions produce different characters.

```rust
/// Soft symmetric clipping. Smooth, "warm" distortion.
fn tanh_drive(x: f32, drive: f32) -> f32 { (x * drive).tanh() / drive.tanh() }

/// Hard clipping. Harsh, aggressive.
fn hard_clip(x: f32, threshold: f32) -> f32 { x.clamp(-threshold, threshold) }

/// Asymmetric tube-like saturation. Even harmonics = "warm" character.
fn tube(x: f32, drive: f32) -> f32 {
    if x >= 0.0 { 1.0 - (-x * drive).exp() } else { -(1.0 - (x * drive).exp()) * 0.8 } // asymmetry factor
}
```

**Must apply 2x oversampling** around distortion to prevent aliasing from newly generated harmonics (see anti-aliasing
section in main RFC).

### 6.4 Freeverb (Algorithmic Reverb)

Published by Jezar (public domain). Uses 8 parallel comb filters feeding into 4 series allpass filters.

**Comb filter** = delay line with feedback + damping lowpass:

```rust
struct CombFilter {
    delay: DelayLine,
    feedback: f32,
    damp1: f32,  // damping coefficient
    damp2: f32,  // 1.0 - damp1
    filterstore: f32,
}

impl CombFilter {
    #[inline]
    fn tick(&mut self, input: f32) -> f32 {
        let output = self.delay.read(0); // read at fixed delay length
        self.filterstore = output * self.damp2 + self.filterstore * self.damp1;
        self.delay.write(input + self.filterstore * self.feedback);
        output
    }
}
```

**Allpass filter** = delay line with feedforward + feedback:

```rust
struct AllpassFilter {
    delay: DelayLine,
    feedback: f32, // typically 0.5
}

impl AllpassFilter {
    #[inline]
    fn tick(&mut self, input: f32) -> f32 {
        let delayed = self.delay.read(0);
        let output = -input + delayed;
        self.delay.write(input + delayed * self.feedback);
        output
    }
}
```

**Published delay lengths (Jezar, for 44.1kHz):**

- Comb filters: 1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617 samples
- Allpass filters: 556, 441, 341, 225 samples
- Scale these proportionally for other sample rates: `delay * (sample_rate / 44100.0)`

### 6.5 Convolution Reverb

Multiplies audio with a recorded impulse response (IR) in the frequency domain. Produces realistic room/hall/space
acoustics. The IR IS the sound — no tuning.

**Algorithm: Partitioned Overlap-Add**

```
                    IR (split into segments)
                    ┌───────┬───────┬───────┬───────┐
                    │ seg 0 │ seg 1 │ seg 2 │ seg 3 │  (pre-FFT'd at load time)
                    └───┬───┴───┬───┴───┬───┴───┬───┘
                        │       │       │       │
current input block ──► FFT ──► × ──────┘       │
prev input block ────────────► × ──────────────┘
...                                   (accumulate all products)
                                            │
                                            ▼
                                          IFFT → overlap-add → output
```

Steps:

1. **Load time**: Split IR into segments of `block_size` length. FFT each segment. Store frequency-domain
   representations.
2. **Per block**: FFT the current input block. Multiply (complex multiply) with each IR segment. Accumulate all
   products. IFFT the sum. Overlap-add with previous block's tail.

Block size = audio buffer size (e.g., 128 samples). FFT size = 2 × block_size (zero-padded for linear convolution).

**Low-latency variant**: Process the first IR segment via direct time-domain convolution (no FFT latency). Process
remaining segments via FFT. This is "non-uniform partitioned convolution" — zero added latency.

---

## 7. LFO

Low Frequency Oscillator. Generates slow waveforms (0.1–20 Hz) used to modulate other parameters (filter cutoff, pitch,
pan, etc.).

```rust
pub enum LfoShape { Sine, Triangle, Saw, Square, SampleAndHold }

pub struct LfoState {
    phase: f32,  // 0.0..1.0
    value: f32,  // current output (for S&H: held value)
}

#[inline]
fn lfo_tick(state: &mut LfoState, rate_hz: f32, sample_rate: f32, shape: LfoShape) -> f32 {
    state.phase += rate_hz / sample_rate;
    if state.phase >= 1.0 { state.phase -= 1.0; }
    match shape {
        LfoShape::Sine => (state.phase * std::f32::consts::TAU).sin(),
        LfoShape::Triangle => {
            if state.phase < 0.5 { 4.0 * state.phase - 1.0 } else { 3.0 - 4.0 * state.phase }
        }
        LfoShape::Saw => 2.0 * state.phase - 1.0,
        LfoShape::Square => if state.phase < 0.5 { 1.0 } else { -1.0 },
        LfoShape::SampleAndHold => {
            // Generate new random value once per cycle
            if state.phase < rate_hz / sample_rate { // just wrapped
                state.value = rand_f32() * 2.0 - 1.0; // -1..1
            }
            state.value
        }
    }
}
```

LFO output range: -1.0 to +1.0. The modulation target scales this: `cutoff = base_cutoff + lfo_output * mod_depth`.

---

## 8. Sample Player

Plays back recorded audio files. Used for acoustic instruments (piano, orchestra via SFZ) and any sample-based sound.

```rust
pub struct SampleData {
    samples: Vec<f32>,         // mono, normalized to -1.0..1.0
    sample_rate: f32,          // original recording sample rate
    root_note: u8,             // MIDI note this was recorded at
    loop_start: Option<usize>, // loop region start (in samples)
    loop_end: Option<usize>,   // loop region end
}

pub struct SamplePlayerState {
    position: f64,    // f64 for sub-sample precision over long playback
    playing: bool,
    reached_end: bool,
}
```

**Pitch shifting via playback rate:**

```rust
fn playback_rate(target_note: u8, root_note: u8, engine_sr: f32, sample_sr: f32) -> f64 {
    let pitch_ratio = 2.0_f64.powf((target_note as f64 - root_note as f64) / 12.0);
    pitch_ratio * (sample_sr as f64 / engine_sr as f64)
}
```

Playing a sample recorded at C3 (MIDI 48) at C4 (MIDI 60) = rate 2.0 (one octave up = double speed). If the sample was
recorded at 48kHz but the engine runs at 44.1kHz, the rate is adjusted by the ratio.

Each tick: `state.position += rate`. Read from `samples[position.floor()]` with cubic Hermite interpolation for
fractional positions (same algorithm as `DelayLine::read_cubic`).

---

## 9. Drum Synthesis (808/909)

All drums synthesized from math. No samples.

### Kick

```rust
fn kick_tick(state: &mut DrumState, t: f32) -> f32 {
    // Pitch envelope: starts high, drops exponentially
    let freq = 50.0 + 150.0 * (-t * 40.0).exp(); // 200Hz → 50Hz in ~25ms
    state.phase += freq / state.sample_rate;
    if state.phase >= 1.0 { state.phase -= 1.0; }
    // Sine oscillator with amplitude envelope
    let osc = (state.phase * std::f32::consts::TAU).sin();
    let amp = (-t * 8.0).exp(); // ~125ms decay
    osc * amp
}
```

### Snare

```rust
fn snare_tick(state: &mut DrumState, t: f32) -> f32 {
    // Body: pitched sine (~200Hz)
    let body_freq = 200.0 + 100.0 * (-t * 60.0).exp();
    state.phase += body_freq / state.sample_rate;
    if state.phase >= 1.0 { state.phase -= 1.0; }
    let body = (state.phase * std::f32::consts::TAU).sin() * (-t * 15.0).exp();
    // Noise: filtered white noise (snare wire rattle)
    let noise = rand_f32() * 2.0 - 1.0; // white noise
    let noise_env = (-t * 10.0).exp();   // ~100ms decay
    body * 0.6 + noise * noise_env * 0.4
}
```

### Hi-Hat

```rust
fn hihat_tick(state: &mut DrumState, t: f32, open: bool) -> f32 {
    let noise = rand_f32() * 2.0 - 1.0;
    // Bandpass filter the noise (metallic character)
    let filtered = state.hp_filter.tick(noise); // highpass at ~6kHz
    let decay_rate = if open { 3.0 } else { 40.0 }; // open: long, closed: very short
    let amp = (-t * decay_rate).exp();
    filtered * amp
}
```

All parameters (pitch, decay, noise mix, filter cutoff) are exposed as modulatable node attrs. Verification: FFT output,
measure fundamental pitch, measure spectral content, measure decay time.

## C1. SFZ Parser

### What SFZ Is

SFZ is an **open-standard, plain-text format** for mapping audio sample files to MIDI note ranges and velocity layers.
It's the standard way to define a sample-based instrument without proprietary formats.

An SFZ file tells the sample player: "when MIDI note 60 is played at velocity 80, load and play `piano_C4_mf.wav`,
pitched at C4."

### Format Structure

SFZ files use headers (`<region>`, `<group>`, `<global>`) and key=value opcodes:

```
// Grand Piano SFZ (simplified)
<global>
ampeg_release=0.5

<group> lovel=0 hivel=63
// Soft velocity layer
<region> sample=samples/C3_soft.wav lokey=48 hikey=48 pitch_keycenter=48
<region> sample=samples/D3_soft.wav lokey=50 hikey=50 pitch_keycenter=50
<region> sample=samples/E3_soft.wav lokey=52 hikey=52 pitch_keycenter=52

<group> lovel=64 hivel=127
// Loud velocity layer
<region> sample=samples/C3_loud.wav lokey=48 hikey=48 pitch_keycenter=48
<region> sample=samples/D3_loud.wav lokey=50 hikey=50 pitch_keycenter=50
```

### Structs

```rust
/// A parsed SFZ instrument.
pub struct SfzMapping {
    pub global: SfzOpcodes,
    pub groups: Vec<SfzGroup>,
}

/// A group of regions sharing common opcodes.
pub struct SfzGroup {
    pub opcodes: SfzOpcodes,
    pub regions: Vec<SfzRegion>,
}

/// One region: maps a sample file to a note range + velocity range.
pub struct SfzRegion {
    pub sample_path: String,       // relative path to .wav/.flac file
    pub lokey: u8,                 // lowest MIDI note (0-127)
    pub hikey: u8,                 // highest MIDI note
    pub lovel: u8,                 // lowest velocity (0-127)
    pub hivel: u8,                 // highest velocity
    pub pitch_keycenter: u8,       // MIDI note at which sample plays at original pitch
    pub tune: i16,                 // fine tuning in cents (-100..+100)
    pub volume: f32,               // gain in dB
    pub pan: f32,                  // -100 (left) to +100 (right)
    pub loop_mode: LoopMode,       // no_loop, loop_continuous, loop_sustain
    pub loop_start: Option<usize>, // loop start point in samples
    pub loop_end: Option<usize>,   // loop end point in samples
    pub offset: usize,             // skip N samples from start
    pub ampeg_attack: f32,         // per-region envelope override (seconds)
    pub ampeg_decay: f32,
    pub ampeg_sustain: f32,        // 0-100 (percent)
    pub ampeg_release: f32,
}

#[derive(Default)]
pub enum LoopMode {
    #[default]
    NoLoop,
    LoopContinuous,  // loop forever while note is held
    LoopSustain,     // loop while key held, play remainder on release
}

/// Shared opcodes that can be set at global, group, or region level.
/// Region overrides group, group overrides global.
pub struct SfzOpcodes {
    pub lokey: Option<u8>,
    pub hikey: Option<u8>,
    pub lovel: Option<u8>,
    pub hivel: Option<u8>,
    pub pitch_keycenter: Option<u8>,
    pub volume: Option<f32>,
    pub ampeg_attack: Option<f32>,
    pub ampeg_decay: Option<f32>,
    pub ampeg_sustain: Option<f32>,
    pub ampeg_release: Option<f32>,
    // ... ~40 more optional opcodes in the full SFZ spec
}
```

### Note-On Lookup

When a note-on event arrives, the SFZ mapper finds the matching region:

```rust
impl SfzMapping {
    /// Find the region that matches the given note and velocity.
    /// Returns None if no region covers this note/velocity combination.
    pub fn find_region(&self, note: u8, velocity: u8) -> Option<&SfzRegion> {
        for group in &self.groups {
            for region in &group.regions {
                let lo_k = region.lokey;
                let hi_k = region.hikey;
                let lo_v = region.lovel;
                let hi_v = region.hivel;
                if note >= lo_k && note <= hi_k && velocity >= lo_v && velocity <= hi_v {
                    return Some(region);
                }
            }
        }
        None
    }
}
```

### Parser Approach

SFZ is line-oriented text. No nested structures beyond header/opcode. A simple state-machine parser:

1. Read line by line
2. If line starts with `<global>`, `<group>`, or `<region>` → switch context
3. Parse `key=value` pairs within the current context
4. Inherit opcodes: region inherits from group, group inherits from global

Estimated: ~300 lines for a parser covering the most-used opcodes. The full SFZ spec has ~200 opcodes; implement the ~30
most common ones first, add others as needed.

**Verification**: Parse a known SFZ file, assert region count, note ranges, sample paths. No perceptual verification
needed — it's text parsing.

---

## C2. Wavetable Generation (Offline)

### What This Does

Generates wavetable data (arrays of f32 samples) from mathematical formulas. Runs offline (at load time or build time),
not on the audio thread. The generated data is stored in Kernel LUTs for runtime playback by the wavetable oscillator.

### Algorithm: Additive Synthesis → Band-Limited Wavetable Frames

Each wavetable frame is built by summing sine harmonics:

```
frame[sample] = Σ(n=1 to N) amplitude[n] * sin(2π * n * sample / frame_length)
```

Where:

- `N` = number of harmonics
- `amplitude[n]` = amplitude of the nth harmonic (defines the timbre)
- `frame_length` = samples per frame (typically 2048)

### Basic Waveforms

```rust
/// Generate a band-limited saw wave frame.
/// Saw = all harmonics, amplitude of nth harmonic = 1/n, alternating sign.
fn generate_saw(frame_length: usize, num_harmonics: usize) -> Vec<f32> {
    let mut frame = vec![0.0f32; frame_length];
    for n in 1..=num_harmonics {
        let amp = 1.0 / n as f32;
        let sign = if n % 2 == 0 { -1.0 } else { 1.0 };
        for s in 0..frame_length {
            let phase = 2.0 * PI * n as f32 * s as f32 / frame_length as f32;
            frame[s] += sign * amp * phase.sin();
        }
    }
    // Normalize to -1.0..1.0
    let max = frame.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
    if max > 0.0 { frame.iter_mut().for_each(|s| *s /= max); }
    frame
}

/// Square wave: odd harmonics only, amplitude = 1/n.
fn generate_square(frame_length: usize, num_harmonics: usize) -> Vec<f32> {
    let mut frame = vec![0.0f32; frame_length];
    for n in (1..=num_harmonics).step_by(2) { // odd harmonics: 1, 3, 5, 7...
        let amp = 1.0 / n as f32;
        for s in 0..frame_length {
            frame[s] += amp * (2.0 * PI * n as f32 * s as f32 / frame_length as f32).sin();
        }
    }
    normalize(&mut frame);
    frame
}

/// Triangle wave: odd harmonics, amplitude = 1/n², alternating sign.
fn generate_triangle(frame_length: usize, num_harmonics: usize) -> Vec<f32> {
    let mut frame = vec![0.0f32; frame_length];
    let mut sign = 1.0f32;
    for n in (1..=num_harmonics).step_by(2) {
        let amp = sign / (n as f32 * n as f32);
        for s in 0..frame_length {
            frame[s] += amp * (2.0 * PI * n as f32 * s as f32 / frame_length as f32).sin();
        }
        sign *= -1.0;
    }
    normalize(&mut frame);
    frame
}
```

### Evolving Wavetables (Multiple Frames)

An evolving wavetable has multiple frames with different harmonic content. The oscillator scans through frames, morphing
the timbre.

```rust
/// Generate an evolving wavetable with `num_frames` frames.
/// Harmonic content varies across frames to create movement.
fn generate_evolving_wavetable(
    frame_length: usize,
    num_frames: usize,
    max_harmonics: usize,
) -> Vec<Vec<f32>> {
    let mut frames = Vec::with_capacity(num_frames);
    for f in 0..num_frames {
        let t = f as f32 / (num_frames - 1) as f32; // 0.0 → 1.0 across frames
        let mut frame = vec![0.0f32; frame_length];
        for n in 1..=max_harmonics {
            // Example: harmonics fade in/out across frames
            let amp = (1.0 / n as f32) * harmonic_envelope(n, t);
            for s in 0..frame_length {
                frame[s] += amp * (2.0 * PI * n as f32 * s as f32 / frame_length as f32).sin();
            }
        }
        normalize(&mut frame);
        frames.push(frame);
    }
    frames
}

/// Example harmonic envelope: even harmonics grow, odd harmonics shrink.
fn harmonic_envelope(harmonic: usize, t: f32) -> f32 {
    if harmonic % 2 == 0 { t } else { 1.0 - t * 0.8 }
}
```

### Mip-Map Generation

After generating wavetable frames, create mip-maps for anti-aliased playback:

```rust
/// Generate mip-mapped versions of a wavetable frame.
/// Level 0 = full harmonics. Level N = 1 harmonic (sine).
fn generate_mip_maps(frame: &[f32], fft: &mut RealFft) -> Vec<Vec<f32>> {
    let n = frame.len();
    let total_levels = (n as f32).log2() as usize;
    let mut spectrum = fft.forward(frame); // → complex frequency bins
    let mut levels = Vec::with_capacity(total_levels);

    for level in 0..total_levels {
        // For this level: keep only harmonics below cutoff
        let max_harmonic = n / (1 << level);
        let mut filtered = spectrum.clone();
        for bin in max_harmonic..filtered.len() {
            filtered[bin] = Complex::new(0.0, 0.0);
        }
        levels.push(fft.inverse(&filtered)); // → time domain
    }
    levels
}
```

**Verification**: FFT each mip level, assert that no harmonics exist above the level's cutoff. Purely mathematical.

---

## C3. Oversampling for Nonlinear Processors

### What This Solves

Distortion/saturation generates new harmonics. A 10kHz sine through `tanh()` produces harmonics at 30kHz, 50kHz, etc. At
44.1kHz sample rate, 30kHz aliases back to 14.1kHz (30kHz - 44.1kHz/2 = audible garbage). 2x oversampling doubles the
Nyquist to 44.1kHz, pushing aliases above the audible range.

### Structs

```rust
pub struct Oversampler {
    up_filter: HalfBandFilter,    // lowpass for upsampling
    down_filter: HalfBandFilter,  // lowpass for downsampling
    oversample_buffer: Vec<f32>,  // 2x buffer size
}

/// Half-band FIR filter. 12 taps. Symmetric.
/// Passes frequencies below sample_rate/4, rejects above.
pub struct HalfBandFilter {
    coeffs: [f32; 6],  // symmetric: only store half the taps
    delay: [f32; 12],  // delay line for FIR
    pos: usize,
}
```

### Algorithm

```rust
impl Oversampler {
    /// Process a block through a nonlinear function with 2x oversampling.
    pub fn process<F: Fn(f32) -> f32>(
        &mut self,
        input: &[f32],
        output: &mut [f32],
        nonlinear: F,
    ) {
        let n = input.len();

        // 1. Upsample 2x: insert zeros between samples, apply lowpass
        for i in 0..n {
            self.oversample_buffer[i * 2] = input[i] * 2.0; // compensate for zero-stuffing gain loss
            self.oversample_buffer[i * 2 + 1] = 0.0;
        }
        self.up_filter.process_inplace(&mut self.oversample_buffer[..n * 2]);

        // 2. Apply nonlinear function at 2x rate
        for s in self.oversample_buffer[..n * 2].iter_mut() {
            *s = nonlinear(*s);
        }

        // 3. Downsample 2x: apply lowpass, decimate
        self.down_filter.process_inplace(&mut self.oversample_buffer[..n * 2]);
        for i in 0..n {
            output[i] = self.oversample_buffer[i * 2];
        }
    }
}
```

### Half-Band FIR Coefficients

12-tap half-band filter coefficients (from Parks-McClellan optimal design):

```rust
const HALFBAND_COEFFS: [f32; 6] = [
    0.002898163,  // tap 0 and 11
    -0.009972252, // tap 1 and 10
    0.032942810,  // tap 2 and 9
    -0.098262340, // tap 3 and 8
    0.315123670,  // tap 4 and 7
    0.500000000,  // tap 5 and 6 (center)
];
```

**Verification**: Process a known sine wave through upsampler → distortion → downsampler. FFT the output. Assert that
alias frequencies (above Nyquist/2) are attenuated by at least 60dB. No ears needed.
