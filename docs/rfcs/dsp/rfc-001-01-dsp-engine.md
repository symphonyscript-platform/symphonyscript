# RFC-001: DSP Engine — Architecture & Design Principles

## Status: Draft

---

## 1. What This Document Covers

This RFC defines the audio synthesis and processing layer of SymphonyScript — the **DSP Engine**. It specifies what to
build, what to use from open-source, which algorithms to use, and why.

A companion document ([rfc-001-components.md](rfc-001-02-components.md)) contains detailed specifications for each DSP
component: structs, algorithms, formulas, and implementation guidance.

---

## 2. Glossary

DSP has dense terminology. Every term used in this RFC is defined here.

| Term                      | Meaning                                                                                                                                                                                                                               |
|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Sample**                | A single numeric measurement of sound pressure at one instant in time. Audio is a stream of samples.                                                                                                                                  |
| **Sample rate**           | How many samples per second. 44,100 Hz (CD quality) means 44,100 measurements per second. Higher rates (96kHz, 192kHz) capture more detail.                                                                                           |
| **Buffer**                | A fixed-size chunk of samples processed together. Typical sizes: 128, 256, 512 samples. The audio thread processes one buffer at a time.                                                                                              |
| **Nyquist frequency**     | Half the sample rate. The highest frequency that can be represented. At 44.1kHz sample rate, Nyquist = 22,050 Hz. Frequencies above this cause **aliasing**.                                                                          |
| **Aliasing**              | Audible artifacts (buzzing, harshness) caused when a signal contains frequencies above Nyquist. Like a wagon wheel appearing to spin backward in film — the sampling rate cannot capture the true motion.                             |
| **Anti-aliasing**         | Techniques to prevent aliasing. Either remove high frequencies before they cause problems, or process at a higher sample rate and downsample.                                                                                         |
| **Oscillator**            | Generates a repeating waveform (saw, square, sine). The raw sound source of a synthesizer.                                                                                                                                            |
| **Filter**                | Removes or emphasizes certain frequencies. A lowpass filter removes high frequencies (makes sound "darker"). A highpass removes lows. A bandpass keeps only a range.                                                                  |
| **Cutoff frequency**      | The frequency at which a filter begins to take effect.                                                                                                                                                                                |
| **Resonance (Q)**         | How much a filter emphasizes frequencies near the cutoff. High Q = sharp peak, ringing, "acid" sound.                                                                                                                                 |
| **Envelope**              | A shape that controls how a parameter changes over time. ADSR = Attack (fade in), Decay (drop to sustain), Sustain (hold level), Release (fade out after key release).                                                                |
| **LFO**                   | Low Frequency Oscillator. An oscillator running at sub-audio rates (0.1–20 Hz) used to modulate parameters. LFO on filter cutoff = "wah-wah" effect.                                                                                  |
| **Wavetable**             | A collection of single-cycle waveform snapshots. The oscillator scans through them, morphing between shapes. Serum popularized this approach.                                                                                         |
| **Mip-mapping**           | Pre-generating filtered versions of a wavetable at different harmonic counts. At high pitches, use the version with fewer harmonics to avoid aliasing. Same concept as texture LOD in 3D graphics.                                    |
| **PolyBLEP**              | Polylogarithmic Band-Limited Step. A cheap anti-aliasing technique for simple waveforms (saw, square). Smooths the hard edges that cause aliasing.                                                                                    |
| **SVF**                   | State Variable Filter. A filter topology that outputs lowpass, highpass, bandpass, and notch simultaneously from one structure. Industry standard for synthesizers.                                                                   |
| **Convolution**           | Multiplying one signal by another in the frequency domain. Used for reverb: multiply audio by the recording of a room's acoustic response (impulse response).                                                                         |
| **Impulse response (IR)** | A recording of how a space (room, hall, guitar body) responds to a single sharp click. Contains all the acoustic information about that space. Convolution with an IR applies that space's character to any audio.                    |
| **FFT**                   | Fast Fourier Transform. Converts audio from time domain (amplitude over time) to frequency domain (amplitude per frequency). Required for convolution and wavetable mip-map generation.                                               |
| **Karplus-Strong**        | A physical modeling algorithm for plucked strings. A short noise burst fed into a delay line with a lowpass filter in the feedback path. The delay length determines pitch. Sounds like a plucked string immediately. Published 1983. |
| **Denormal**              | Extremely small floating-point numbers (near zero) that cause CPU performance to drop 10-100x. Audio code must flush denormals to zero to avoid random CPU spikes.                                                                    |
| **Voice**                 | One instance of a playing note. A chord of 3 notes = 3 voices. Each voice has its own oscillator phase, filter state, envelope position, etc.                                                                                         |
| **Polyphony**             | How many voices can play simultaneously. 128 voices = 128 simultaneous notes.                                                                                                                                                         |
| **Voice stealing**        | When all voices are in use and a new note arrives, kill the least important active voice to free a slot.                                                                                                                              |
| **Parameter smoothing**   | Gradually interpolating a parameter from its current value to a new target value, to avoid audible clicks/zipper noise when parameters change abruptly.                                                                               |

---

## 3. Design Principles

### 3.1 Kernel Is the Sole Runtime Substrate

The DSP Engine wraps `SynapticKernel`. All runtime state lives inside the Kernel — nodes, synapses, entry stores, LUTs.
There are **no ad-hoc data structures** bypassing the Kernel on the audio thread.

If the Kernel lacks a capability needed by the DSP Engine, **extend the Kernel with a general-purpose primitive** —
never build a parallel data structure. This ensures the DSP Engine inherits the Kernel's lock-free, zero-allocation,
triple-buffered guarantees without re-implementing them.

The DSP Engine is a **domain-specific wrapper** over the Kernel, the same way SymphonyEngine is a domain-specific
wrapper for compositional concepts.

### 3.2 Verification Principle: Algorithms vs. Presets

DSP work has two distinct layers with different verification requirements:

1. **Algorithm implementation** — does the SVF filter produce the correct frequency response? Does the wavetable
   oscillator output the correct harmonics? These are math questions with measurable answers.
2. **Preset configuration** — does `cutoff=800, Q=8, attack=10ms` make a good "Acid Bass" sound? Does this wavetable
   frame sequence create an interesting evolving timbre? These are perceptual questions that require ears.

