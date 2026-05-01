# RFC-002-02: Phase 2 — Synthesis Primitives

**Components:** C05 `ParameterSmoother`, C06 `Envelope`, C07 `LFO`, C08 `WavetableOsc`, C09 `SvfFilter`

**Depends on:** Phase 1 (C01-C04), `synaptic-kernel`.

---

## C05: ParameterSmoother

**File:** `src/processors/mod.rs` (inline utility, used by all processors)
**Role:** Prevents audible clicks when parameters change abruptly. One-pole lowpass IIR.

### Struct

```rust
pub struct ParameterSmoother {
    current: f32,
    target: f32,
    coeff: f32,       // smoothing coefficient: exp(-1 / (smoothing_time * sample_rate))
}
```

### Algorithm

One-pole exponential smoother:

```
current = current + coeff * (target - current)
```

Where `coeff = 1.0 - exp(-1.0 / (time_seconds * sample_rate))`.

At each sample: `current` moves toward `target`. After `time_seconds`, it has converged to
within `1/e` (~37%) of the remaining distance.

**Typical smoothing time:** 5ms (0.005s). At 44100 Hz: `coeff = 1.0 - exp(-1.0 / (0.005 * 44100))
≈ 0.00452`.

### Methods

```
ParameterSmoother::new(initial_value: f32, sample_rate: f32, time_seconds: f32) -> Self
    - coeff = 1.0 - (-1.0 / (time_seconds * sample_rate)).exp()
    - current = initial_value, target = initial_value

ParameterSmoother::set_target(&mut self, value: f32)
    - self.target = value

ParameterSmoother::next(&mut self) -> f32
    - self.current += self.coeff * (self.target - self.current)
    - return self.current

ParameterSmoother::is_settled(&self) -> bool
    - (self.target - self.current).abs() < 1e-6

ParameterSmoother::snap(&mut self)
    - self.current = self.target  (skip smoothing, used at initialization)
```

### Tests

```
test_convergence_time:
    - Create smoother: initial=0.0, target=1.0, time=0.005, sr=44100.
    - Process 44100*0.005 = 220 samples.
    - Assert current is within 63.2% of target (1 - 1/e ≈ 0.632).
    - Process another 220 samples. Assert within 86.5% (1 - 1/e²).

test_snap:
    - Set target to 5.0. Call snap(). Assert current == 5.0 exactly.

test_stability:
    - Set target = 1.0. Process 1M samples. Assert no NaN, no drift past target.
```

---

## C06: Envelope (ADSR)

**File:** `src/processors/envelope.rs`
**Role:** Generates a 0.0→1.0 control signal over the lifetime of a note.
Called once per sample per active voice.

### State

Uses `EnvelopeState` from C03 (`voice.rs`):

```rust
pub struct EnvelopeState {
    pub stage: EnvelopeStage,
    pub level: f32,          // current output [0.0, 1.0]
    pub phase: f32,          // position within stage [0.0, 1.0]
}
```

### Parameters (read from node attrs)

```rust
pub struct EnvelopeParams {
    pub attack_s: f32,     // attr[0]
    pub decay_s: f32,      // attr[1]
    pub sustain: f32,      // attr[2], range [0.0, 1.0]
    pub release_s: f32,    // attr[3]
}

impl EnvelopeParams {
    pub fn read_from_node(node: &NodeReader) -> Self {
        EnvelopeParams {
            attack_s: i32_to_f32(node.attr_read(0)),
            decay_s: i32_to_f32(node.attr_read(1)),
            sustain: i32_to_f32(node.attr_read(2)),
            release_s: i32_to_f32(node.attr_read(3)),
        }
    }
}
```

### Algorithm — Exponential Curve

Node meta[0] selects curve type. `0 = exponential` (default), `1 = linear`.

**Exponential envelope** (per sample):

```
ATTACK stage:
    rate = 1.0 / (attack_s * sample_rate)   // how much phase advances per sample
    phase += rate
    level = 1.0 - exp(-5.0 * phase)         // -5.0 gives ~99.3% reach at phase=1.0
    if phase >= 1.0: transition to DECAY

DECAY stage:
    rate = 1.0 / (decay_s * sample_rate)
    phase += rate
    level = sustain + (1.0 - sustain) * exp(-5.0 * phase)
    if phase >= 1.0: transition to SUSTAIN

SUSTAIN stage:
    level = sustain                          // hold until note_off
    (no phase advancement)

RELEASE stage:
    rate = 1.0 / (release_s * sample_rate)
    phase += rate
    level = release_start_level * exp(-5.0 * phase)
    if phase >= 1.0 OR level < 0.0001: transition to IDLE

IDLE stage:
    level = 0.0
```

