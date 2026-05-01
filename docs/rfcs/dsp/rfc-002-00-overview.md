# RFC-002: DSP Engine — Implementation Blueprint

## Status: Draft

**References:**
- [RFC-001-01: Architecture & Design Principles](rfc-001-01-dsp-engine.md)
- [RFC-001-02: Component Specifications](rfc-001-02-components.md)

**Purpose:** AI-translatable blueprint. Each component section is self-contained and can be implemented
independently by an AI agent given only this document and the Kernel source code.

---

## 1. Crate Architecture

```
packages/
├── synaptic-kernel/          — existing, read-only dependency
├── symphony-dsp/             — THIS CRATE: core DSP engine
│   ├── src/
│   │   ├── lib.rs
│   │   ├── engine.rs         — DspEngine struct (Kernel wrapper)
│   │   ├── voice.rs          — VoiceAllocator + VoiceState
│   │   ├── buffer.rs         — AudioBuffer + BufferPool
│   │   ├── dispatch.rs       — process_block: per-node processor dispatch
│   │   ├── types.rs          — ProcessorKind, f32/i32 helpers, param IDs
│   │   ├── processors/
│   │   │   ├── mod.rs
│   │   │   ├── wavetable_osc.rs
│   │   │   ├── svf_filter.rs
│   │   │   ├── envelope.rs
│   │   │   ├── lfo.rs
│   │   │   ├── amplifier.rs
│   │   │   ├── delay_line.rs
│   │   │   ├── distortion.rs
│   │   │   ├── chorus.rs
│   │   │   ├── flanger.rs
│   │   │   ├── freeverb.rs
│   │   │   ├── convolution.rs
│   │   │   ├── drum_voice.rs
│   │   │   ├── sample_player.rs
│   │   │   └── mixer.rs
│   │   ├── sfz/
│   │   │   ├── mod.rs
│   │   │   └── parser.rs
│   │   ├── wavetable/
│   │   │   ├── mod.rs
│   │   │   ├── generator.rs  — offline wavetable generation
│   │   │   └── data.rs       — WavetableBank, MipMappedWavetable
│   │   ├── instrument.rs     — InstrumentDef, InstrumentLoader
│   │   └── wav_writer.rs     — render-to-WAV for testing
│   ├── tests/
│   └── Cargo.toml
│
├── symphony-dsp-cpal/        — standalone audio output via cpal
├── symphony-dsp-plugin/      — VST3/CLAP via nih-plug
└── symphony-dsp-wav/         — offline render-to-file
```

**Instrument crates (separate repos or workspace members):**
```
symphonyscript-instruments-synth/      — wavetable presets
symphonyscript-instruments-drums/      — 808/909 presets
symphonyscript-instruments-acoustic/   — CC0 samples + SFZ mappings
```

---

## 2. Kernel Configuration for DSP Engine

The DSP Engine uses the Kernel with **minimal primitives**. Voice state and large audio data live
outside the Kernel.

### Const Generics

```rust
type DspKernel = Kernel<0, 0, 0>;
//                      │  │  │
//                      │  │  └─ LUT_COUNT = 0    (wavetable data stored externally)
//                      │  └──── STORE_COUNT = 0  (voice state is audio-thread-local)
//                      └─────── TB_COUNT = 0     (use default TB only)
```

**Why zero user TBs, stores, LUTs:**

| Primitive | Why not used | Where data lives instead |
|---|---|---|
| User TB | No data needs independent publish cycles in v1 | Default TB suffices |
| Entry Store | Voice state is written BY the audio thread, not TO it | Audio-thread-local `VoiceState` arrays |
| LUT | Wavetable data is too large for triple-buffered LUTs (a single wavetable = 2048 × 256 frames = 524K i32 × 3 buffers) | `Arc<Vec<f32>>` — immutable after load, safe to share |

### Network Config

