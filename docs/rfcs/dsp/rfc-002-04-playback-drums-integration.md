# RFC-002-04: Phases 4–7 — Playback, Drums, Tools, Integration

**Components:** C16-C21

---

## C16: SFZ Parser

**File:** `src/sfz/parser.rs`
**Role:** Parse SFZ text format into structured region mappings.

### Output Structs

```rust
pub struct SfzInstrument {
    pub groups: Vec<SfzGroup>,
}

pub struct SfzGroup {
    pub regions: Vec<SfzRegion>,
    pub group_opcodes: SfzOpcodes,   // defaults inherited by regions
}

pub struct SfzRegion {
    pub sample_path: String,         // relative path to WAV/FLAC file
    pub lokey: u8,                   // lowest MIDI note (default: 0)
    pub hikey: u8,                   // highest MIDI note (default: 127)
    pub lovel: u8,                   // lowest velocity (default: 0)
    pub hivel: u8,                   // highest velocity (default: 127)
    pub pitch_keycenter: u8,         // MIDI note at which sample plays at original pitch
    pub tune: i32,                   // fine tuning in cents (-100 to +100)
    pub volume: f32,                 // gain in dB (default: 0.0)
    pub pan: f32,                    // -100 to +100 (default: 0.0)
    pub loop_mode: LoopMode,         // no_loop, one_shot, loop_continuous, loop_sustain
    pub loop_start: u32,             // sample offset
    pub loop_end: u32,               // sample offset
}

#[repr(u8)]
pub enum LoopMode {
    NoLoop = 0,
    OneShot = 1,
    LoopContinuous = 2,
    LoopSustain = 3,
}

pub struct SfzOpcodes {
    // Stores all parsed key=value pairs.
    // Known opcodes are extracted into SfzRegion fields.
    // Unknown opcodes are ignored (forward compatibility).
    pub raw: HashMap<String, String>,
}
```

### Parser Algorithm

SFZ format is line-oriented text:

```
PARSING RULES:
    1. Lines starting with // are comments. Skip.
    2. Lines containing <control>, <global>, <group>, <region> start a new section.
    3. Within a section, opcodes are key=value pairs separated by whitespace.
    4. <group> opcodes are inherited by all <region>s within that group.
    5. <region> opcodes override <group> defaults.
    6. Multiple opcodes can appear on one line, space-separated.

PARSE FLOW:
    current_group = None
    current_region = None

    for each line in sfz_text:
        strip comments (// to end of line)
        strip whitespace

        if line contains "<group>":
            finalize current_region into current_group
            finalize current_group into instrument
            current_group = new SfzGroup
            parse remaining opcodes on this line into group_opcodes

        if line contains "<region>":
            finalize current_region into current_group
            current_region = new SfzRegion (inheriting group defaults)
            parse remaining opcodes on this line into region

        else:
            parse all key=value pairs into current section (group or region)

    finalize remaining region and group
```

### Opcode Parsing

```
For each "key=value" token:
    match key:
        "sample"          → region.sample_path = value
        "lokey"           → region.lokey = parse_note(value)   // "60" or "c4"
        "hikey"           → region.hikey = parse_note(value)
        "lovel"           → region.lovel = value.parse::<u8>()
        "hivel"           → region.hivel = value.parse::<u8>()
        "pitch_keycenter" → region.pitch_keycenter = parse_note(value)
        "tune"            → region.tune = value.parse::<i32>()
        "volume"          → region.volume = value.parse::<f32>()
        "pan"             → region.pan = value.parse::<f32>()
        "loop_mode"       → region.loop_mode = match value { ... }
        "loop_start"      → region.loop_start = value.parse::<u32>()
        "loop_end"        → region.loop_end = value.parse::<u32>()
        _                 → store in raw opcodes (ignore unknown)

parse_note(s: &str) -> u8:
    if s is numeric: parse as u8
    else: parse note name ("c4" → 60, "a#3" → 58, etc.)
```