**We implement published, battle-tested algorithms and verify correctness through automated tests.** The algorithm
authors (Andrew Simper for SVF, Jezar for Freeverb, etc.) already performed the perceptual tuning of the algorithms
themselves. We inherit their work by implementing their exact formulas and published constants.

**We acknowledge that ~20% of DSP quality — preset design and integration polish — requires perceptual evaluation.**
This work cannot be solved by any dependency or algorithm. It is mitigated, not eliminated.

#### What is math-verifiable (algorithms):

| Component                | How to verify correctness                                                        | Ears needed? |
|--------------------------|----------------------------------------------------------------------------------|--------------|
| SVF filter               | FFT output → measure frequency response curve against expected transfer function | No           |
| Wavetable oscillator     | Compare output to reference signal, measure harmonic content via FFT             | No           |
| Envelope (ADSR)          | Assert output shape: linear/exponential ramp times match configured values       | No           |
| Delay / chorus / flanger | Impulse response test: send a click, measure delay time and modulation           | No           |
| Freeverb                 | Use Jezar's published delay lengths and coefficients exactly                     | No           |
| Convolution reverb       | Mathematical identity: output = input ∗ IR. Verify with known input/IR pair      | No           |
| Distortion               | Use published waveshaping functions (tanh). Verify input→output mapping          | No           |
| Parameter smoothing      | Measure convergence time, assert exponential decay shape                         | No           |
| Sample player            | Assert correct pitch ratio, verify sample data integrity                         | No           |
| Karplus-Strong           | Delay length = sample_rate / frequency. Verify pitch with FFT                    | No           |
| Denormal handling        | Measure CPU time, detect performance spikes                                      | No           |
| DC offset                | Measure running mean of output signal                                            | No           |
| Numerical stability      | Assert output stays bounded over millions of samples at extreme parameters       | No           |
| Aliasing                 | FFT output, assert no energy above Nyquist                                       | No           |

#### What needs perceptual evaluation:

| Area                              | What specifically needs ears                                          | Severity |
|-----------------------------------|-----------------------------------------------------------------------|----------|
| **Preset parameter values**       | "Does cutoff=800, Q=8 make a good Acid Bass?"                        | Medium   |
| **Factory wavetable selection**   | "Which 50 wavetables are musically interesting?"                      | Medium   |
| **Drum preset tuning**            | "Does this 808 kick match an actual 808?"                             | Medium   |
| **Gain staging defaults**         | "Is reverb wet/dry=0.3 a good default?"                              | Low      |
| **Parameter smoothing quality**   | "Is 5ms smoothing time perceptually click-free in all contexts?"      | Low      |
| **Overall integration feel**      | "Do these effects chain well together? Is the output pleasant?"       | Medium   |

#### What we do NOT build (fully perceptual):

| Component                       | Why excluded entirely                                                      |
|---------------------------------|----------------------------------------------------------------------------|
| Realistic piano synthesis       | Hammer model, soundboard, sympathetic resonance all need perceptual tuning |
| Realistic bowed strings         | Bow-string friction is chaotic; parameters must be ear-tuned for realism   |
| Custom reverb algorithms        | Choosing delay lengths and diffusion parameters requires listening         |
| Spectral effects (freeze, blur) | Windowing artifacts are perceptually evaluated                             |

#### Mitigation strategy for the perceptual gap:

V1 presets are **"mathematically plausible, not ear-verified."** The perceptual gap is real but manageable:

1. **Borrow known-good parameter values** from open-source synths. Vital and Surge are GPL — their code cannot be
   copied, but their preset parameter values can be studied. Parameter values (numbers like cutoff=800, Q=8) are not
   copyrightable. Use similar ranges and ratios.
2. **808/909 parameters are extensively documented** in open-source clones and hardware analysis articles. These are
   not secrets.
3. **Use standard defaults** for integration parameters. Wet/dry ratios, gain staging, smoothing times — these have
   well-known "safe" starting values documented across DSP textbooks and forums.
4. **Community contributions from people with ears.** Once the engine ships with functional-but-imperfect presets,
   community members can submit better ones. This is how Vital, Surge, and every open-source synth improves over time.
5. **Iterative refinement.** Ship v1. Collect feedback. Improve presets in v1.1. This is normal.

The DSP components themselves are correct by construction (math-verified). The open question is whether the factory
configurations are musically satisfying — and that question is answered by shipping and iterating, not by blocking.

### 3.3 Differentiate on Workflow, Not on Samples

SymphonyScript competes with Bitwig, Reaper, and code-first music platforms — not with Apple or Spitfire.

**DAW landscape:**

- **Bitwig** succeeds with built-in synthesizers, a powerful modulation system, and a modest sample-based acoustic
  library (multisampled piano, percussion, orchestral elements delivered as downloadable content packs via its built-in
  Sampler device). Not a massive library, but functional.
- **Reaper** succeeds with $60 pricing and extreme flexibility. Ships with almost no instruments.
- **Apple/Ableton** fund their instrument libraries with budgets in the millions — recording studios, session musicians,
  OEM licensing deals. This is not replicable by a solo developer.

**Code-first music platform precedent:**

| Platform          | DSP                                                          | Instruments                                                                  | Samples                                                 |
|-------------------|--------------------------------------------------------------|------------------------------------------------------------------------------|---------------------------------------------------------|
| **Tidal Cycles**  | None — delegates to SuperDirt (SuperCollider plugin) via OSC | Built-in SuperCollider synths + user-defined SynthDefs                       | Ships with `Dirt-Samples` folder. Users add their own.  |
| **Sonic Pi**      | Built on SuperCollider                                       | ~30 built-in synths (`:prophet`, `:tb303`, `:fm`, etc.) — all synthesized    | Ships with curated sample set. Users can load own WAVs. |
| **SuperCollider** | IS the DSP engine. UGens are the primitives.                 | Users build instruments from UGens via `SynthDef`. No pre-built instruments. | Users provide everything.                               |

**The pattern**: All code-first platforms build synthesis primitives in-house, ship minimal or no acoustic samples, and
rely on users to bring their own content for realistic instruments. SymphonyScript follows this exact playbook.

