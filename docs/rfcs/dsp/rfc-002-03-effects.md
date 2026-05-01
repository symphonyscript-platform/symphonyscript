# RFC-002-03: Phase 3 — Effects

**Components:** C10 `DelayLine`, C11 `Distortion`, C12 `Chorus`, C13 `Flanger`, C14 `Freeverb`, C15 `ConvolutionReverb`

**Depends on:** Phase 1 (buffers, dispatch), Phase 2 (parameter smoother).

**Key difference from synthesis:** Effects are per-node, NOT per-voice. A delay line has ONE buffer
shared by all voices. Voice audio is summed before entering effects.

---

## C10: DelayLine

**File:** `src/processors/delay_line.rs`
**Role:** Foundation for delay, chorus, flanger. Circular buffer with interpolated read.

### State (per-node, in ProcessorStatePool)

```rust
pub struct DelayLineState {
    buffer: Vec<f32>,          // circular buffer, allocated once
    write_pos: usize,          // current write position
    max_delay_samples: usize,  // buffer length
}
```

### Parameters

```rust
pub struct DelayParams {
    pub time_ms: f32,     // attr[0]
    pub feedback: f32,    // attr[1], range [0.0, ~0.95]. >1.0 = unstable (intentional for effects)
    pub wet_dry: f32,     // attr[2], range [0.0, 1.0]. 0=dry, 1=wet
}
```

### Algorithm

```
WRITE:
    buffer[write_pos] = input + feedback * read_output
    write_pos = (write_pos + 1) % max_delay_samples

READ WITH CUBIC HERMITE INTERPOLATION:
    delay_samples = time_ms * sample_rate / 1000.0
    read_pos_float = write_pos - delay_samples
    if read_pos_float < 0: read_pos_float += max_delay_samples

    // Cubic Hermite needs 4 points: p0, p1, p2, p3
    idx1 = floor(read_pos_float) as usize
    frac = read_pos_float - idx1 as f32
    idx0 = (idx1 + max_delay_samples - 1) % max_delay_samples
    idx2 = (idx1 + 1) % max_delay_samples
    idx3 = (idx1 + 2) % max_delay_samples

    p0 = buffer[idx0]
    p1 = buffer[idx1]
    p2 = buffer[idx2]
    p3 = buffer[idx3]

    // Cubic Hermite interpolation formula:
    a = -0.5*p0 + 1.5*p1 - 1.5*p2 + 0.5*p3
    b = p0 - 2.5*p1 + 2.0*p2 - 0.5*p3
    c = -0.5*p0 + 0.5*p2
    d = p1

    wet = a*frac³ + b*frac² + c*frac + d

OUTPUT:
    output = input * (1.0 - wet_dry) + wet * wet_dry
```

### Process Function

```
fn process_delay(
    node: &NodeReader,
    state: &mut DelayLineState,
    input: &AudioBuffer,
    output: &mut AudioBuffer,
    sample_rate: f32,
    buffer_size: usize,
)
```

### Tests

```
test_delay_time_accuracy:
    - Set delay = 10.0 ms, feedback = 0.0, wet = 1.0.
    - Input: impulse (1.0 at sample 0, 0.0 elsewhere).
    - Assert output has peak at sample 441 (10ms × 44100 Hz).

test_feedback:
    - delay = 10 ms, feedback = 0.5, wet = 1.0.
    - Input: impulse.
    - Assert echoes: sample 441 ≈ 1.0, sample 882 ≈ 0.5, sample 1323 ≈ 0.25.

test_interpolation_quality:
    - Set delay to non-integer sample count (e.g., 10.3 ms).
    - Input: sine at 1000 Hz. Process through delay.
    - FFT output. Assert no significant aliasing artifacts.

test_max_feedback_stability:
    - feedback = 0.99. Process 10M samples. Assert output bounded (no explosion).
```

---

## C11: Distortion + Oversampler

**File:** `src/processors/distortion.rs`
**Role:** Waveshaping for harmonic saturation. 2x oversampled to prevent aliasing.

### State (per-node)

```rust
pub struct DistortionState {
    // Oversampler half-band FIR filter state
    upsample_history: [f32; 12],   // 12-tap half-band FIR
    downsample_history: [f32; 12],
}
```

### Parameters

```rust
pub struct DistortionParams {
    pub drive: f32,       // attr[0], range [1.0, ~20.0]
    pub wet_dry: f32,     // attr[1], range [0.0, 1.0]
}
```