### Tests

```
test_parse_basic_sfz:
    input:
        "<group> lovel=0 hivel=63
         <region> sample=piano_c4_soft.wav lokey=60 hikey=60 pitch_keycenter=60
         <region> sample=piano_d4_soft.wav lokey=62 hikey=62 pitch_keycenter=62"
    Assert 1 group, 2 regions. Verify all fields.

test_group_inheritance:
    input:
        "<group> lovel=0 hivel=63 volume=-3.0
         <region> sample=a.wav lokey=60 hikey=60"
    Assert region inherits lovel=0, hivel=63, volume=-3.0 from group.

test_region_overrides_group:
    input:
        "<group> volume=-3.0
         <region> sample=a.wav volume=-6.0"
    Assert region.volume == -6.0, not -3.0.

test_comment_handling:
    input:
        "// This is a comment
         <region> sample=a.wav // inline comment"
    Assert 1 region, sample = "a.wav".

test_note_name_parsing:
    - "c4" → 60, "a4" → 69, "c#3" → 49, "bb5" → 82

test_unknown_opcodes_ignored:
    input:
        "<region> sample=a.wav unknown_opcode=42 lokey=60"
    Assert parses without error. lokey=60 is set. unknown_opcode in raw map.
```

---

## C17: SamplePlayer

**File:** `src/processors/sample_player.rs`
**Role:** Pitch-shifted playback of audio samples loaded via SFZ.

### External Data

```rust
pub struct SampleBank {
    pub samples: Vec<LoadedSample>,
}

pub struct LoadedSample {
    pub data: Vec<f32>,          // decoded audio (mono, f32, at original sample rate)
    pub sample_rate: u32,        // original sample rate of the recording
    pub root_note: u8,           // MIDI note at which sample plays at original speed
    pub loop_start: Option<u32>,
    pub loop_end: Option<u32>,
}

/// Maps MIDI note + velocity to a sample index.
pub struct SampleMap {
    pub regions: Vec<SampleMapRegion>,
}

pub struct SampleMapRegion {
    pub sample_index: usize,     // index into SampleBank
    pub lokey: u8,
    pub hikey: u8,
    pub lovel: u8,
    pub hivel: u8,
    pub root_note: u8,
    pub tune_cents: i32,
}
```

### Voice State (addition to VoiceState)

```rust
// Add to VoiceState:
pub sample_position: f64,      // current read position in sample (f64 for pitch-shift precision)
pub sample_index: usize,       // which sample this voice is playing
pub sample_finished: bool,     // true when position reaches end (and no loop)
```

### Algorithm (per sample, per voice)

```
SAMPLE SELECTION (on note_on):
    Find region where lokey <= note <= hikey AND lovel <= velocity <= hivel.
    If multiple regions match: use first found (SFZ spec: last defined wins, but first is simpler).
    Set voice.sample_index = region.sample_index.
    Set voice.sample_position = 0.0.

PITCH RATIO CALCULATION:
    target_freq = midi_to_hz(note + tune_cents/100.0)
    root_freq = midi_to_hz(root_note)
    pitch_ratio = target_freq / root_freq
    // pitch_ratio > 1.0 = play faster (higher pitch)
    // pitch_ratio < 1.0 = play slower (lower pitch)

    // Also account for sample rate difference:
    sr_ratio = sample.sample_rate as f64 / engine_sample_rate as f64
    effective_ratio = pitch_ratio * sr_ratio

READ WITH INTERPOLATION (per sample):
    position = voice.sample_position
    idx = floor(position) as usize
    frac = (position - idx as f64) as f32

    if idx + 1 >= sample.data.len():
        if loop_mode == LoopContinuous:
            idx = loop_start + (idx - loop_start) % (loop_end - loop_start)
        else:
            voice.sample_finished = true
            output = 0.0
            return

    // Linear interpolation (upgrade to cubic if quality insufficient):
    output = lerp(sample.data[idx], sample.data[idx + 1], frac)

    voice.sample_position += effective_ratio
```