SymphonyScript's differentiator is the compositional graph, modulation engine, and DSL. The DSP Engine provides
synthesis and sample playback primitives. Instrument quality is "good enough" from synthesized sources + CC0 samples.
Users who need studio-quality acoustic instruments bring their own via SFZ support.

---

## 4. System Architecture

### 4.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      SymphonyScript DSL                      │
│              (user-facing language / compiler)                │
└────────────────────────┬────────────────────────────────────┘
                         │ compiles to
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     SymphonyEngine                           │
│        Compositional graph: clips, notes, modulation         │
│     Wraps Kernel — nodes=clips, synapses=signal routes       │
│     Output: musical events (note on/off, CC, tempo, etc.)    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              SynapticKernel (instance 1)             │     │
│  └─────────────────────────────────────────────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │ musical events
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                       DSP Engine                             │
│        Audio processing graph: oscillators, filters, fx      │
│     Wraps Kernel — nodes=processors, synapses=audio routes   │
│     Input: musical events     Output: audio samples          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              SynapticKernel (instance 2)             │     │
│  └─────────────────────────────────────────────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │ audio samples
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Platform Adapter                           │
│    Native: cpal / nih-plug (VST3/CLAP)                       │
│    Browser: web-sys WebAudio                                 │
│    Standalone: cpal                                          │
└─────────────────────────────────────────────────────────────┘
```

**Two separate Kernel instances.** SymphonyEngine and DSP Engine each wrap their own Kernel. They communicate through
musical events, not shared memory. The Kernel is a general-purpose graph primitive — each wrapper gives it
domain-specific meaning.

### 4.2 Kernel Mapping for DSP Engine

| Kernel Concept    | DSP Engine Meaning                                  | Plane                        | Example                                                   |
|-------------------|-----------------------------------------------------|------------------------------|-----------------------------------------------------------|
| **Node**          | Signal processor                                    | —                            | A filter, an oscillator, an amplifier                     |
| **Node kind**     | Processor type (enum)                               | TB                           | `0 = WavetableOsc, 1 = SVFilter, ...`                     |
| **Node attrs**    | Real-time modulatable parameters                    | MEM (instant visibility)     | Filter cutoff, oscillator pitch, gain                     |
| **Node meta**     | Structural configuration                            | TB (publish/swap)            | Wavetable ID, filter mode (LP/HP/BP), envelope curve type |
| **Synapse**       | Audio signal route between processors               | —                            | "Oscillator output → Filter input"                        |
| **Synapse attrs** | Route gain, pan                                     | MEM                          | Signal scaling on this connection                         |
| **Synapse meta**  | Route type                                          | TB                           | Audio-rate vs control-rate                                |
| **Entry Store**   | Per-voice state arrays                              | TB (core/meta) + MEM (attrs) | 128 voices × N state variables per processor              |
| **LUT**           | Wavetable data, waveshaping curves, envelope shapes | TB                           | 2048-sample wavetable frames                              |

**Why MEM for modulatable parameters:** The MEM plane provides instant visibility — when SymphonyEngine changes a filter
cutoff (via a modulation event), the audio thread sees the new value on its very next buffer without waiting for
publish/swap. This is essential for real-time modulation.

**Why TB for structural config:** Changing a filter from lowpass to highpass is a structural change — the audio thread
should see it atomically (all-or-nothing), not mid-buffer. The TB publish/swap mechanism provides this.

**Why Entry Store for voice state:** Each voice needs its own oscillator phase, filter state, envelope position, etc.
Entry Store provides per-slot indexed storage — voice N reads/writes slot N. The core region (TB plane) ensures state
consistency across publish cycles.

### 4.3 Audio Thread Constraints

The audio thread has a **hard real-time deadline**. At 44,100 Hz sample rate with a 128-sample buffer, the audio thread
has **2.9 milliseconds** to process the entire buffer. Missing this deadline causes an audible click/dropout.

This means the audio thread **must not**:

- Allocate memory (malloc can block)
- Lock mutexes (can block if contended)
- Perform I/O (disk, network)
- Make system calls that can block

The Kernel's lock-free, zero-allocation architecture was designed exactly for this. The DSP Engine inherits these
guarantees by using the Kernel as its sole runtime substrate.

**Denormal flushing**: Tiny floating-point numbers (denormals) cause 10-100x CPU slowdowns on x86. The DSP Engine must
set the FPU to flush-to-zero mode at the start of each audio callback:

```rust
// x86/x86_64: set DAZ and FTZ bits in MXCSR
#[cfg(target_arch = "x86_64")]
unsafe { core::arch::x86_64::_mm_setcsr(core::arch::x86_64::_mm_getcsr() | 0x8040); }
```

### 4.4 Audio Buffer Format

All internal audio is `f32` mono. Stereo = two separate mono buffers (left, right). Not interleaved.

```rust
pub struct AudioBuffer {
    data: Vec<f32>,   // pre-allocated, capacity = max buffer size
    len: usize,       // actual samples this block (may be < capacity)
}
```

Buffers are allocated once at initialization and reused. Zero allocation on the audio thread. Each node reads from input
buffer(s), processes, writes to output buffer(s).

---

## 5. Voice Management

### 5.1 What a Voice Is

When a musician presses a key, a **voice** is activated. Each voice represents one playing note and carries its own
state: oscillator phase, filter state, envelope position, velocity, etc.

A chord of 4 notes = 4 active voices. Target: **128 simultaneous voices minimum**.

### 5.2 Shared Graph, Per-Voice State

All voices share the **same DSP graph topology** (same chain of oscillator → filter → amp). They differ only in state (
different phases, different envelope positions, different notes).

Per-voice state lives in **Entry Stores** — one slot per voice. Processor N reads voice V's state from
`entry_store.get(V).core_read(processor_N_offset)`.

**Estimated state per voice:**

| Processor    | i32 slots per voice | Purpose                                                          |
|--------------|---------------------|------------------------------------------------------------------|
| WavetableOsc | 3                   | phase accumulator, wavetable scan position, sub-oscillator phase |
| SVFilter     | 4                   | ic1eq, ic2eq (integrator states), v1, v2                         |
| Envelope × 2 | 8                   | stage, position, level, rate — one for filter, one for amp       |
| LFO          | 2                   | phase, current value                                             |
| Amplifier    | 1                   | current smoothed gain                                            |
| **Total**    | **~18**             |                                                                  |

18 slots × 128 voices = 2,304 i32 in Entry Store core region. Negligible memory.

### 5.3 Voice Allocation & Stealing

```rust
pub struct VoiceAllocator {
    active: [bool; 128],
    note: [u8; 128],        // MIDI note number (0-127)
    velocity: [u8; 128],
    age: [u32; 128],        // monotonic timestamp of activation
    global_age: u32,
}
```

**Allocation**: Find first inactive slot. If none, steal the oldest active voice (lowest `age` value). Oldest-first is
the simplest correct strategy and matches user expectation — the note they played longest ago is the least important.

**Note-off**: Find the voice playing that note, transition its envelope to Release stage. When the envelope reaches
zero, mark the voice as inactive.

---

## 6. Instrument Strategy

### 6.1 What an Instrument Is

An instrument is **not code**. It is a **configuration** of the DSP graph:

1. **Graph topology**: Which processors, how connected (oscillator → filter → amp)
2. **Parameter values**: Filter cutoff = 2000Hz, resonance = 0.7, attack = 0.5s, etc.
3. **Sound source data**: Wavetable arrays (for synths) or audio sample files (for acoustic instruments)

An instrument is a data file — a preset. The DSP Engine loads it and configures the Kernel graph accordingly.

In SymphonyEngine, a clip holds a reference/pointer to an instrument node. When that clip's notes are played, the DSP
Engine processes them through that instrument's graph configuration.

### 6.2 Instrument Categories

| Category                    | Sound Source                  | Synthesis Method             | Needs Ears?                      | V1?         |
|-----------------------------|-------------------------------|------------------------------|----------------------------------|-------------|
| **Synthesizer**             | Wavetable (math-generated)    | Wavetable → filter → effects | No                               | Yes         |
| **Electronic drums**        | Synthesized (sine + noise)    | Subtractive / FM             | No                               | Yes         |
| **Acoustic instruments**    | Sample recordings (CC0/CC-BY) | Sample playback              | No — quality is in the recording | Yes (basic) |
| **Plucked strings**         | Synthesized                   | Karplus-Strong               | No — pitch verifiable by FFT     | V2          |
| **Realistic piano**         | Sample recordings             | Sample playback              | No — quality is in the recording | Via samples |
| **Realistic strings/brass** | Sample recordings             | Sample playback              | No — quality is in the recording | Via samples |

### 6.3 Instrument Crate Architecture

Instruments are separate crates within the SymphonyScript ecosystem. The DSP Engine provides primitives; instrument
crates provide configurations.

```
symphonyscript-instruments-synth/       — wavetable presets (procedurally generated wavetables + graph configs)
symphonyscript-instruments-drums/       — synthesized electronic drums (808/909-style, pure math)
symphonyscript-instruments-acoustic/    — CC0/CC-BY sample-based instruments + SFZ mappings
```

### 6.4 Wavetable Generation (Synth Instruments)

Wavetables for synthesizer instruments are generated **procedurally from math**. No recordings. No licensing.

- **Basic waveforms**: Saw, square, triangle, sine — direct mathematical formulas
- **Complex wavetables**: Generated via additive synthesis — sum N sine harmonics with varying amplitudes across frames.
  Each frame is one cycle. Scanning across frames morphs the timbre.
- **Factory library**: 20-50 procedurally generated wavetables + 30-50 preset graph configurations. All original.

### 6.5 Sample-Based Instruments (Acoustic)

For acoustic instruments where synthesis requires perceptual tuning (piano, orchestral strings, etc.), the DSP Engine
provides a **sample player** + **SFZ format support**.

**SFZ** is an open-standard text format that maps audio sample files to MIDI note ranges and velocity layers. Example:

```
<group> lovel=0 hivel=63
<region> sample=piano_C4_soft.wav lokey=60 hikey=60 pitch_keycenter=60
<region> sample=piano_D4_soft.wav lokey=62 hikey=62 pitch_keycenter=62