```rust
NetworkConfig {
    node_capacity: 64,         // 64 processor nodes (expandable via grow())
    node_meta_stride: 4,       // 4 i32 slots per node on TB (structural config)
    node_attr_stride: 8,       // 8 i32 slots per node on MEM (modulatable params)
    synapse_capacity: 128,     // 128 audio routes
    synapse_meta_stride: 4,    // 4 i32 slots per synapse on TB
    synapse_attr_stride: 4,    // 4 i32 slots per synapse on MEM
}
```

### Node Meta Layout (TB — structural, publish/swap)

All processor types share the same 4-slot meta layout. Slots are interpreted per `ProcessorKind`:

```
meta[0]: sub_type
         - SVFilter: filter_mode (0=LP, 1=HP, 2=BP, 3=Notch, 4=Peak, 5=Allpass)
         - Distortion: dist_type (0=tanh, 1=hard_clip, 2=tube)
         - DrumVoice: drum_type (0=kick, 1=snare, 2=hihat_closed, 3=hihat_open, 4=clap, 5=tom)
         - Envelope: curve_type (0=exponential, 1=linear)
         - LFO: shape (0=sine, 1=triangle, 2=saw, 3=square, 4=sample_and_hold)
meta[1]: wavetable_bank_index (WavetableOsc only — index into WavetableBank)
meta[2]: reserved
meta[3]: reserved
```

### Node Attr Layout (MEM — instant modulation, no publish needed)

All processor types share the same 8-slot attr layout. Values are f32 bit-cast to i32:

```
WavetableOsc:  attr[0]=frequency  attr[1]=frame_pos   attr[2]=gain       attr[3..7]=unused
SVFilter:      attr[0]=cutoff_hz  attr[1]=resonance_q  attr[2]=unused     attr[3..7]=unused
Amplifier:     attr[0]=gain       attr[1..7]=unused
Envelope:      attr[0]=attack_s   attr[1]=decay_s      attr[2]=sustain    attr[3]=release_s    attr[4..7]=unused
LFO:           attr[0]=rate_hz    attr[1]=depth         attr[2..7]=unused
Delay:         attr[0]=time_ms    attr[1]=feedback      attr[2]=wet_dry    attr[3..7]=unused
Distortion:    attr[0]=drive      attr[1]=wet_dry       attr[2..7]=unused
Reverb:        attr[0]=room_size  attr[1]=damping       attr[2]=wet_dry    attr[3..7]=unused
DrumVoice:     attr[0]=pitch      attr[1]=decay         attr[2]=noise_mix  attr[3]=pitch_env_depth  attr[4]=pitch_env_time  attr[5..7]=unused
SamplePlayer:  attr[0]=gain       attr[1..7]=unused
Mixer:         attr[0]=gain       attr[1..7]=unused
```

### Synapse Layout

```
Synapse meta (TB):
  meta[0]: route_type (0=audio, 1=control)
  meta[1]: mod_target_param_index (for control-rate: which attr index to modulate)
  meta[2]: mod_depth (f32 bit-cast — modulation scaling factor)
  meta[3]: reserved

Synapse attrs (MEM):
  attr[0]: gain (f32 bit-cast — route gain, default 1.0)
  attr[1]: pan  (f32 bit-cast — -1.0 left, 0.0 center, 1.0 right)
  attr[2..3]: reserved
```

---