### Tests

```
test_original_pitch_playback:
    - Sample: 440 Hz sine, root_note = 69 (A4).
    - Play at note = 69. Assert output is 440 Hz (FFT check).

test_transposed_playback:
    - Same sample. Play at note = 81 (A5, one octave up).
    - pitch_ratio = 2.0. Assert output is 880 Hz.

test_sample_rate_conversion:
    - Sample recorded at 48000 Hz. Engine at 44100 Hz.
    - Play at root note. Assert pitch is correct (sr_ratio applied).

test_loop_continuous:
    - Sample with loop_start=1000, loop_end=2000.
    - Play for longer than sample length.
    - Assert output continues (loops), does not go silent.

test_one_shot:
    - loop_mode = OneShot. Play note, then note_off.
    - Assert sample continues playing through release (ignores note_off).

test_no_loop_ends:
    - loop_mode = NoLoop. Sample = 1000 samples.
    - Play for 2000 samples. Assert last 1000 are silence.
```

---

## C18: DrumVoice

**File:** `src/processors/drum_voice.rs`
**Role:** 808/909-style synthesized drums. Per-voice processing.

### Parameters

```rust
pub struct DrumVoiceParams {
    pub pitch: f32,              // attr[0], base frequency Hz
    pub decay: f32,              // attr[1], amplitude decay time seconds
    pub noise_mix: f32,          // attr[2], [0.0, 1.0]
    pub pitch_env_depth: f32,    // attr[3], Hz. How much pitch drops.
    pub pitch_env_time: f32,     // attr[4], seconds. How fast pitch drops.
}
```

Node `meta[0]` = drum_type:
```
0 = kick:       sine + pitch envelope
1 = snare:      sine + noise + filter
2 = hihat_c:    bandpass noise, short decay
3 = hihat_o:    bandpass noise, longer decay
4 = clap:       noise bursts with gaps
5 = tom:        sine + pitch envelope (higher pitch than kick)
```

### Algorithm — Kick (drum_type = 0)

```
PER SAMPLE:
    // Pitch envelope: exponential decay from (pitch + pitch_env_depth) to pitch
    time_in_note = sample_index / sample_rate     // seconds since note_on
    pitch_env = pitch_env_depth * exp(-time_in_note / pitch_env_time)
    current_freq = pitch + pitch_env

    // Oscillator
    output = sin(2π * osc_phase)
    osc_phase += current_freq / sample_rate
    if osc_phase >= 1.0: osc_phase -= 1.0

    // Amplitude envelope: exponential decay
    amp = exp(-time_in_note / decay)

    final_output = output * amp
```

**Typical 808 kick params:**
```
pitch = 50 Hz, decay = 0.5s, noise_mix = 0.0,
pitch_env_depth = 150 Hz, pitch_env_time = 0.05s
(starts at 200 Hz, drops to 50 Hz in ~50ms)
```

### Algorithm — Snare (drum_type = 1)

```
PER SAMPLE:
    // Pitched body (sine)
    body = sin(2π * osc_phase) * exp(-time / (decay * 0.5))
    osc_phase += pitch / sample_rate

    // Noise component (snare rattle)
    noise = random_f32(-1.0, 1.0) * exp(-time / decay)

    output = body * (1.0 - noise_mix) + noise * noise_mix
    output *= exp(-time / decay)   // overall amplitude envelope
```

**Typical snare params:** pitch=200, decay=0.2s, noise_mix=0.6

### Algorithm — Hi-hat (drum_type = 2,3)

```
PER SAMPLE:
    noise = random_f32(-1.0, 1.0)

    // Bandpass filter (simple 2-pole) at ~8000-12000 Hz
    // Use a simple biquad or even just highpass the noise
    filtered = highpass(noise, 8000.0, sample_rate)

    // Amplitude envelope
    if closed (type=2): amp = exp(-time / 0.05)    // 50ms decay
    if open (type=3):   amp = exp(-time / 0.3)     // 300ms decay

    output = filtered * amp
```