<group> lovel=64 hivel=127
<region> sample=piano_C4_loud.wav lokey=60 hikey=60 pitch_keycenter=60
```

Parsing SFZ is ~300 lines. The sample player handles playback. The SFZ mapping handles "which sample for which note at
which velocity."

**Free sample sources (CC0 / CC-BY — safe for open-source bundling):**

| Library                   | Content                               | License                 | Quality      |
|---------------------------|---------------------------------------|-------------------------|--------------|
| VSCO Community Edition    | Full orchestra                        | CC0 (public domain)     | Decent       |
| Virtual Playing Orchestra | Full orchestra                        | Public domain           | Decent       |
| Salamander Grand Piano    | Yamaha C5 grand, multi-velocity       | CC-BY-3.0 (attribution) | Good         |
| FluidR3 GM SoundFont      | General MIDI 128+ instruments         | MIT                     | Basic-decent |
| sfzinstruments.github.io  | Curated index of free SFZ instruments | Various CC0/CC-BY       | Varies       |

**User-provided samples**: SFZ support also lets users load their own commercial sample libraries (Kontakt, Spitfire,
etc.). Users who need studio quality bring their own content.

### 6.6 Electronic Drum Synthesis

808/909-style drums are fully synthesized from math:

- **Kick**: Sine oscillator with exponential pitch envelope (starts at ~200Hz, drops to ~50Hz in ~50ms) + optional
  distortion
- **Snare**: Sine oscillator (pitched body, ~200Hz) + filtered white noise (snare rattle) + amplitude envelope
- **Hi-hat**: Band-passed white noise with short amplitude envelope. Closed = very short decay. Open = longer decay.
- **Clap**: Multiple short noise bursts with slight time offsets, reverb tail
- **Tom**: Sine with pitch envelope (like kick but higher pitch, less drop)

All parameters (pitch, decay, noise mix) are tunable. All verification is mathematical (measure pitch via FFT, measure
decay time, measure spectral content).

---

## 7. Build vs. Use Open-Source — Summary

### Build (Differentiator or Simple Enough)

| Component                         | Why build                                  | Est. lines | Verification                  |
|-----------------------------------|--------------------------------------------|------------|-------------------------------|
| DSP graph engine (Kernel wrapper) | IS the product                             | ~500       | Integration tests             |
| Voice allocator                   | Must integrate with Kernel Entry Stores    | ~150       | Unit tests                    |
| Parameter smoothing               | 20 lines, trivial                          | ~30        | Measure convergence           |
| Wavetable oscillator              | Core synth method, must use Kernel LUTs    | ~200       | FFT harmonic analysis         |
| SVF filter (Cytomic)              | IS the sound of the synth                  | ~100       | Frequency response curves     |
| ADSR envelope                     | 60 lines, trivial                          | ~80        | Shape assertion               |
| LFO                               | 40 lines, trivial                          | ~40        | Frequency/amplitude test      |
| Sample player + SFZ               | Must integrate with buffer format          | ~400       | Pitch/timing verification     |
| Delay line                        | Foundation for 4 effects                   | ~80        | Impulse response test         |
| Chorus / flanger                  | Built on delay line, ~30 lines each        | ~60        | Modulation depth test         |
| Distortion / waveshaper           | Published functions (tanh), 15 lines       | ~30        | Input→output mapping          |
| Freeverb                          | Published constants (Jezar, public domain) | ~200       | Use exact published constants |
| Convolution reverb                | Pure math, no ear tuning                   | ~250       | Mathematical identity         |
| Drum synthesis (808/909)          | Math-only, no samples                      | ~200       | FFT pitch verification        |
| Wavetable generator               | Additive synthesis, offline                | ~150       | Harmonic content analysis     |
| **Total**                         |                                            | **~2,470** |                               |

### Use Open-Source (Commodity)

| Component                 | Crate                                                           | License        | Why use                                                         |
|---------------------------|-----------------------------------------------------------------|----------------|-----------------------------------------------------------------|
| FFT                       | [`realfft`](https://crates.io/crates/realfft) (wraps `rustfft`) | MIT/Apache-2.0 | Needed for convolution + mip-maps. FFT is solved math.          |
| Audio output (standalone) | [`cpal`](https://crates.io/crates/cpal)                         | Apache-2.0     | Platform audio I/O. No value in reimplementing.                 |
| Plugin format (VST3/CLAP) | [`nih-plug`](https://github.com/robbert-vdh/nih-plug)           | ISC            | Plugin hosting protocol. Standard compliance required.          |
| Audio file decode         | [`symphonia`](https://crates.io/crates/symphonia)               | MPL-2.0        | WAV/FLAC/OGG decoding for samples + IRs.                        |
| WAV-only (lighter)        | [`hound`](https://crates.io/crates/hound)                       | Apache-2.0     | If only WAV support needed.                                     |
| Sample rate conversion    | [`rubato`](https://crates.io/crates/rubato)                     | MIT            | Resample IRs/samples to engine sample rate. Sinc interpolation. |
| MIDI parsing              | [`midly`](https://crates.io/crates/midly)                       | MIT            | MIDI file + real-time message parsing.                          |

**All crates are MIT, Apache-2.0, MPL-2.0, or ISC. No proprietary dependencies.**

---

## 8. Anti-Aliasing Strategy

### 8.1 Why It Matters

At 44.1kHz, Nyquist is 22,050 Hz. A saw wave at 10kHz has harmonics at 20kHz, 30kHz, 40kHz... The harmonics above 22,050
Hz "fold back" into the audible range as inharmonic artifacts (aliasing). This sounds harsh and metallic — the #1
quality problem in digital synthesizers.

At higher sample rates (96kHz, 192kHz), Nyquist is higher, so there's more headroom before aliasing occurs. But it still
must be handled.

### 8.2 Strategy Per Component

**Wavetable oscillator**: Mip-mapped wavetables. At load time, generate filtered versions of each waveform with
progressively fewer harmonics. At runtime, select the mip level based on `nyquist / current_frequency`. At high
pitches (near Nyquist), use the version with very few harmonics. This completely eliminates aliasing with zero runtime
cost — the work is done at load time.

**Nonlinear processors (distortion, filter saturation)**: These generate NEW harmonics that weren't in the input. A sine
wave through `tanh()` distortion produces odd harmonics (3rd, 5th, 7th...) that may exceed Nyquist.

Solution: **2x oversampling** around the nonlinear stage only:

1. Upsample input 2x (insert zeros, apply half-band lowpass FIR filter, ~12 taps)
2. Process through the nonlinear function at 2x rate
3. Downsample back to original rate (apply same lowpass, decimate)

This doubles the CPU cost of only the nonlinear processor — not the entire chain.

**Linear processors (delay, reverb, chorus, EQ)**: No aliasing risk. Linear operations cannot create new frequencies.
Process at native sample rate.

---

## A1. Core Types

These were lost during the RFC rewrite. They define the DSP Engine's type system.

### ProcessorKind

Every node in the DSP Kernel graph has a `kind` field (stored on the TB plane as node meta). This enum maps `kind`
values to processor types:

```rust
/// Processor type. Stored as node `kind` in the Kernel graph.
/// Audio thread reads this to dispatch to the correct processing function.
#[repr(u16)]
pub enum ProcessorKind {
    WavetableOsc = 0,  // Wavetable oscillator — generates pitched sound from wavetable LUT
    SamplePlayer = 1,  // Sample playback — reads from loaded audio files
    SVFilter = 2,  // State Variable Filter — frequency shaping (LP/HP/BP/Notch)
    Amplifier = 3,  // Gain stage — volume control, often modulated by envelope
    Envelope = 4,  // ADSR envelope generator — shapes parameters over note lifetime
    LFO = 5,  // Low Frequency Oscillator — slow modulation source
    Delay = 6,  // Delay line — echo, also foundation for chorus/flanger
    Distortion = 7,  // Waveshaper — harmonic distortion / saturation
    Mixer = 8,  // Sums multiple input signals
    Reverb = 9,  // Freeverb or convolution reverb
    DrumVoice = 10, // Synthesized drum (808/909 style)
    Output = 11, // Terminal node — writes to the final audio output buffer
}
```

### InstrumentDef

An instrument is a **configuration**, not code. It describes a subgraph of the DSP Kernel plus its associated data:

```rust
/// A complete instrument definition.
/// Created on the main thread. Loaded into the Kernel graph.
/// The audio thread traverses it to produce sound.
pub struct InstrumentDef {
    /// Human-readable name ("Warm Pad", "808 Kick", "Grand Piano")
    pub name: String,