## 3. Data Ownership Model

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN THREAD                           │
│                                                          │
│  DspEngine {                                             │
│      kernel: DspKernel,           ← graph topology       │
│      wavetable_bank: WavetableBank, ← Arc<Vec<f32>>     │
│      sample_bank: SampleBank,      ← Arc<Vec<f32>>      │
│      ir_bank: IrBank,              ← Arc<Vec<f32>>       │
│      instrument_defs: Vec<InstrumentDef>,                │
│  }                                                       │
│         │                                                │
│         │ get_control_plane() → Arc<ControlPlane>        │
│         │ clone Arc refs to banks                        │
│         ▼                                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │               AUDIO THREAD                        │    │
│  │                                                    │    │
│  │  DspAudioThread {                                  │    │
│  │      consumer: EpochConsumer<0, 0, 0>,             │    │
│  │      voice_allocator: VoiceAllocator,   ← owned    │    │
│  │      voice_states: [VoiceState; 128],   ← owned    │    │
│  │      buffer_pool: BufferPool,           ← owned    │    │
│  │      processor_states: ProcessorStatePool, ← owned │    │
│  │      wavetable_bank: Arc<WavetableBank>,← shared   │    │
│  │      sample_bank: Arc<SampleBank>,      ← shared   │    │
│  │      ir_bank: Arc<IrBank>,              ← shared   │    │
│  │  }                                                  │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Key invariants:**
- The audio thread **never writes to the Kernel**. It only reads via `EpochConsumer.acquire_mirror()`.
- The audio thread **owns** all mutable state: voice state, processor state, buffers.
- Shared data (wavetable bank, sample bank, IR bank) is `Arc<T>` where `T` is immutable after creation.
  No mutation = no synchronization.
- When the main thread wants to change wavetable/sample data, it creates a NEW `Arc<T>` and the audio
  thread picks it up via an atomic pointer swap (single `AtomicPtr` or `ArcSwap`).

---

## 4. Conventions

### f32 ↔ i32 Bit-Casting

The Kernel stores all values as `i32`. DSP parameters are `f32`. Every read/write requires bit-casting.

```rust
// In types.rs:

/// Convert f32 to i32 for Kernel storage. Zero-cost bit reinterpretation.
#[inline(always)]
pub fn f32_to_i32(v: f32) -> i32 {
    v.to_bits() as i32
}

/// Convert i32 from Kernel storage to f32. Zero-cost bit reinterpretation.
#[inline(always)]
pub fn i32_to_f32(v: i32) -> f32 {
    f32::from_bits(v as u32)
}
```

All component blueprints use `f32_to_i32` / `i32_to_f32` — never raw `.to_bits()` / `.from_bits()`.

### ProcessorKind Enum

```rust
#[repr(i32)]
pub enum ProcessorKind {
    WavetableOsc  = 0,
    SamplePlayer  = 1,
    SVFilter      = 2,
    Amplifier     = 3,
    Envelope      = 4,
    LFO           = 5,
    Delay         = 6,
    Distortion    = 7,
    Mixer         = 8,
    Reverb        = 9,
    DrumVoice     = 10,
    Output        = 11,
}
```

Stored as the node's `kind` field via `kernel.insert_head_node(ProcessorKind::SVFilter as i32)`.
Read on audio thread via `node.get_kind()`.

### Naming Convention

- Structs: `PascalCase` — `SvfFilter`, `WavetableOsc`, `DrumVoice`
- Process function: `process_<name>(state, params, input, output, buffer_size)`
- State struct: `<Name>State` — `SvfFilterState`, `EnvelopeState`
- Param reading: `<Name>Params::read_from_node(node: &NodeReader)` — reads attrs, returns typed params

### Test Convention

Each processor has:
1. **Unit test**: process known input, assert output mathematically (FFT, amplitude bounds, timing)
2. **Stability test**: process 10M samples at extreme parameters, assert no NaN/Inf/overflow
3. **WAV render test** (optional): render 2 seconds to WAV file for manual listening

---

## 5. Phases

### Phase 1: Core Infrastructure
- **C01** `DspEngine` — Kernel wrapper, lifecycle, main-thread API
- **C02** `AudioBuffer` + `BufferPool` — pre-allocated audio buffers
- **C03** `VoiceAllocator` + `VoiceState` — 128-voice management
- **C04** `DspAudioThread` + `process_block` — audio thread entry point, processor dispatch