### Algorithm — Clap (drum_type = 4)

```
PER SAMPLE:
    // Multiple noise bursts with gaps
    burst_times = [0.0, 0.01, 0.02, 0.03]  // 4 bursts at 10ms intervals
    burst_duration = 0.005                   // 5ms each

    output = 0.0
    for t in burst_times:
        if time >= t && time < t + burst_duration:
            output += random_f32(-1.0, 1.0) * 0.5

    // Reverb tail (simple exponential noise)
    if time >= 0.03:
        output += random_f32(-1.0, 1.0) * exp(-(time - 0.03) / decay) * 0.3
```

### Tests

```
test_kick_pitch:
    - pitch=60Hz. FFT the output. Assert dominant frequency near 60 Hz
      (after pitch envelope settles).

test_kick_pitch_envelope:
    - FFT first 50ms: dominant freq should be ~200 Hz (pitch + depth).
    - FFT from 200ms onward: dominant freq should be ~50 Hz (settled).

test_snare_spectral_content:
    - noise_mix=0.5. FFT. Assert both tonal (peak at pitch) and noise
      (broadband energy above pitch).

test_hihat_closed_vs_open:
    - Closed: measure decay time. Assert < 100ms to -40dB.
    - Open: measure decay time. Assert > 200ms to -40dB.

test_clap_burst_count:
    - Record amplitude envelope. Assert 4 distinct peaks in first 40ms.

test_all_types_no_nan:
    - For each drum_type 0-5: process 44100 samples. Assert no NaN/Inf.
```

---

## C19: WavetableGenerator (offline)

**File:** `src/wavetable/generator.rs`
**Role:** Procedurally generate wavetables from math. Runs offline (not on audio thread).

### Generation Methods

**Basic waveforms (additive synthesis):**

```
SAW WAVE:
    For each harmonic k from 1 to max_harmonics:
        amplitude = 1.0 / k
        phase = 0 (alternating sign: (-1)^(k+1) for saw)
    frame[i] = Σ amplitude * sin(2π * k * i / frame_size)

SQUARE WAVE:
    Only odd harmonics (k = 1, 3, 5, 7, ...):
        amplitude = 1.0 / k
    frame[i] = Σ amplitude * sin(2π * k * i / frame_size)

TRIANGLE WAVE:
    Only odd harmonics:
        amplitude = 1.0 / k²
        alternating sign
    frame[i] = Σ ((-1)^((k-1)/2)) * (1/k²) * sin(2π * k * i / frame_size)

SINE WAVE:
    frame[i] = sin(2π * i / frame_size)
```

**Morphing wavetable (multi-frame):**

```
SPECTRAL MORPH:
    Create N frames. Each frame has different harmonic amplitudes:
    frame_0: harmonics [1, 0.5, 0.25, 0.125, ...]   // smooth, few harmonics
    frame_N: harmonics [1, 1, 1, 1, 1, ...]          // bright, many harmonics
    Intermediate frames: interpolate harmonic amplitudes linearly.

PWM (Pulse Width Modulation):
    Create N frames. Each frame is a pulse wave with different duty cycle:
    frame_0: duty = 0.1 (narrow pulse, many harmonics)
    frame_N: duty = 0.5 (square wave)
    Generated via additive: pulse = Σ (sin(2πk) * 2/kπ) * sin(kπ*duty)
```

### Mip-Map Generation

```
For each frame in the wavetable:
    mip_level_0 = original frame (all harmonics up to frame_size/2)

    For mip_level = 1, 2, ..., max_levels:
        max_harmonics = frame_size / 2^mip_level
        Regenerate frame using additive synthesis with only max_harmonics harmonics.
        OR: FFT original, zero out bins above max_harmonics, IFFT back.

    max_levels = floor(log2(frame_size))
    // For frame_size=2048: max_levels = 11
    // mip 0: 1024 harmonics, mip 1: 512, ..., mip 10: 1, mip 11: pure DC
```