**The `-5.0` constant:** This is a standard choice. At `phase = 1.0`, `exp(-5.0) ≈ 0.0067`, so
the envelope reaches 99.3% of its target. Increasing the constant makes the curve steeper
(faster attack, faster initial decay). Decreasing makes it more linear. `-5.0` is the
industry-standard value used by most analog-modeling synths.

**Linear envelope** (per sample):

```
ATTACK: level = phase (linear ramp 0→1)
DECAY:  level = 1.0 - phase * (1.0 - sustain) (linear ramp 1→sustain)
RELEASE: level = release_start * (1.0 - phase) (linear ramp → 0)
```

### Process Function

```
fn process_envelope(
    env_state: &mut EnvelopeState,
    params: &EnvelopeParams,
    curve_type: i32,         // from node meta[0]
    sample_rate: f32,
) -> f32                     // returns current envelope level
```

**Important:** The envelope does NOT produce audio. It produces a control signal (single f32 per
sample) that is used by other processors. The voice processing loop calls this and applies the
result to the target parameter.

### Tests

```
test_attack_time_accuracy:
    - params: attack=0.1s, decay=0.0, sustain=1.0, release=0.0
    - Process 0.1 * 44100 = 4410 samples.
    - Assert level >= 0.99 (reached ~99% of target within attack time).

test_decay_reaches_sustain:
    - params: attack=0.001, decay=0.2, sustain=0.5, release=0.1
    - Process through attack (44 samples) + decay (8820 samples).
    - Assert level is within 1% of sustain value (0.5).

test_release_reaches_zero:
    - Trigger note_on, wait through attack+decay, trigger release.
    - Process release_time * sample_rate samples.
    - Assert level < 0.001.

test_zero_attack:
    - attack=0.0. Assert level immediately jumps to 1.0 on first sample.

test_zero_release:
    - release=0.0. Assert level drops to 0.0 immediately on release.

test_exponential_shape:
    - Record envelope output for attack phase.
    - Assert it's concave (each successive delta is smaller than previous).
    - This distinguishes exponential from linear.

test_linear_shape:
    - Set curve_type = 1. Record attack phase.
    - Assert constant delta between consecutive samples.

test_stability_1m_samples:
    - Hold in sustain for 1M samples. Assert level stays exactly at sustain value.
    - No drift, no NaN.
```

---

## C07: LFO

**File:** `src/processors/lfo.rs`
**Role:** Low-frequency oscillator for parameter modulation. 0.01–20 Hz typical range.

### State

Uses `lfo_phase: f64` from `VoiceState`.

### Parameters (read from node attrs)

```rust
pub struct LfoParams {
    pub rate_hz: f32,     // attr[0]
    pub depth: f32,       // attr[1], range [0.0, 1.0]
}
```

### Shape (from node meta)

```
meta[0]: 0=sine, 1=triangle, 2=saw_down, 3=square, 4=sample_and_hold
```

### Algorithm (per sample)

```
phase_increment = rate_hz / sample_rate
phase += phase_increment
if phase >= 1.0: phase -= 1.0     // keep in [0, 1) range

output = match shape:
    Sine:           sin(2π * phase)                         // range [-1, 1]
    Triangle:       if phase < 0.5: 4.0 * phase - 1.0      // range [-1, 1]
                    else: 3.0 - 4.0 * phase
    SawDown:        1.0 - 2.0 * phase                       // range [-1, 1]
    Square:         if phase < 0.5: 1.0 else: -1.0          // range [-1, 1]
    SampleAndHold:  if phase wrapped this sample:            // range [-1, 1]
                      held_value = random_f32_range(-1, 1)
                    return held_value

scaled_output = output * depth    // range [-depth, +depth]
```

**Modulation routing:** The LFO output is written to a scratch value. The synapse connecting
LFO → target processor indicates which parameter to modulate (via `synapse meta[1]: mod_target`)
and by how much (`synapse meta[2]: mod_depth`). The dispatch loop applies:

```
target_param_value = base_value + lfo_output * mod_depth
```

### Process Function

```
fn process_lfo(
    phase: &mut f64,
    params: &LfoParams,
    shape: i32,              // from node meta[0]
    sample_rate: f32,
    buffer_size: usize,
    output: &mut AudioBuffer, // LFO writes its output here for routing
)
```

### Tests

```
test_sine_frequency:
    - rate=1.0 Hz, sr=44100. Process 44100 samples.
    - FFT output. Assert peak at 1.0 Hz.

test_triangle_range:
    - Process one full cycle. Assert all values in [-1.0, 1.0].
    - Assert min ≈ -1.0, max ≈ 1.0.

test_square_duty:
    - Process one full cycle. Count positive vs negative samples.
    - Assert approximately 50/50 split.

test_phase_stability:
    - Run for 10M samples at 0.1 Hz. Assert phase stays in [0, 1).
    - No accumulation drift (f64 phase).

test_sample_and_hold:
    - Process at rate=10Hz, sr=44100. Assert output holds constant
      between phase wraps (every 4410 samples).
```

---

## C08: WavetableOsc

**File:** `src/processors/wavetable_osc.rs`
**Role:** Core sound source. Reads from mip-mapped wavetable data.

### External Data

```rust
/// A single wavetable: multiple frames, each frame is one cycle, multiple mip levels.
pub struct MipMappedWavetable {
    pub frames: Vec<Vec<Vec<f32>>>,   // [mip_level][frame_index][sample_index]
    pub frame_count: usize,
    pub frame_size: usize,            // samples per frame (typically 2048)
    pub mip_levels: usize,            // typically 10-12
}

/// Collection of all loaded wavetables.
pub struct WavetableBank {
    pub tables: Vec<MipMappedWavetable>,
}
```

Stored as `Arc<WavetableBank>`, shared immutably between main and audio threads.

### Parameters

```rust
pub struct WavetableOscParams {
    pub frequency: f32,      // attr[0], in Hz
    pub frame_pos: f32,      // attr[1], [0.0, 1.0] — position in wavetable frame sequence
    pub gain: f32,           // attr[2]
}
```

Node `meta[1]` = wavetable_bank_index (which wavetable to use).

### Algorithm (per sample, per voice)

```
1. MIP LEVEL SELECTION
   harmonics_available = nyquist / frequency
   // nyquist = sample_rate / 2.0
   // At 44100 Hz playing C4 (261 Hz): harmonics = 22050/261 ≈ 84
   // At 44100 Hz playing C8 (4186 Hz): harmonics = 22050/4186 ≈ 5

   mip_level = floor(log2(frame_size / harmonics_available))
   mip_level = clamp(mip_level, 0, max_mip_level - 1)

   // Higher mip level = fewer harmonics = less aliasing at high pitches.
   // mip_level 0 = full harmonics (for low pitches).
   // mip_level N = frame_size / 2^N harmonics.

2. FRAME INTERPOLATION (wavetable morphing)
   frame_float = frame_pos * (frame_count - 1)
   frame_a = floor(frame_float) as usize
   frame_b = min(frame_a + 1, frame_count - 1)
   frame_frac = frame_float - frame_a as f32

3. SAMPLE INTERPOLATION (within a frame)
   // phase is in [0.0, 1.0), maps to [0, frame_size)
   sample_float = phase * frame_size
   idx_a = floor(sample_float) as usize
   idx_b = (idx_a + 1) % frame_size    // wrap around (it's a cycle)
   sample_frac = sample_float - idx_a as f32

   // Linear interpolation within each frame:
   val_a = lerp(table[mip][frame_a][idx_a], table[mip][frame_a][idx_b], sample_frac)
   val_b = lerp(table[mip][frame_b][idx_a], table[mip][frame_b][idx_b], sample_frac)

   // Cross-fade between frames:
   output = lerp(val_a, val_b, frame_frac) * gain

4. PHASE ADVANCE
   phase += frequency / sample_rate
   if phase >= 1.0: phase -= 1.0
```

**lerp:** `fn lerp(a: f32, b: f32, t: f32) -> f32 { a + t * (b - a) }`

### Process Function