Node `meta[0]` = distortion type: 0=tanh, 1=hard_clip, 2=tube.

### Waveshaping Functions

```
TANH (smooth saturation):
    output = tanh(input * drive)

HARD CLIP:
    output = clamp(input * drive, -1.0, 1.0)

TUBE (asymmetric, even harmonics):
    if input >= 0.0:
        output = 1.0 - exp(-input * drive)
    else:
        output = -(1.0 - exp(input * drive)) * 0.8   // asymmetric: negative side is quieter
```

### 2x Oversampling

Nonlinear functions create new harmonics. Without oversampling, these fold back as aliasing.

```
HALF-BAND FIR COEFFICIENTS (12-tap, from Parks-McClellan):
    h = [0.0, -0.012, 0.0, 0.063, 0.0, -0.290, 0.5, -0.290, 0.0, 0.063, 0.0, -0.012]
    (Zeros at odd positions ensure half-band property)

UPSAMPLE 2x:
    For each input sample:
        Insert input sample at even position
        Insert 0.0 at odd position
        Apply FIR to both positions → 2 output samples

PROCESS AT 2x RATE:
    Apply waveshaping function to each of the 2x samples

DOWNSAMPLE 2x:
    Apply same FIR to 2x stream
    Take every other sample → back to original rate
```

**Note on FIR coefficients:** The exact values above are illustrative. The implementation should
use a proper Parks-McClellan designed half-band filter. Standard 12-tap half-band coefficients
are widely published. A commonly cited set for audio:

```
h = [0.002089, 0.0, -0.01295, 0.0, 0.05017, 0.0, -0.15454, 0.0, 0.61481, 0.0, ...]
```

The AI implementing this should cross-reference with a DSP textbook or the `scipy.signal.remez`
output for a 12-tap half-band filter with 0.1 transition band.

### Process Function

```
fn process_distortion(
    node: &NodeReader,
    state: &mut DistortionState,
    input: &AudioBuffer,
    output: &mut AudioBuffer,
    buffer_size: usize,
)

ALGORITHM:
    let params = DistortionParams::read_from_node(node);
    let dist_type = node.get_meta(0);

    for i in 0..buffer_size {
        let dry = input.as_slice()[i];

        // Upsample
        let (up0, up1) = upsample(dry, &mut state.upsample_history);

        // Waveshape at 2x rate
        let w0 = waveshape(up0, params.drive, dist_type);
        let w1 = waveshape(up1, params.drive, dist_type);

        // Downsample
        let wet = downsample(w0, w1, &mut state.downsample_history);

        output.as_mut_slice()[i] = dry * (1.0 - params.wet_dry) + wet * params.wet_dry;
    }
```

### Tests

```
test_tanh_transfer_function:
    - drive = 1.0. Input ramp from -2.0 to 2.0.
    - Assert output matches tanh(input) within f32 epsilon.

test_hard_clip:
    - drive = 2.0. Input = 0.7. Output = clamp(1.4, -1, 1) = 1.0.
    - Input = -0.3. Output = clamp(-0.6, -1, 1) = -0.6.

test_oversampling_reduces_aliasing:
    - Input: 10 kHz sine at sr=44100. Drive = 5.0 (heavy distortion).
    - Process WITH oversampling. FFT. Measure energy above Nyquist.
    - Process WITHOUT oversampling. FFT. Measure energy above Nyquist.
    - Assert oversampled version has significantly less aliasing energy.

test_unity_gain_at_drive_1:
    - drive = 1.0, tanh. Input: 0.5 sine.
    - Assert output peak is close to input peak (tanh(0.5) ≈ 0.462).
```

---

## C12: Chorus

**File:** `src/processors/chorus.rs`
**Role:** Short modulated delay for stereo thickening. Built on delay line.

### State (per-node)

```rust
pub struct ChorusState {
    delay_buffer: Vec<f32>,    // circular buffer, ~50ms max
    write_pos: usize,
    lfo_phase: f64,            // internal LFO for modulation
}
```

### Parameters

```rust
pub struct ChorusParams {
    pub rate_hz: f32,     // attr[0], LFO rate, typically 0.5–3.0 Hz
    pub depth: f32,       // attr[1], modulation depth in ms, typically 1–5 ms
    pub wet_dry: f32,     // attr[2]
}
```