### Output Format

```rust
pub struct GeneratedWavetable {
    pub name: String,
    pub frames: Vec<Vec<Vec<f32>>>,   // [mip_level][frame][sample]
    pub frame_count: usize,
    pub frame_size: usize,            // 2048
    pub mip_levels: usize,
}
```

### Tests

```
test_sine_wavetable_purity:
    - Generate sine wavetable. FFT mip_level_0.
    - Assert only 1 harmonic (fundamental). All others < -80 dB.

test_saw_harmonic_content:
    - Generate saw. FFT mip_level_0.
    - Assert harmonics present: 1, 2, 3, 4, 5...
    - Assert amplitude of harmonic k ≈ 1/k.

test_mip_map_harmonic_reduction:
    - Generate saw. Check mip_level_5.
    - Assert only frame_size/32 harmonics present.
    - Assert no energy above frame_size/32 harmonic.

test_square_odd_harmonics:
    - Generate square. FFT. Assert only odd harmonics (1, 3, 5, 7...).
    - Even harmonics (2, 4, 6) < -80 dB.
```

---

## C20: WavWriter (test utility)

**File:** `src/wav_writer.rs`
**Role:** Write audio buffers to WAV files for manual listening during development.

**Depends on:** `hound` crate.

### API

```rust
pub fn write_wav(
    path: &str,
    data: &[f32],
    sample_rate: u32,
    channels: u16,           // 1=mono, 2=stereo
) -> Result<(), hound::Error>
```

### Implementation

```
Use hound::WavWriter:
    spec = WavSpec { channels, sample_rate, bits_per_sample: 32, sample_format: Float }
    writer = WavWriter::create(path, spec)
    for sample in data:
        writer.write_sample(sample)
    writer.finalize()
```

---

## C21: InstrumentDef + InstrumentLoader

**File:** `src/instrument.rs`
**Role:** Define instruments as data. Load them into the Kernel graph.

### InstrumentDef

```rust
pub struct InstrumentDef {
    pub name: String,
    pub processors: Vec<ProcessorDef>,
    pub routes: Vec<RouteDef>,
    pub wavetable_index: Option<usize>,       // for synth instruments
    pub sample_map: Option<SampleMap>,         // for sample instruments
}

pub struct ProcessorDef {
    pub kind: ProcessorKind,
    pub params: Vec<(usize, f32)>,            // (attr_index, value) pairs
    pub config: Vec<(usize, i32)>,            // (meta_index, value) pairs
}

pub struct RouteDef {
    pub source_index: usize,                  // index in processors[]
    pub target_index: usize,
    pub gain: f32,
    pub route_type: RouteType,
}

pub enum RouteType {
    Audio,
    Control { target_param: usize, mod_depth: f32 },
}
```

### InstrumentLoader