```
fn process_wavetable_osc(
    node: &NodeReader,
    voice_states: &mut [VoiceState],
    voice_allocator: &VoiceAllocator,
    wavetable_bank: &WavetableBank,
    output: &mut AudioBuffer,
    sample_rate: f32,
    buffer_size: usize,
)

ALGORITHM:
    let params = WavetableOscParams::read_from_node(node);
    let wt_index = node.get_meta(1) as usize;
    let wt = &wavetable_bank.tables[wt_index];
    let nyquist = sample_rate / 2.0;

    for voice_slot in 0..MAX_VOICES {
        if !voice_allocator.is_active(voice_slot) { continue; }
        let vs = &mut voice_states[voice_slot];
        if vs.instrument_id != /* this instrument */ { continue; }

        let freq = midi_to_hz(vs.note) * /* pitch modulation if any */;

        for i in 0..buffer_size {
            let mip = select_mip_level(freq, nyquist, wt.frame_size, wt.mip_levels);
            let sample = read_wavetable(wt, mip, params.frame_pos, vs.osc_phase as f32);
            output.as_mut_slice()[i] += sample * params.gain;

            vs.osc_phase += (freq as f64) / (sample_rate as f64);
            if vs.osc_phase >= 1.0 { vs.osc_phase -= 1.0; }
        }
    }
```

### Helper: midi_to_hz

```
fn midi_to_hz(note: u8) -> f32 {
    440.0 * 2.0_f32.powf((note as f32 - 69.0) / 12.0)
}
// note 69 = A4 = 440 Hz
// note 60 = C4 ≈ 261.63 Hz
```

### Tests

```
test_sine_wavetable_pitch:
    - Create 1-frame wavetable containing a pure sine wave (2048 samples).
    - Play at 440 Hz. FFT output. Assert peak at 440 Hz ± 1 Hz.

test_mip_level_selection:
    - At 44100 Hz, playing 440 Hz: expect mip level 0 (full harmonics).
    - At 44100 Hz, playing 10000 Hz: expect higher mip level (reduced harmonics).
    - Assert no energy above Nyquist in output (aliasing check).

test_frame_morphing:
    - Create 2-frame wavetable: frame 0 = sine, frame 1 = saw.
    - frame_pos = 0.0: output should match pure sine.
    - frame_pos = 1.0: output should match saw.
    - frame_pos = 0.5: output should be midpoint (check spectral blend).

test_phase_precision_f64:
    - Play at 1 Hz for 600 seconds (10 minutes), sr=44100.
    - Measure pitch via FFT of last 1-second window.
    - Assert pitch is still 1.0 Hz ± 0.001 Hz (no drift from f64 accumulation).

test_no_aliasing_at_high_pitch:
    - Play saw wavetable at 15000 Hz, sr=44100.
    - FFT output. Assert no energy above 22050 Hz.
    - (mip-mapping should have removed high harmonics)
```

---

## C09: SvfFilter (Cytomic)

**File:** `src/processors/svf_filter.rs`
**Role:** State Variable Filter. Core frequency shaping. LP/HP/BP/Notch/Peak/Allpass.

**Source:** Andrew Simper, Cytomic. "Linear Trapezoidal Integrated SVF."
https://cytomic.com/files/dsp/SvfLinearTrapOptimised2.pdf

### State

Uses `filter_ic1eq`, `filter_ic2eq` from `VoiceState`. These are the integrator states.

### Parameters

```rust
pub struct SvfFilterParams {
    pub cutoff_hz: f32,    // attr[0]
    pub resonance_q: f32,  // attr[1], range [0.5, ~30.0]. 0.707 = Butterworth (no resonance)
}
```

Node `meta[0]` = filter mode: 0=LP, 1=HP, 2=BP, 3=Notch, 4=Peak, 5=Allpass.

### Algorithm (per sample)

From the Cytomic paper, Section 3 (linear trapezoidal integration):

```
COEFFICIENT CALCULATION (can be done once per buffer if cutoff is not modulated per-sample):
    g = tan(π * cutoff_hz / sample_rate)
    k = 1.0 / resonance_q          // k = 2.0 * (1.0 - resonance_norm) for [0,1] resonance
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2

TICK (per sample):
    v3 = input - ic2eq
    v1 = a1 * ic1eq + a2 * v3
    v2 = ic2eq + a2 * ic1eq + a3 * v3
    ic1eq = 2.0 * v1 - ic1eq
    ic2eq = 2.0 * v2 - ic2eq

OUTPUT (select by filter mode):
    LP:     v2
    HP:     input - k * v1 - v2
    BP:     v1
    Notch:  input - k * v1           // LP + HP
    Peak:   2.0 * v2 - input + k * v1  // LP - HP
    Allpass: input - 2.0 * k * v1
```