### Algorithm

```
BASE DELAY: 7.0 ms (fixed)
MODULATED DELAY: base_delay + depth * sin(2π * lfo_phase)

lfo_phase += rate_hz / sample_rate
if lfo_phase >= 1.0: lfo_phase -= 1.0

delay_ms = 7.0 + depth * sin(2π * lfo_phase)
delay_samples = delay_ms * sample_rate / 1000.0

// Read from delay buffer with cubic interpolation (same as DelayLine)
wet = interpolated_read(delay_buffer, write_pos, delay_samples)

// Write to delay buffer (no feedback — chorus, not flanger)
delay_buffer[write_pos] = input
write_pos = (write_pos + 1) % max_delay

output = input * (1.0 - wet_dry) + wet * wet_dry
```

### Tests

```
test_chorus_modulation_rate:
    - rate = 1.0 Hz. Record output amplitude envelope for 2 seconds.
    - Assert modulation cycle visible at ~1 Hz.

test_chorus_no_feedback:
    - Input: impulse. Assert only ONE delayed copy, no repeats.
```

---

## C13: Flanger

**File:** `src/processors/flanger.rs`
**Role:** Very short modulated delay with feedback. Comb-filter sweep.

### State (per-node)

```rust
pub struct FlangerState {
    delay_buffer: Vec<f32>,   // ~20ms max
    write_pos: usize,
    lfo_phase: f64,
}
```

### Parameters

```rust
pub struct FlangerParams {
    pub rate_hz: f32,     // attr[0], typically 0.1–1.0 Hz
    pub depth: f32,       // attr[1], modulation depth ms, typically 0.5–3.0 ms
    pub feedback: f32,    // attr[2], range [-0.95, 0.95]. Negative = inverted comb
    pub wet_dry: f32,     // attr[3]... wait, we only have 3 delay params mapped.
}
```

> **Note:** Flanger needs 4 params (rate, depth, feedback, wet_dry). Use attr[0]–attr[3].

### Algorithm

Same as chorus but with **feedback** and **shorter delay**:

```
delay_ms = 1.0 + depth * sin(2π * lfo_phase)   // center: 1ms, not 7ms
wet = interpolated_read(delay_buffer, write_pos, delay_samples)
delay_buffer[write_pos] = input + feedback * wet   // ← feedback loop
output = input * (1.0 - wet_dry) + wet * wet_dry
```

### Tests

```
test_flanger_comb_filter:
    - Static delay (no LFO), feedback = 0.9. Input: white noise.
    - FFT. Assert comb-filter pattern (evenly spaced peaks/notches).

test_negative_feedback:
    - feedback = -0.9. Assert notch pattern is inverted vs positive feedback.
```

---

## C14: Freeverb

**File:** `src/processors/freeverb.rs`
**Role:** Algorithmic reverb using Jezar's exact published constants.

**Source:** Jezar, "Freeverb" — public domain. Delay lengths and coefficients are fixed.

### State (per-node)

```rust
pub struct FreeverbState {
    // 8 parallel comb filters
    comb_buffers: [Vec<f32>; 8],
    comb_write_pos: [usize; 8],
    comb_filter_store: [f32; 8],    // lowpass filter state per comb line

    // 4 series allpass filters
    allpass_buffers: [Vec<f32>; 4],
    allpass_write_pos: [usize; 4],
}
```

### Jezar's Published Constants

```
COMB FILTER DELAY LENGTHS (samples at 44100 Hz):
    1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617

ALLPASS FILTER DELAY LENGTHS:
    556, 441, 341, 225

ALLPASS FEEDBACK COEFFICIENT: 0.5

For other sample rates: scale proportionally:
    adjusted_length = (original_length * sample_rate / 44100.0) as usize
```

### Parameters

```rust
pub struct FreeverbParams {
    pub room_size: f32,    // attr[0], range [0.0, 1.0]
    pub damping: f32,      // attr[1], range [0.0, 1.0]
    pub wet_dry: f32,      // attr[2], range [0.0, 1.0]
}
```

### Algorithm