    /// The processors that form this instrument's signal chain.
    /// Order matters: processed top-to-bottom during audio rendering.
    pub processors: Vec<ProcessorDef>,

    /// Connections between processors (which output feeds which input).
    pub routes: Vec<RouteDef>,

    /// LUT references: wavetable IDs, waveshaping curve IDs
    pub lut_refs: Vec<LutRef>,

    /// For sample-based instruments: SFZ mapping + sample file paths
    pub sample_map: Option<SfzMapping>,
}

/// One processor in the instrument graph.
pub struct ProcessorDef {
    pub kind: ProcessorKind,
    /// Initial parameter values (written to node attrs on load)
    pub params: Vec<(ParamId, f32)>,
    /// Structural config (written to node meta on load)
    pub config: Vec<(ConfigId, i32)>,
}

/// A signal route between two processors.
pub struct RouteDef {
    pub source: usize, // index into processors[]
    pub target: usize,
    pub gain: f32,     // initial route gain (synapse attr)
}
```

Example instrument definition (conceptual):

```
Instrument "Acid Bass" = {
    processors: [
        { kind: WavetableOsc, params: { wavetable_id: 3, frame_pos: 0.0 } },
        { kind: SVFilter, params: { cutoff: 800.0, resonance: 8.0, mode: LP } },
        { kind: Envelope, params: { A: 0.01, D: 0.3, S: 0.0, R: 0.05 } },  // filter env
        { kind: Envelope, params: { A: 0.005, D: 0.1, S: 0.7, R: 0.2 } },  // amp env
        { kind: Amplifier, params: { gain: 1.0 } },
        { kind: Distortion, params: { drive: 2.0, type: tanh } },
        { kind: Output },
    ],
    routes: [
        { source: 0, target: 1 },  // osc → filter
        { source: 1, target: 4 },  // filter → amp
        { source: 2, target: 1, param: cutoff, depth: 4000.0 },  // filter env → filter cutoff
        { source: 3, target: 4, param: gain },   // amp env → amp gain
        { source: 4, target: 5 },  // amp → distortion
        { source: 5, target: 6 },  // distortion → output
    ],
}
```

---

## A2. Multi-Timbral Architecture

**Multi-timbral** means the DSP Engine produces multiple different instruments simultaneously — e.g., a bass synth, a
pad, and drums all playing at once within the same engine instance.

### How It Works

The DSP Kernel graph contains **multiple instrument subgraphs** simultaneously. Each instrument definition is loaded as
a group of nodes + synapses. They share the same Kernel instance but occupy different node slots.

```
DSP Kernel Graph:
┌──────────────────────────────────────────────────────────┐
│  Instrument 0 ("Bass")                                    │
│  [WavetableOsc₀] → [SVFilter₀] → [Amp₀] → [Output₀]    │
│                                                           │
│  Instrument 1 ("Pad")                                     │
│  [WavetableOsc₁] → [SVFilter₁] → [Amp₁] → [Output₁]    │
│                                                           │
│  Instrument 2 ("Drums")                                   │
│  [DrumVoice₂] → [Output₂]                                │
│                                                           │
│  [Mixer] ← Output₀, Output₁, Output₂ → [MasterOut]      │
└──────────────────────────────────────────────────────────┘
```

### Voice Distribution

128 total voices are **shared across all instruments**. The VoiceAllocator tracks which instrument each voice belongs
to:

```rust
pub struct VoiceAllocator {
    active: [bool; 128],
    note: [u8; 128],
    velocity: [u8; 128],
    age: [u32; 128],
    instrument_id: [u16; 128],  // which instrument this voice belongs to
    global_age: u32,
}
```

Voice stealing considers instrument identity: when stealing, prefer to steal from the instrument with the most active
voices, not just the globally oldest voice. This prevents one busy instrument from starving another.

### Entry Store Layout

Per-voice state is stored in Entry Stores. Each instrument's processors contribute state per voice. Since all
instruments share the same Entry Store, the core_stride must accommodate the **largest** instrument's per-voice state:

```
Entry Store slot layout (per voice):
┌────────────┬────────────┬──────────┬─────────┬─────┐
│ OscState   │ FilterState│ Env0State│Env1State│ ... │
│ (3 slots)  │ (4 slots)  │ (4 slots)│(4 slots)│     │
└────────────┴────────────┴──────────┴─────────┴─────┘
```

Alternative (if instruments have very different state sizes): use **separate Entry Stores per instrument type**. The
Kernel supports multiple Entry Stores via `STORE_COUNT`. This avoids wasting memory when one instrument needs 20 state
slots and another needs 5.

---

## A3. Audio Buffer Routing

### How Audio Flows Between Nodes

Each processor node in the Kernel graph has associated audio buffers. These are **pre-allocated at engine initialization
** — zero allocation on the audio thread.

```rust
/// Pre-allocated buffer pool. One output buffer per node in the graph.
pub struct BufferPool {
    buffers: Vec<AudioBuffer>,  // indexed by node slot
}