### Process Function

```
fn process_svf_filter(
    node: &NodeReader,
    voice_states: &mut [VoiceState],
    voice_allocator: &VoiceAllocator,
    input: &AudioBuffer,
    output: &mut AudioBuffer,
    sample_rate: f32,
    buffer_size: usize,
)

ALGORITHM:
    let params = SvfFilterParams::read_from_node(node);
    let mode = node.get_meta(0);

    // Coefficient calculation (once per buffer, assumes cutoff stable within buffer)
    let g = (PI * params.cutoff_hz / sample_rate).tan();
    let k = 1.0 / params.resonance_q;
    let a1 = 1.0 / (1.0 + g * (g + k));
    let a2 = g * a1;
    let a3 = g * a2;

    for voice_slot in 0..MAX_VOICES {
        if !voice_allocator.is_active(voice_slot) { continue; }
        let vs = &mut voice_states[voice_slot];

        for i in 0..buffer_size {
            let input_sample = input.as_slice()[i];
            let v3 = input_sample - vs.filter_ic2eq;
            let v1 = a1 * vs.filter_ic1eq + a2 * v3;
            let v2 = vs.filter_ic2eq + a2 * vs.filter_ic1eq + a3 * v3;

            vs.filter_ic1eq = 2.0 * v1 - vs.filter_ic1eq;
            vs.filter_ic2eq = 2.0 * v2 - vs.filter_ic2eq;

            output.as_mut_slice()[i] += match mode {
                0 => v2,                                       // LP
                1 => input_sample - k * v1 - v2,              // HP
                2 => v1,                                       // BP
                3 => input_sample - k * v1,                    // Notch
                4 => 2.0 * v2 - input_sample + k * v1,        // Peak
                5 => input_sample - 2.0 * k * v1,             // Allpass
                _ => v2,                                       // default LP
            };
        }
    }
```

### Tests

```
test_lowpass_frequency_response:
    - Set cutoff = 1000 Hz, Q = 0.707 (Butterworth), sr = 44100.
    - Generate white noise input (44100 samples).
    - Process through LP filter.
    - FFT output. Assert:
      - Passband (< 1000 Hz): gain ≈ 0 dB (±1 dB)
      - At cutoff (1000 Hz): gain ≈ -3 dB
      - Stopband (> 1000 Hz): rolls off at ~12 dB/octave
        (2000 Hz ≈ -12 dB, 4000 Hz ≈ -24 dB)

test_highpass_frequency_response:
    - Same as above but HP mode. Verify inverted curve.

test_bandpass_center_frequency:
    - Set cutoff = 2000 Hz, Q = 5.0.
    - Process white noise. FFT. Assert peak at 2000 Hz.

test_resonance_peak:
    - LP, cutoff = 1000 Hz, Q = 20.0 (high resonance).
    - Process white noise. FFT. Assert sharp peak at 1000 Hz.
    - Peak amplitude > passband amplitude (resonance amplifies near cutoff).

test_self_oscillation:
    - LP, cutoff = 1000 Hz, Q = 100.0 (extreme).
    - Process silence (zero input). Assert output is NOT zero —
      the filter self-oscillates, producing a sine wave near cutoff.
    - FFT output. Assert peak at ~1000 Hz.

test_stability_at_extreme_params:
    - Cutoff = 1 Hz (near DC). Process 1M samples. Assert no NaN/Inf.
    - Cutoff = 20000 Hz (near Nyquist). Process 1M samples. Assert no NaN/Inf.
    - Q = 0.5 (minimum). Process 1M samples. Assert output bounded.
    - Q = 100.0 (extreme). Process 1M samples. Assert output bounded.

test_cutoff_modulation:
    - Sweep cutoff from 100 Hz to 10000 Hz over 44100 samples.
    - Assert no clicks, pops, or NaN (filter remains stable under modulation).

test_denormal_flush:
    - Process near-zero signal through filter for 1M samples.
    - Assert no CPU time spike (denormals would cause slowdown).
    - Measure processing time, assert consistent.
```