### Phase 2: Synthesis Primitives
- **C05** `ParameterSmoother` — one-pole lowpass for click-free parameter changes
- **C06** `Envelope` (ADSR) — exponential/linear envelope generator
- **C07** `LFO` — low-frequency oscillator (5 shapes)
- **C08** `WavetableOsc` — mip-mapped wavetable oscillator
- **C09** `SvfFilter` — Cytomic linear trapezoidal SVF

### Phase 3: Effects
- **C10** `DelayLine` — circular buffer with cubic interpolation
- **C11** `Distortion` + `Oversampler` — waveshaping with 2x oversampling
- **C12** `Chorus` — delay + LFO modulation
- **C13** `Flanger` — short delay + feedback + LFO
- **C14** `Freeverb` — Jezar's algorithmic reverb
- **C15** `ConvolutionReverb` — partitioned overlap-add

### Phase 4: Sample Playback
- **C16** `SfzParser` — parse SFZ text format
- **C17** `SamplePlayer` — pitch-shifted sample playback

### Phase 5: Drum Synthesis
- **C18** `DrumVoice` — 808/909-style synthesized drums

### Phase 6: Offline Tools
- **C19** `WavetableGenerator` — procedural wavetable generation via additive synthesis
- **C20** `WavWriter` — render audio to WAV files for testing

### Phase 7: Integration
- **C21** `InstrumentDef` + `InstrumentLoader` — load instrument configs into Kernel graph

---

## 6. Kernel API Quick Reference

For AI agents implementing components. All methods are on `Kernel<0, 0, 0>` (producer) or
`EpochMirror<0, 0, 0>` (consumer/audio thread).

### Producer (main thread):

```rust
// Topology
kernel.insert_head_node(kind: i32) -> Result<usize, KernelError>    // returns node slot
kernel.insert_node_after(prev: usize, kind: i32) -> Result<usize>
kernel.remove_node(slot: usize) -> Result<()>
kernel.connect(source: usize, target: usize, kind: i32) -> Result<usize>  // returns synapse slot
kernel.disconnect(source: usize, target: usize) -> Result<()>

// Node access
kernel.get_node(slot: usize) -> NodeHandle      // read core (kind, ptrs), read/write meta + attrs
node.get_kind() -> i32
node.get_meta(offset: usize) -> i32              // TB plane — needs publish
node.set_meta(offset: usize, value: i32)
node.attr_read(offset: usize) -> i32             // MEM plane — instant
node.attr_write(offset: usize, value: i32)

// Synapse access
kernel.get_synapse(slot: usize) -> SynapseView
// (same meta/attr pattern as nodes)

// MEM metadata (global)
kernel.mem_read_meta(offset: usize) -> i32
kernel.mem_write_meta(offset: usize, value: i32)

// Lifecycle
kernel.publish()                                  // deploy TB changes to consumer
kernel.get_control_plane() -> Arc<ControlPlane>   // for constructing EpochConsumer
```

### Consumer (audio thread):

```rust
let mirror = consumer.acquire_mirror();           // swap + get current graph

// Node traversal
mirror.get_head_node() -> Option<NodeReader>
mirror.get_node(slot: usize) -> NodeReader
node.get_kind() -> i32
node.get_next_ptr() -> usize                      // walk linked list
node.get_meta(offset: usize) -> i32               // TB plane (swapped)
node.attr_read(offset: usize) -> i32              // MEM plane (instant)
node.get_outgoing_synapse_head() -> usize
node.get_incoming_synapse_head() -> usize

// Synapse traversal
mirror.get_synapse(slot: usize) -> SynapseReader
synapse.get_source_ptr() -> usize
synapse.get_target_ptr() -> usize
synapse.get_outgoing_next_ptr() -> usize          // walk synapse chain
synapse.get_incoming_next_ptr() -> usize
synapse.get_meta(offset: usize) -> i32
synapse.attr_read(offset: usize) -> i32

// MEM metadata
mirror.mem_read_meta(offset: usize) -> i32
```