pub struct AudioBuffer {
    data: Vec<f32>,   // capacity = max_buffer_size, allocated once
    len: usize,       // actual samples this block
}
```

### Processing Order

The audio thread processes nodes in **topological order** (dependencies first). The Kernel's linked-list node chain must
be sorted so that:

1. Oscillators/sources process first (they have no audio input)
2. Filters process after their input oscillator
3. Amplifiers process after their envelope
4. Effects process after their input
5. Output/mixer processes last

This ordering is established when the instrument is loaded into the Kernel graph. The node chain order IS the processing
order.

### Multi-Input Mixing

When a processor has multiple incoming synapses (e.g., a mixer receiving from 3 sources), the inputs are **summed**
before processing:

```rust
fn gather_input(mirror: &EpochMirror, node_slot: usize, buffers: &BufferPool) -> &AudioBuffer {
    let node = mirror.get_node(node_slot);
    let mut input_buf = buffers.get_scratch(); // zeroed scratch buffer

    // Walk incoming synapse chain
    let mut syn_slot = node.get_incoming_synapse_head();
    while syn_slot != 0 {
        let syn = mirror.get_synapse(syn_slot);
        let source_slot = syn.get_source_ptr();
        let gain = f32::from_bits(syn.attr_read(0) as u32); // route gain

        // Accumulate: input += source_output * gain
        let source_buf = buffers.get(source_slot);
        for i in 0..input_buf.len {
            input_buf.data[i] += source_buf.data[i] * gain;
        }

        syn_slot = syn.get_incoming_next_ptr();
    }
    input_buf
}
```

---

## A4. Complete Signal Flow: Note-On to Audio Output

Step-by-step, what happens when SymphonyEngine says "play C4 at velocity 100 on instrument 0":

```
1. EVENT: note_on(instrument=0, note=60, velocity=100)
   │