```
INTERNAL COEFFICIENTS:
    feedback = room_size * 0.28 + 0.7     // maps [0,1] → [0.7, 0.98]
    damp1 = damping * 0.4                  // maps [0,1] → [0, 0.4]
    damp2 = 1.0 - damp1

COMB FILTER (per comb line, per sample):
    output = comb_buffer[read_pos]
    comb_filter_store = output * damp2 + comb_filter_store * damp1  // 1-pole LP in feedback
    comb_buffer[write_pos] = input + comb_filter_store * feedback
    write_pos = (write_pos + 1) % comb_length

ALLPASS FILTER (per allpass line, per sample):
    buffered = allpass_buffer[read_pos]
    output = buffered - input
    allpass_buffer[write_pos] = input + buffered * 0.5   // 0.5 = allpass feedback
    write_pos = (write_pos + 1) % allpass_length
    input = output    // chain into next allpass

SIGNAL FLOW:
    1. Sum input mono signal
    2. Feed into 8 parallel comb filters
    3. Sum comb outputs
    4. Feed through 4 series allpass filters
    5. Mix with dry signal using wet_dry
```

### Tests

```
test_impulse_response_length:
    - Input: impulse. room_size = 0.8.
    - Assert output has energy for > 1 second (reverb tail).
    - Assert output decays to < -60 dB eventually.

test_damping_effect:
    - Low damping (0.1): FFT of reverb tail. Assert high frequencies present.
    - High damping (0.9): FFT of reverb tail. Assert high frequencies attenuated.

test_room_size_decay:
    - room_size=0.2: measure RT60 (time to decay 60 dB). Assert < 1s.
    - room_size=0.9: measure RT60. Assert > 2s.

test_exact_delay_lengths:
    - Assert comb buffer lengths match Jezar's published values (scaled for sample rate).
```

---

## C15: ConvolutionReverb

**File:** `src/processors/convolution.rs`
**Role:** Apply room/space character via impulse response convolution. Partitioned overlap-add (OLA).

**Depends on:** `realfft` crate.

### State (per-node)

```rust
pub struct ConvolutionState {
    // IR in frequency domain, partitioned into blocks
    ir_partitions: Vec<Vec<Complex<f32>>>,  // [partition_index][frequency_bin]
    partition_size: usize,                   // = buffer_size (typically 128-512)
    num_partitions: usize,

    // Input buffer history for overlap-add
    input_segments: VecDeque<Vec<Complex<f32>>>,

    // Accumulated output
    overlap_buffer: Vec<f32>,

    // FFT planner (reused)
    fft_forward: Arc<dyn RealToComplex<f32>>,
    fft_inverse: Arc<dyn ComplexToReal<f32>>,
}
```

### Algorithm — Partitioned Overlap-Add

```
INITIALIZATION (once, at instrument load):
    1. Load IR audio data (from IrBank, Arc<Vec<f32>>).
    2. Choose partition_size = buffer_size (e.g., 128).
    3. Pad IR to multiple of partition_size.
    4. For each partition of the IR:
       - Zero-pad partition to 2 × partition_size (for linear convolution via FFT)
       - FFT → store as ir_partitions[i]
    5. num_partitions = ceil(ir_length / partition_size)

PROCESS (per buffer):
    1. Zero-pad current input buffer to 2 × partition_size
    2. FFT the input → input_freq
    3. Push input_freq to front of input_segments deque
    4. Keep only num_partitions segments in deque (discard oldest)
    5. Accumulate in frequency domain:
       output_freq = Σ (input_segments[i] * ir_partitions[i])  // complex multiply
       for i in 0..num_partitions
    6. IFFT output_freq → time_domain (length = 2 × partition_size)
    7. Add first half to output buffer
    8. Add second half to overlap_buffer (saved for next block)
    9. Add overlap_buffer from previous block to output
    10. Save current second half as new overlap_buffer
```

### Tests

```
test_identity_convolution:
    - IR = [1.0, 0.0, 0.0, ...] (impulse = identity).
    - Input: any signal.
    - Assert output == input (within float epsilon).

test_delay_convolution:
    - IR = [0.0, 0.0, ..., 1.0] at sample 441 (10ms delay).
    - Input: impulse.
    - Assert output has peak at sample 441.

test_known_signal:
    - Input: 440 Hz sine, 1 second.
    - IR: simple 2-tap [0.5, 0.5] (averager).
    - Compute expected output manually.
    - Assert output matches expected within f32 epsilon.

test_long_ir:
    - IR: 2 seconds at 44100 Hz (88200 samples).
    - Process 10 seconds of input.
    - Assert no clicks at partition boundaries (overlap-add correctness).
    - Assert output energy decays matching IR energy.
```