```
fn load_instrument(
    kernel: &Kernel<0,0,0>,
    def: &InstrumentDef,
) -> InstrumentSlots

ALGORITHM:
    let mut node_slots = Vec::new();
    let mut synapse_slots = Vec::new();
    let mut prev_slot = None;

    // 1. Create nodes in order
    for processor_def in &def.processors:
        let slot = match prev_slot {
            None => kernel.insert_head_node(processor_def.kind as i32)?,
            Some(prev) => kernel.insert_node_after(prev, processor_def.kind as i32)?,
        };

        // Write initial params to attrs (MEM)
        let node = kernel.get_node(slot);
        for (idx, value) in &processor_def.params {
            node.attr_write(*idx, f32_to_i32(*value));
        }

        // Write structural config to meta (TB)
        for (idx, value) in &processor_def.config {
            node.set_meta(*idx, *value);
        }

        node_slots.push(slot);
        prev_slot = Some(slot);
    }

    // 2. Create routes (synapses)
    for route_def in &def.routes {
        let source_slot = node_slots[route_def.source_index];
        let target_slot = node_slots[route_def.target_index];
        let kind = match route_def.route_type {
            Audio => 0,
            Control { .. } => 1,
        };

        let syn_slot = kernel.connect(source_slot, target_slot, kind)?;
        let syn = kernel.get_synapse(syn_slot);
        syn.attr_write(0, f32_to_i32(route_def.gain));

        if let Control { target_param, mod_depth } = route_def.route_type {
            syn.set_meta(1, target_param as i32);
            syn.set_meta(2, f32_to_i32(mod_depth));
        }

        synapse_slots.push(syn_slot);
    }

    // 3. Publish all changes
    kernel.publish();

    InstrumentSlots { node_slots, synapse_slots }
```

### Factory Presets (examples)

```rust
pub fn acid_bass() -> InstrumentDef {
    InstrumentDef {
        name: "Acid Bass".into(),
        processors: vec![
            ProcessorDef {
                kind: ProcessorKind::WavetableOsc,
                params: vec![(0, 0.0), (1, 0.0), (2, 1.0)],  // freq set by voice, frame=0, gain=1
                config: vec![(1, 0)],                          // wavetable_bank_index=0 (saw)
            },
            ProcessorDef {
                kind: ProcessorKind::SVFilter,
                params: vec![(0, 800.0), (1, 8.0)],           // cutoff=800, Q=8
                config: vec![(0, 0)],                          // mode=LP
            },
            ProcessorDef {
                kind: ProcessorKind::Envelope,
                params: vec![(0, 0.01), (1, 0.3), (2, 0.0), (3, 0.05)],  // A=10ms, D=300ms, S=0, R=50ms
                config: vec![(0, 0)],                          // exponential
            },
            ProcessorDef {
                kind: ProcessorKind::Envelope,
                params: vec![(0, 0.005), (1, 0.1), (2, 0.7), (3, 0.2)],  // A=5ms, D=100ms, S=0.7, R=200ms
                config: vec![(0, 0)],
            },
            ProcessorDef {
                kind: ProcessorKind::Amplifier,
                params: vec![(0, 1.0)],
                config: vec![],
            },
            ProcessorDef {
                kind: ProcessorKind::Output,
                params: vec![],
                config: vec![],
            },
        ],
        routes: vec![
            RouteDef { source_index: 0, target_index: 1, gain: 1.0, route_type: RouteType::Audio },
            RouteDef { source_index: 1, target_index: 4, gain: 1.0, route_type: RouteType::Audio },
            RouteDef {
                source_index: 2, target_index: 1, gain: 1.0,
                route_type: RouteType::Control { target_param: 0, mod_depth: 4000.0 },
            },  // filter env → filter cutoff
            RouteDef {
                source_index: 3, target_index: 4, gain: 1.0,
                route_type: RouteType::Control { target_param: 0, mod_depth: 1.0 },
            },  // amp env → amplifier gain
            RouteDef { source_index: 4, target_index: 5, gain: 1.0, route_type: RouteType::Audio },
        ],
        wavetable_index: Some(0),  // saw wavetable
        sample_map: None,
    }
}
```

### Tests

```
test_load_acid_bass:
    - Create engine. Load acid_bass() preset.
    - Assert correct node count (6), synapse count (5).
    - Read back each node's kind, verify matches ProcessorKind.
    - Read back filter cutoff, verify == 800.0.

test_load_and_unload:
    - Load instrument. Assert node_count > 0.
    - Unload. Assert node_count == 0.
    - Load again. Assert works (slots recycled).

test_multi_instrument_load:
    - Load acid_bass() and a drum preset.
    - Assert total node count == sum of both instruments' nodes.
    - Assert instruments occupy separate node slot ranges.
```