2. VOICE ALLOCATOR: Find free voice slot (or steal oldest)
   │  voice_slot = 17 (example)
   │  active[17] = true
   │  note[17] = 60
   │  velocity[17] = 100
   │  instrument_id[17] = 0
   │  age[17] = global_age++
   │
3. INITIALIZE VOICE STATE (Entry Store, slot 17):
   │  osc_phase = 0.0
   │  osc_frame_pos = instrument.params.frame_pos
   │  filter_ic1eq = 0.0
   │  filter_ic2eq = 0.0
   │  amp_env_stage = Attack
   │  amp_env_level = 0.0
   │  filter_env_stage = Attack
   │  filter_env_level = 0.0
   │
4. AUDIO THREAD (called every buffer, e.g., every 2.9ms at 44.1kHz/128 samples):
   │
   │  For each active voice (voice_slot=17):
   │    freq = midi_to_hz(60) = 261.63 Hz
   │    │
   │    ├─ WAVETABLE OSC: for each sample in buffer:
   │    │    mip_level = select_mip(freq, sample_rate)
   │    │    output[i] = wavetable.read_bilinear(mip_level, frame_pos, phase)
   │    │    phase += freq / sample_rate
   │    │
   │    ├─ FILTER ENVELOPE: for each sample:
   │    │    env_value = envelope_tick(filter_env_state, filter_env_params)
   │    │    cutoff = base_cutoff + env_value * mod_depth
   │    │
   │    ├─ SVF FILTER: for each sample:
   │    │    coeffs = compute_svf_coeffs(cutoff, resonance, sample_rate, LP)
   │    │    output[i] = svf_tick(filter_state, osc_output[i], coeffs)
   │    │
   │    ├─ AMP ENVELOPE: for each sample:
   │    │    amp = envelope_tick(amp_env_state, amp_env_params)
   │    │
   │    ├─ AMPLIFIER: for each sample:
   │    │    output[i] = filter_output[i] * amp * (velocity / 127.0)
   │    │
   │    └─ ACCUMULATE into instrument output buffer
   │
   │  Mix all instrument outputs → master output buffer
   │  Send master buffer to audio hardware (cpal / WebAudio / plugin host)
   │
5. EVENT: note_off(note=60)
   │  Find voice playing note 60 → slot 17
   │  amp_env_stage = Release
   │  (voice continues producing sound during release tail)
   │
6. VOICE DEACTIVATION:
   │  When amp_env_level < 0.0001 (inaudible):
   │  active[17] = false
   │  Voice slot 17 is now available for reuse.
```

---

## A5. Why f32 (Not f64)

The RFC uses `f32` for all audio. Rationale:

- **f32 dynamic range**: ~144 dB (ratio between largest and smallest representable values). Human hearing spans ~120 dB.
  f32 exceeds perceptual limits.
- **Memory bandwidth**: f32 = 4 bytes. f64 = 8 bytes. Half the cache pressure. Audio processing is
  memory-bandwidth-bound (streaming through large buffers), so this matters.
- **SIMD width**: x86 SSE processes 4 × f32 or 2 × f64 per instruction. f32 gives 2x throughput on vectorizable loops.
- **Industry standard**: Every major DAW and plugin SDK uses f32 for audio buffers (VST3, CLAP, CoreAudio). f64 is
  sometimes used for accumulation or coefficient calculation, but sample data is always f32.

Exception: `f64` for **phase accumulators** in oscillators. Over millions of samples, f32 phase accumulation (adding
`freq/sample_rate` every sample) loses precision due to floating-point error. At 44.1kHz, a 1Hz oscillator accumulates
44,100 additions per second. After hours of playback, f32 drift becomes audible as pitch instability. f64 eliminates
this. The sample player uses `f64` position for the same reason.

---

## A6. Why GPU Is Not Viable for Audio DSP

Discussed during synthesis method selection (the question: "additive is CPU-heavy, can it rely on GPU?").

**GPU audio does not work for real-time synthesis because:**

1. **Latency**: GPU compute requires: CPU → upload data to GPU memory → dispatch kernel → GPU processes → download
   results to CPU memory. This round-trip takes 1-10ms depending on hardware/driver, and is **unpredictable** (varies
   frame to frame). Audio needs **guaranteed** latency < 5ms. One late buffer = audible click.

2. **Granularity mismatch**: GPUs excel at processing millions of independent items (pixels, vertices). An audio buffer
   is 128-512 samples — too small to saturate GPU parallelism. The overhead of launching a GPU compute pass exceeds the
   time to just process 128 samples on the CPU.

3. **Driver variability**: GPU drivers are optimized for graphics workloads. Compute scheduling is best-effort, not
   real-time. There is no equivalent of audio thread priority on the GPU.

4. **Platform support**: WebGPU compute shaders are not universally available in browsers. WebAudio runs on the CPU. GPU
   audio would only work on native, breaking the cross-platform goal.

5. **No industry precedent**: Zero commercial DAWs or synthesizers use GPU for real-time audio synthesis. This is not
   because nobody thought of it — it's because the latency constraints make it fundamentally incompatible.

GPU *could* work for **offline** audio processing (rendering a 10-minute track to file, not real-time). But that's a
future optimization, not an architecture decision.

---

## A7. Considered and Rejected Options

Decisions made during RFC development. Documented here so they are not revisited without new information.

### Rejected: GPU-Accelerated Synthesis

- **Reason**: Latency incompatible with real-time audio. See §A6.
- **Revisit when**: Never for real-time. Possibly for offline rendering in v3+.

### Rejected: Buying Commercial Sample Licenses

- **Reason**: Most commercial libraries (Spitfire, Kontakt) prohibit redistribution. "Developer licenses" exist but are
  expensive ($1,000-$10,000+) with variable terms. Free CC0 alternatives exist for orchestral/piano. Users who need
  studio quality bring their own samples via SFZ.
- **Revisit when**: User feedback indicates free sample quality is a barrier to adoption AND revenue justifies the
  investment.

### Rejected: Building Custom Algorithmic Reverb (Non-Freeverb)

- **Reason**: Choosing delay lengths and diffusion parameters for a reverb that sounds "good" requires perceptual
  tuning. Violates the perceptual verification principle. Freeverb uses **published, pre-tuned constants** —
  implementing it requires no ear-based decisions.
- **Revisit when**: Team includes someone with DSP and acoustics expertise.

### Rejected: Additive Synthesis in V1

- **Reason**: CPU cost (50-200+ sine generators × 128 voices = 6,400-25,600 generators). GPU is not viable (§A6). Niche
  use case — wavetable synthesis covers most of the same ground with a fraction of the CPU cost.
- **Revisit when**: Specific user demand, or after implementing wavetable resynthesis (analyze a sound's harmonics →
  store as wavetable frames — achieving additive-like flexibility at wavetable cost).

### Rejected: Synthesizing Realistic Acoustic Instruments (Piano, Bowed Strings)

- **Reason**: Physical modeling algorithms are published, but realistic results require extensive perceptual tuning of
  parameters (hammer hardness curves for piano, bow friction models for strings). Violates verification principle.
- **Approach instead**: Sample playback with CC0/CC-BY recordings. The sample player is mathematically verifiable. Sound
  quality depends on recording quality (a data problem, not an engineering problem).
- **Revisit when**: Team includes someone with acoustics expertise, OR AI tools advance to where perceptual quality can
  be evaluated programmatically.

### Rejected: Building Spectral Effects and Vocoder in V1

- **Reason**: FFT-based spectral manipulation has perceptual edge cases — windowing artifacts, phase coherence issues,
  band count tuning. These require listening to evaluate. Deferring to v2+.
- **Revisit when**: Core synthesis and effects are stable and tested.

### Accepted with Caveat: Karplus-Strong for Guitar (V2)

- **Decision**: Basic plucked string (Karplus-Strong) is mathematically verifiable (pitch = sample_rate / delay_length,
  verifiable via FFT). However, making it sound like a **guitar** (vs. a generic pluck) requires convolving with a *
  *guitar body impulse response (IR)**. The IR is data (a recording of how the guitar body resonates), not tuning — same
  concept as convolution reverb. Free/CC0 guitar body IRs exist or can be recorded.
- **Architecture**: `[KarplusStrong] → [ConvolutionReverb with guitar body IR] → output`. The convolution reverb
  infrastructure (built for room reverb in v1) is reused. The only new component is the Karplus-Strong
  delay-with-feedback, which is trivial (~30 lines).
- **Timeline**: V2, after convolution reverb is proven stable.

## 9. V1 vs V2+ Scope

### V1: Ship This

- DSP graph engine wrapping Kernel
- Voice allocator (128 voices, oldest-first stealing)
- Wavetable oscillator with mip-mapped anti-aliasing
- SVF filter (Cytomic — LP/HP/BP/Notch)
- ADSR envelope (linear + exponential curves)
- LFO (sine, triangle, saw, square, sample-and-hold)
- Parameter smoothing (one-pole lowpass)
- Sample player + SFZ format parser
- Delay line with cubic Hermite interpolation
- Chorus, flanger (built on delay line)
- Distortion / waveshaper (tanh, soft-clip, tube) with 2x oversampling
- Freeverb algorithmic reverb
- Convolution reverb (partitioned overlap-add)
- Drum synthesis (808/909 style)
- Factory wavetable library (procedurally generated)
- Factory synth presets (graph configs)

### V2+: Deferred

| Component                                     | Why deferred                                                                                             |
|-----------------------------------------------|----------------------------------------------------------------------------------------------------------|
| FM synthesis                                  | Niche. Unintuitive to design sounds with. Add when v1 stable.                                            |
| Granular synthesis                            | Needs sample infrastructure + perceptual tuning of grain parameters.                                     |
| Physical modeling (Karplus-Strong, waveguide) | Algorithms published, but realistic tuning (guitar body, piano soundboard) needs ears. Basic pluck = v2. |
| Spectral effects (freeze, blur, shift)        | Windowing artifacts need perceptual evaluation.                                                          |
| Vocoder                                       | Band count and envelope speed tuning is perceptual.                                                      |
| Parametric EQ (multi-band)                    | Simple but not essential for v1 instruments. Mixing tool.                                                |
| Compressor / limiter                          | Mixing/mastering tool, not synthesis.                                                                    |
| Additive synthesis                            | CPU-heavy (50-200+ sine generators per voice × 128 voices). Niche use case.                              |

---

## 10. Open Questions

> [!IMPORTANT]
> **Q1: SymphonyEngine → DSP Engine event protocol.** What mechanism delivers musical events (note on/off, parameter
> changes, tempo) from SymphonyEngine's Kernel instance to the DSP Engine's Kernel instance? Options: lock-free ring
> buffer, shared atomic event queue, or a third Kernel instance acting as an event bus. This is the most critical
> architectural decision not yet resolved.

> [!IMPORTANT]
> **Q2: Instrument hot-swap.** When a clip changes its instrument reference mid-playback, does the DSP Engine: (a) cut
> immediately to the new instrument, (b) crossfade over N ms, or (c) let existing voices finish on the old instrument
> while new notes use the new one? Option (c) is simplest and avoids clicks.

> [!NOTE]
> **Q3: Wavetable format.** Define a custom `.sswt` format (simple: header + f32 frames) or support existing formats (
> Serum `.fxp`, Vital `.vitaltable`) for ecosystem compatibility? Custom is simpler to implement; existing formats let
> users import wavetables they already own.

> [!NOTE]
> **Q4: Plugin hosting (v3+).** Should SymphonyScript eventually host third-party VST3/CLAP plugins as nodes in the DSP
> graph? Massive scope expansion but enables access to the entire existing instrument ecosystem. Explicitly deferred —
> noted here for future planning only.
