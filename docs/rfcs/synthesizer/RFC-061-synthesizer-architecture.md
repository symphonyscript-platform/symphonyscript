# RFC-061: Synthesizer Architecture — Block-Based Modular Engine

**Status**: PROPOSED  
**Priority**: HIGH  
**Author**: Architect  
**Created**: 2026-03-12  
**Depends On**: RFC-043 (Silicon Linker), RFC-044 (Command Ring), RFC-045 (Zero-Alloc), RFC-050 (Synapsis)

## 1. Abstract

This RFC defines the architecture for SymphonyScript's synthesizer engine: a block-based modular audio graph that compiles to a flat execution plan at composition time and runs zero-allocation at audio time. The engine is platform-agnostic (pure typed-array math), Rust-portable, and supports mono through surround channel configurations as first-class citizens.

The synthesizer sits between the kernel (which manages musical events in a SharedArrayBuffer) and the platform audio output (WebAudio today, native audio tomorrow). The kernel sends note events. The synthesizer produces PCM.

## 2. Motivation

### 2.1 Current State

The kernel is complete: a zero-allocation, lock-free event scheduler that manages musical events in a SharedArrayBuffer with microsecond-level patch latency. But there is no audio rendering layer. Notes exist as data structures — they make no sound.

### 2.2 Requirements

1. **Modular**: Users wire individual DSP units (oscillator → filter → envelope → output) into custom signal paths.
2. **High-performance**: Block-based processing with compiled execution plans. No per-sample function dispatch. No dynamic dispatch in the hot loop.
3. **Multi-channel**: Surround sound (5.1, 7.1, Atmos-style channel beds) is a priority, not an afterthought. Mono and stereo are subsets.
4. **Rust-portable**: Every interface is expressed in terms of numeric primitives and typed arrays. No closures, no objects, no strings in the audio path. TypeScript interfaces map directly to Rust traits.
5. **Platform-agnostic**: The engine knows nothing about WebAudio, AudioWorklet, or any browser API. A thin adapter at the edge handles platform concerns.

### 2.3 Non-Goals

- Real-time graph mutation from the audio thread (graphs are compiled, not interpreted).
- Plugin hosting (VST/AU/CLAP). The engine *is* the plugin format.
- MIDI I/O. The kernel already handles event scheduling.

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        @symphonyscript/web                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Platform Adapter (AudioWorklet)                           │  │
│  │  - Reads kernel SAB (note events, playhead, BPM)           │  │
│  │  - Dispatches note on/off to engine                        │  │
│  │  - Copies engine output buffers → WebAudio output          │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
└────────────────────────────┼─────────────────────────────────────┘
                             │ note events + render()
┌────────────────────────────┼─────────────────────────────────────┐
│                   @symphonyscript/dsp                             │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │  Engine                                                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │  │
│  │  │ Voice    │  │ Voice    │  │ Voice    │  (voice pool)     │  │
│  │  │ Allocator│  │ Allocator│  │ Allocator│                   │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │  │
│  │       │              │              │                        │  │
│  │  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐                  │  │
│  │  │ Compiled │  │ Compiled │  │ Compiled │  (execution plan) │  │
│  │  │ Graph    │  │ Graph    │  │ Graph    │                   │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │  │
│  │       │              │              │                        │  │
│  │  ┌────▼──────────────▼──────────────▼──────────────────┐    │  │
│  │  │  Mixer (per-instrument gain/pan → master bus)       │    │  │
│  │  │  Send Buses (shared effects: reverb, delay)         │    │  │
│  │  └─────────────────────┬───────────────────────────────┘    │  │
│  │                        │ multi-channel PCM                  │  │
│  └────────────────────────┼────────────────────────────────────┘  │
└────────────────────────────┼─────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                 @symphonyscript/synthesis                         │
│  Pre-built instrument factories:                                 │
│  - SubtractiveSynth(options) → compiled graph                    │
│  - FMSynth(options) → compiled graph                             │
│  - (future: Sampler, WavetableSynth, PhysicalModel)              │
└──────────────────────────────────────────────────────────────────┘
```

## 4. Core Concepts

### 4.1 Module

A **Module** is the atomic unit of DSP. It reads from input ports, writes to output ports, and exposes parameters. Every oscillator, filter, envelope, LFO, amplifier, and effect is a Module.

Modules are stateful (they hold phase accumulators, filter coefficients, delay lines) but their state is stored in pre-allocated typed arrays. No heap allocation occurs during `process()`.

### 4.2 Port

A **Port** is a typed connection point on a Module. Ports carry either:

- **Audio-rate** signals: a full buffer of `blockSize × channelCount` samples. Changes per sample.
- **Control-rate** signals: a single scalar value per block. Broadcast to all samples when consumed.

The port declares its rate and channel count. The graph compiler uses this metadata to allocate buffers and insert channel-count adapters where mismatches occur.

### 4.3 Graph

A **Graph** is a directed acyclic collection of Modules connected by wires (port-to-port). The graph is defined at composition time and is immutable at audio time.

### 4.4 Compiled Plan

The graph compiler performs a topological sort of the graph and produces a **Plan**: a flat array of execution steps. Each step is a struct: `{ moduleId, inputBufferOffsets[], outputBufferOffsets[], parameterOffsets[] }`. The plan executor walks this array linearly — no pointer chasing, no vtable lookups, no hash map queries.

### 4.5 Voice

A **Voice** is an instance of a compiled graph that processes one concurrent note. An instrument has a pool of voices. When a note-on arrives, a voice is allocated from the pool; on note-off, the voice enters its release phase and is returned to the pool when silent.

### 4.6 Instrument

An **Instrument** owns a voice pool, a graph template (compiled plan), and instrument-level parameters. It receives note events from the kernel and manages voice lifecycle.

## 5. Interface Specifications

### 5.1 Numeric Constants

```typescript
const enum PortRate {
  AUDIO = 0,
  CONTROL = 1
}

const enum VoiceState {
  IDLE = 0,
  ACTIVE = 1,
  RELEASE = 2
}

const enum ModuleType {
  OSCILLATOR = 0,
  FILTER = 1,
  ENVELOPE = 2,
  AMPLIFIER = 3,
  LFO = 4,
  MIXER = 5,
  PANNER = 6,
  DELAY = 7,
  EFFECT = 8,
  GAIN = 9,
  SPLIT = 10,
  MERGE = 11,
  OUTPUT = 12
}
```

### 5.2 Buffer Descriptor

All audio data flows through buffers described by a channel count and a backing Float32Array. The data layout is **planar**: channel 0 occupies indices `[0, blockSize)`, channel 1 occupies `[blockSize, 2×blockSize)`, and so on.

```typescript
interface AudioBuffer {
  readonly channelCount: number
  readonly blockSize: number
  readonly data: Float32Array  // length = channelCount × blockSize
}
```

Planar layout is chosen over interleaved because:
1. SIMD-friendly — contiguous samples per channel enable vectorized loops.
2. Rust `&[f32]` slicing — each channel is a contiguous slice.
3. Up/down-mix is a buffer copy, not a stride change.

Helper accessors (zero-allocation, computed offset):
```typescript
function channelData(buf: AudioBuffer, ch: number): Float32Array {
  // Returns a subarray view (no allocation)
  const offset = ch * buf.blockSize
  return buf.data.subarray(offset, offset + buf.blockSize)
}
```

### 5.3 Port Descriptor

Ports are declared statically per module type as plain data. No class instances.

```typescript
interface PortDescriptor {
  readonly id: number
  readonly rate: PortRate
  readonly channelCount: number  // 1=mono, 2=stereo, 6=5.1, etc.
  readonly name: string          // debug/UI only, not used at audio time
}
```

### 5.4 Module Interface

The core DSP contract. Every oscillator, filter, envelope, LFO, and effect implements this interface.

```typescript
interface Module {
  readonly type: ModuleType
  readonly id: number

  readonly inputs: readonly PortDescriptor[]
  readonly outputs: readonly PortDescriptor[]

  /**
   * Process one block. All buffers are pre-allocated by the plan executor.
   *
   * @param inputBuffers  - Array of AudioBuffers, one per input port (same order as inputs[])
   * @param outputBuffers - Array of AudioBuffers, one per output port (same order as outputs[])
   * @param blockSize     - Number of samples to process this block
   */
  process(
    inputBuffers: readonly AudioBuffer[],
    outputBuffers: readonly AudioBuffer[],
    blockSize: number
  ): void

  /**
   * Set a parameter by numeric ID. Value semantics are module-defined.
   * Control-rate: takes effect at next process() call.
   */
  setParameter(paramId: number, value: number): void

  /**
   * Read current parameter value.
   */
  getParameter(paramId: number): number

  /**
   * Reset all internal state (phase accumulators, filter history, delay lines).
   * Called when a voice is returned to the pool.
   */
  reset(): void
}
```

**Rust mapping**: `Module` maps to a Rust trait with `process(&mut self, inputs: &[AudioBuffer], outputs: &mut [AudioBuffer], block_size: usize)`. The `readonly` arrays map to `&[T]` slices. `setParameter`/`getParameter` map to indexed access on a `params: [f32; N]` array.

### 5.5 Wire

A wire connects one output port to one input port. Wires are data, not objects.

```typescript
interface Wire {
  readonly sourceModuleId: number
  readonly sourcePortId: number
  readonly targetModuleId: number
  readonly targetPortId: number
}
```

### 5.6 Graph Definition

The graph is a pure data structure. No runtime behavior. This is what the user (or `@symphonyscript/synthesis` factories) constructs.

```typescript
interface GraphDefinition {
  readonly modules: readonly ModuleDefinition[]
  readonly wires: readonly Wire[]
  readonly outputPortModuleId: number  // which module's output is the graph output
  readonly outputPortId: number
}

interface ModuleDefinition {
  readonly id: number
  readonly type: ModuleType
  readonly initialParameters: readonly ParameterValue[]
}

interface ParameterValue {
  readonly paramId: number
  readonly value: number
}
```

### 5.7 Compiled Plan

The output of the graph compiler. A flat, ordered list of execution steps that the plan executor processes linearly.

```typescript
interface CompiledPlan {
  /** Topologically sorted execution order */
  readonly steps: readonly PlanStep[]

  /**
   * Pre-allocated buffer arena.
   * All inter-module buffers live here as a single contiguous Float32Array.
   * Steps reference buffers by byte offset into this arena.
   */
  readonly arena: Float32Array

  /** Buffer metadata for each allocated buffer in the arena */
  readonly bufferDescriptors: readonly BufferDescriptor[]

  /** Total channel count of the graph output */
  readonly outputChannelCount: number
}

interface PlanStep {
  readonly moduleIndex: number
  readonly inputBufferIndices: readonly number[]   // indices into bufferDescriptors
  readonly outputBufferIndices: readonly number[]  // indices into bufferDescriptors
}

interface BufferDescriptor {
  readonly offset: number        // byte offset into arena
  readonly channelCount: number
  readonly blockSize: number
}
```

**Rust mapping**: `CompiledPlan` maps to a struct owning a `Vec<PlanStep>` and a `Vec<f32>` arena. `PlanStep` fields are `u16` indices. The plan executor is a `for step in plan.steps { modules[step.moduleIndex].process(...) }` loop.

### 5.8 Voice Interface

A voice is a live instance of a compiled plan. It owns the module instances and their state.

```typescript
interface Voice {
  readonly state: VoiceState

  /**
   * Trigger a note. The voice enters ACTIVE state.
   * @param frequency  - Fundamental frequency in Hz
   * @param velocity   - Note velocity, 0.0–1.0
   * @param gateOffset - Sample offset within the current block for sample-accurate timing
   */
  noteOn(frequency: number, velocity: number, gateOffset: number): void

  /**
   * Release the note. The voice enters RELEASE state.
   * It continues rendering until the amplitude envelope reaches silence,
   * then transitions to IDLE.
   */
  noteOff(): void

  /**
   * Set a per-voice parameter (e.g., aftertouch, per-note expression).
   */
  setParameter(paramId: number, value: number): void

  /**
   * Render one block into the voice's output buffer.
   * The plan executor runs all steps in the compiled plan.
   * @returns The voice's output AudioBuffer (owned by the voice, valid until next render)
   */
  render(blockSize: number): AudioBuffer

  /**
   * Hard reset. Clears all module state. Transitions to IDLE.
   * Called when the voice is returned to the pool.
   */
  reset(): void
}
```

### 5.9 Voice Allocation Policy

Voice stealing is configurable per instrument. The policy is a stateless function, not an object.

```typescript
const enum StealPolicy {
  OLDEST = 0,      // Steal the voice that has been active longest
  QUIETEST = 1,    // Steal the voice with the lowest current amplitude
  LOWEST = 2,      // Steal the lowest-pitched voice
  HIGHEST = 3,     // Steal the highest-pitched voice
  NONE = 4         // Do not steal; drop the new note
}
```

### 5.10 Instrument Interface

An instrument owns voices and receives note events from the kernel.

```typescript
interface Instrument {
  readonly name: string
  readonly maxVoices: number
  readonly stealPolicy: StealPolicy

  /**
   * Trigger a note.
   * Allocates a voice from the pool (or steals one per policy).
   *
   * @param pitch       - MIDI pitch (0–127)
   * @param velocity    - 0.0–1.0
   * @param gateOffset  - Sample offset for sample-accurate timing
   * @param expressionId - Kernel expression channel (0–15), for MPE-style per-note control
   * @returns Voice index (0..maxVoices-1) or -1 if allocation failed (NONE policy, pool full)
   */
  noteOn(pitch: number, velocity: number, gateOffset: number, expressionId: number): number

  /**
   * Release a note.
   * Finds the voice playing this pitch+expression and triggers noteOff.
   */
  noteOff(pitch: number, expressionId: number): void

  /** Release all active voices. */
  allNotesOff(): void

  /**
   * Set an instrument-level parameter (shared across all voices).
   * e.g., master filter cutoff, global detune.
   */
  setParameter(paramId: number, value: number): void
  getParameter(paramId: number): number

  /**
   * Render one block. Renders all active voices, sums their outputs.
   * @returns The instrument's summed output AudioBuffer
   */
  render(blockSize: number): AudioBuffer

  /** Number of currently active (non-IDLE) voices. */
  getActiveVoiceCount(): number

  /** Reset all voices and instrument state. */
  reset(): void
}
```

### 5.11 Mixer Channel

A mixer channel wraps an instrument with gain, pan, mute, and send levels.

```typescript
interface MixerChannel {
  instrument: Instrument | null
  volume: number       // Linear gain, 0.0–1.0+
  pan: number          // -1.0 (L) to 1.0 (R); for surround, pan encodes azimuth
  muted: boolean
  sendLevels: Float32Array  // One level per send bus, indexed by send ID
}
```

### 5.12 Send Bus

A send bus is a shared effect graph that receives summed input from multiple channels.

```typescript
interface SendBus {
  readonly id: number
  readonly effect: Module         // or a compiled sub-graph for complex effect chains
  readonly outputChannelCount: number

  /** Accumulate input from a channel (called per-channel during render). */
  addInput(input: AudioBuffer, level: number): void

  /** Process the accumulated input through the effect. */
  render(blockSize: number): AudioBuffer

  /** Clear the accumulation buffer for the next block. */
  clear(): void
}
```

### 5.13 Mixer

The top-level mixing stage. Sums all channels and send buses into the master output.

```typescript
interface Mixer {
  readonly masterChannelCount: number  // 2=stereo, 6=5.1, 8=7.1, etc.
  readonly channels: MixerChannel[]
  readonly sends: SendBus[]

  masterVolume: number
  masterPan: number

  /**
   * Render all channels → send buses → master output.
   * @returns The final output AudioBuffer (masterChannelCount channels)
   */
  render(blockSize: number): AudioBuffer

  /** Reset all channels, sends, and master state. */
  reset(): void
}
```

### 5.14 Engine

The top-level entry point for the platform adapter. Owns the mixer and provides the note dispatch interface.

```typescript
interface Engine {
  readonly mixer: Mixer
  readonly sampleRate: number
  readonly blockSize: number

  /**
   * Dispatch a note-on event from the kernel.
   * Routes to the correct instrument channel based on channelId.
   */
  noteOn(channelId: number, pitch: number, velocity: number, gateOffset: number, expressionId: number): void

  /**
   * Dispatch a note-off event.
   */
  noteOff(channelId: number, pitch: number, expressionId: number): void

  /**
   * Dispatch a CC event.
   */
  controlChange(channelId: number, controller: number, value: number): void

  /**
   * Render one block. Calls mixer.render() and returns the master output.
   */
  render(): AudioBuffer

  /** Reset everything. */
  reset(): void
}
```

## 6. Graph Compiler

### 6.1 Input

A `GraphDefinition` (§5.6): a list of module definitions and wires.

### 6.2 Process

1. **Validate**: Ensure no cycles. Ensure port channel counts are compatible (or mark where adapters are needed).
2. **Insert adapters**: Where a mono output connects to a stereo input, insert an implicit up-mix module. Where channel counts decrease, insert a down-mix module.
3. **Topological sort**: Order modules so that every module's inputs are computed before it runs.
4. **Allocate buffers**: Assign arena offsets to every inter-module connection. Reuse buffers where possible (if a buffer is consumed before it's needed again, its arena slot can be recycled).
5. **Emit plan**: Produce a `CompiledPlan` with the sorted steps and the arena.

### 6.3 Output

A `CompiledPlan` (§5.7): ready to be instantiated as a voice or a send bus effect.

### 6.4 Compile-Time Only

The compiler runs on the main thread at composition time. It allocates freely (arrays, maps, sorting). The output (`CompiledPlan`) is a flat struct that the audio thread consumes without allocation.

## 7. Plan Executor

The plan executor is the innermost audio loop. It must be zero-allocation and branchless (beyond the step iteration itself).

```
for each step in plan.steps:
  module = voices[voiceIndex].modules[step.moduleIndex]
  inputs  = resolve(step.inputBufferIndices, plan.arena, plan.bufferDescriptors)
  outputs = resolve(step.outputBufferIndices, plan.arena, plan.bufferDescriptors)
  module.process(inputs, outputs, blockSize)
```

**Performance contract**: The executor does not allocate, does not branch on module type, and does not perform hash lookups. Buffer resolution is pure arithmetic (offset + channelCount × blockSize).

## 8. Multi-Channel Strategy

### 8.1 Channel Configurations

| Name | Channels | Layout (planar order) |
|------|----------|----------------------|
| Mono | 1 | C |
| Stereo | 2 | L, R |
| LCR | 3 | L, C, R |
| Quad | 4 | FL, FR, RL, RR |
| 5.1 | 6 | FL, FR, C, LFE, RL, RR |
| 7.1 | 8 | FL, FR, C, LFE, RL, RR, SL, SR |

### 8.2 Up-Mix / Down-Mix

The graph compiler inserts adapter modules at channel-count boundaries:

- **Mono → Stereo**: Duplicate the mono channel to L and R.
- **Mono → 5.1**: Route to Center channel, zero others.
- **Stereo → 5.1**: L→FL, R→FR, derive Center from (L+R)×0.5, zero LFE/rears.
- **5.1 → Stereo**: Standard ITU-R BS.775 fold-down matrix.
- **N → 1 (down-mix to mono)**: Equal-power sum.

These are regular Module implementations. The compiler generates them automatically; the user never wires them manually.

### 8.3 Panner Module

A dedicated `Panner` module positions a source in the channel field:

- **Stereo mode**: Constant-power L/R pan from a single pan parameter (-1.0 to 1.0).
- **Surround mode**: Azimuth + elevation + spread parameters. Computes per-channel gain coefficients using VBAP (Vector Base Amplitude Panning) or similar.
- **Output channel count** is determined by the downstream connection.

## 9. Voice Lifecycle

```
      noteOn()         amplitude → 0
IDLE ──────────► ACTIVE ──────────────► IDLE
                   │                      ▲
                   │ noteOff()            │ envelope done
                   ▼                      │
                RELEASE ──────────────────┘
```

1. **IDLE → ACTIVE**: `noteOn()` resets all modules, sets oscillator frequency, triggers envelope gate.
2. **ACTIVE → RELEASE**: `noteOff()` releases envelope gate. Voice continues rendering.
3. **RELEASE → IDLE**: When the amplitude envelope output falls below a silence threshold (e.g., -96dB), the voice is marked IDLE and returned to the pool. No audio glitch — the note fades naturally.
4. **Voice stealing**: When the pool is full and a new note arrives, the steal policy selects a victim. The victim is hard-killed (reset) and immediately reused. The amplitude discontinuity is masked by the new note's attack.

## 10. Kernel ↔ Engine Boundary

### 10.1 Data Flow

```
Kernel SAB (events)          Engine SAB (audio state)
┌──────────────────┐         ┌──────────────────────┐
│ HEAD_PTR         │         │ Module parameters    │
│ PLAYHEAD_TICK    │         │ Voice state          │
│ BPM / PPQ        │         │ Buffer arena         │
│ Node chain:      │         │ Output buffers       │
│   pitch          │──event──│                      │
│   velocity       │  bridge │                      │
│   duration       │────────►│                      │
│   baseTick       │         │                      │
│   opcode         │         │                      │
│   expressionId   │         │                      │
└──────────────────┘         └──────────────────────┘
```

### 10.2 Event Bridge (in `@symphonyscript/web`)

The platform adapter reads the kernel SAB each audio block and translates events into engine calls:

```
poll kernel (processCommands)
read BPM, PPQ, PLAYHEAD_TICK
calculate tick range for this block: [startTick, endTick)

traverse kernel chain (getHead → readNodeRaw → NEXT_PTR):
  for each node in chain:
    unpack opcode, pitch, velocity, duration, baseTick, expressionId

    if opcode == NOTE:
      if baseTick in [startTick, endTick):
        sampleOffset = (baseTick - startTick) × samplesPerTick
        engine.noteOn(channelId, pitch, velocity/127, sampleOffset, expressionId)

      endTick_note = baseTick + duration
      if endTick_note in [startTick, endTick):
        engine.noteOff(channelId, pitch, expressionId)

    if opcode == CC:
      engine.controlChange(channelId, ccNum, ccValue)

engine.render()
copy engine output → WebAudio output buffers
advance playhead
```

### 10.3 Channel Mapping

The kernel's linked list is a flat chain of all events. The event bridge must route events to the correct instrument channel. This mapping is established at composition time:

- Each `SynapticClip` in the composer is assigned a `channelId` (0–15).
- Nodes written by that clip carry the clip's `channelId` encoded in the kernel's expression ID field (bits 4–7 of PACKED_A, per RFC-047).
- The event bridge reads `expressionId` and uses it as `channelId` for dispatch.

For MPE (per-note expression within a single instrument), the expression ID is split: upper bits = channel routing, lower bits = voice expression. The exact split is configurable per instrument.

## 11. Modulation Integration (Synapsis — RFC-050)

### 11.1 Parameter Protocol

Synapsis (RFC-050) defines a normalized parameter range of 0–1000 (integer). The engine's `setParameter(paramId, value)` interface is compatible:

- Instrument-level parameters (filter cutoff, LFO rate, global detune) are set via `instrument.setParameter()`.
- Per-voice parameters (aftertouch, per-note filter) are set via `voice.setParameter()`.
- The Synapsis animation system evaluates parameter curves and writes results directly to the engine's parameter slots.

### 11.2 Modulation Bus (Future)

A future extension adds a `ModulationBus` that sits between Synapsis parameter output and module parameter input. It handles:

- Parameter smoothing (de-zipper to avoid clicks on rapid parameter changes).
- Multiple modulation sources summed to a single target (e.g., LFO + envelope both modulating filter cutoff).
- Modulation depth scaling.

This is deferred to Phase 2 and will be specified in a follow-up RFC.

## 12. Package Boundaries

### 12.1 `@symphonyscript/dsp`

The platform-agnostic engine. Contains:

- All interfaces from §5 (`Module`, `Voice`, `Instrument`, `Mixer`, `Engine`, etc.)
- Module primitives: `Oscillator`, `Filter`, `Envelope`, `LFO`, `Amplifier`, `Panner`, `Delay`, `Gain`, `Split`, `Merge`
- Graph compiler (§6)
- Plan executor (§7)
- Voice allocator and steal policies (§5.9)
- Multi-channel up-mix / down-mix modules (§8.2)
- AudioBuffer utilities (`channelData`, `clearBuffer`, `mixBuffers`)

**Zero web API imports. This is what gets ported to Rust.**

### 12.2 `@symphonyscript/synthesis`

Pre-built instrument factories and presets. Contains:

- `createSubtractiveSynth(options)` — Assembles `Oscillator → Filter → Amplifier` with ADSR envelopes on amplitude and filter, returns a compiled `Instrument`.
- `createFMSynth(options)` — Assembles N operators with configurable FM routing matrix, returns a compiled `Instrument`.
- Future: `createSampler()`, `createWavetableSynth()`, `createPhysicalModel()`.
- Preset parameter sets (e.g., "Warm Pad", "Acid Bass", "Electric Piano").

This package depends on `@symphonyscript/dsp`. It is a convenience layer — users can always build instruments manually by wiring modules.

### 12.3 `@symphonyscript/web`

The thin platform adapter. Contains:

- `SiliconProcessor` (AudioWorklet): reads kernel SAB, dispatches to engine, copies output.
- `createSymphonyWorklet()`: factory that registers the processor and sends the SAB.
- Transport controls (play/pause/stop messages).

**The only package that imports browser APIs (`AudioWorkletProcessor`, `AudioContext`).**

## 13. v1 Module Set (Subtractive Synthesis)

| Module | Type | Inputs | Outputs | Parameters |
|--------|------|--------|---------|------------|
| **Oscillator** | Source | — | 1 audio (mono) | `P_FREQUENCY`, `P_DETUNE_CENTS`, `P_WAVEFORM` (sine/saw/square/tri), `P_PULSE_WIDTH` |
| **NoiseGenerator** | Source | — | 1 audio (mono) | `P_NOISE_TYPE` (white/pink) |
| **Envelope** | Control | 1 control (gate) | 1 control | `P_ATTACK`, `P_DECAY`, `P_SUSTAIN`, `P_RELEASE` |
| **Filter** | Processor | 1 audio, 1 control (cutoff mod) | 1 audio | `P_CUTOFF`, `P_RESONANCE`, `P_FILTER_TYPE` (LP/HP/BP/Notch) |
| **Amplifier** | Processor | 1 audio, 1 control (gain mod) | 1 audio | `P_GAIN` |
| **LFO** | Control | — | 1 control | `P_RATE`, `P_DEPTH`, `P_WAVEFORM`, `P_PHASE` |
| **Panner** | Processor | 1 audio | 1 audio (N-ch) | `P_PAN`, `P_AZIMUTH`, `P_ELEVATION`, `P_SPREAD` |
| **Gain** | Processor | 1 audio | 1 audio | `P_GAIN` |
| **Split** | Utility | 1 audio (N-ch) | N audio (mono) | — |
| **Merge** | Utility | N audio (mono) | 1 audio (N-ch) | — |

### 13.1 Subtractive Voice Graph (Default)

```
  ┌────────────┐       ┌────────────┐
  │ Oscillator │──────►│   Filter   │──────►┌────────────┐
  └────────────┘       └─────▲──────┘       │ Amplifier  │──────► output
                             │              └─────▲──────┘
                    ┌────────┴───────┐            │
                    │ Envelope (Flt) │     ┌──────┴───────┐
                    └────────────────┘     │ Envelope (Amp)│
                                           └──────────────┘
                                                  ▲
                                                  │ gate (noteOn/noteOff)
```

## 14. v2 Module Additions (FM Synthesis)

| Module | Type | Inputs | Outputs | Parameters |
|--------|------|--------|---------|------------|
| **FMOperator** | Source/Processor | 1 audio (FM input, optional) | 1 audio (mono) | `P_FREQUENCY`, `P_RATIO`, `P_INDEX`, `P_FEEDBACK` |

An FM voice graph is N `FMOperator` modules with audio-rate connections between them (operator output → operator FM input). The graph compiler handles this naturally — an audio-rate wire between two operators means the modulator's output buffer is passed as the carrier's input buffer within the same block.

## 15. Implementation Phases

### Phase 1: Foundation

1. Define all interfaces in `@symphonyscript/dsp/src/interfaces/`.
2. Implement `AudioBuffer` utilities (create, clear, mix, channel access).
3. Implement the graph compiler (validate, topological sort, buffer allocation, plan emit).
4. Implement the plan executor.
5. Implement `Oscillator` module (sine, saw, square, triangle — band-limited).
6. Implement `Envelope` module (ADSR).
7. Implement `Amplifier` module.
8. Implement basic `Voice` and `Instrument` with `StealPolicy.OLDEST`.
9. Implement `Mixer` (stereo output).
10. Implement `Engine`.
11. Wire `@symphonyscript/web` adapter to the new engine.
12. **Milestone**: A sine wave plays a melody from kernel events through the full pipeline.

### Phase 2: Subtractive Complete

1. Implement `Filter` module (LP, HP, BP — state-variable filter for Rust compatibility).
2. Implement `LFO` module.
3. Implement `Panner` module (stereo + surround).
4. Implement `NoiseGenerator` module.
5. Implement `Split` and `Merge` utility modules.
6. Implement channel adapters (up-mix, down-mix).
7. Implement `SendBus` for shared effects.
8. Create `@symphonyscript/synthesis` with `createSubtractiveSynth()`.
9. **Milestone**: A full subtractive synth with filter envelope, LFO modulation, and surround panning.

### Phase 3: FM + Effects

1. Implement `FMOperator` module.
2. Create `createFMSynth()` factory.
3. Implement `Delay` effect module.
4. Implement `Reverb` effect module (Schroeder or FDN).
5. Implement `Chorus` effect module.
6. Implement `Distortion` effect module.
7. **Milestone**: FM synthesis and send-bus effects working.

### Phase 4: Modulation + Polish

1. Implement `ModulationBus` (parameter smoothing, multi-source summing).
2. Integrate with Synapsis parameter system (RFC-050).
3. Performance profiling and optimization.
4. Preset library.
5. **Milestone**: Synapsis-driven parameter animation controlling synth parameters in real time.

## 16. Rust Portability Checklist

Every interface and implementation must satisfy these constraints:

| Constraint | Rationale |
|------------|-----------|
| No closures in process() | Rust has no GC; closures capture environment |
| No object allocation in process() | No heap allocation in audio thread |
| No string operations in process() | Strings are heap-allocated |
| No dynamic dispatch in the inner loop | Use enum dispatch or monomorphization |
| All state in typed arrays or numeric fields | Maps to Rust `[f32; N]` and `f32` fields |
| Planar buffer layout | Maps to Rust `&[f32]` slices per channel |
| Plan executor uses index-based lookup | Maps to Rust `Vec<Module>` indexed by `usize` |
| Parameter IDs are numeric constants | Maps to Rust `const` or `enum` |
| Module type is a numeric enum | Maps to Rust `enum` with `match` dispatch |

## 17. Open Questions

1. **Buffer reuse in the compiled plan**: How aggressively should the compiler recycle arena slots? Greedy graph coloring? Or simpler first-fit?
2. **Band-limited oscillators**: PolyBLEP for saw/square in v1, or start with naive waveforms and upgrade later?
3. **Filter topology**: State-variable filter (Chamberlin) for Rust compatibility, or biquad for familiarity? SVF is recommended (fewer branches, stable at high resonance).
4. **Silence detection threshold**: -96dB (16-bit floor) or -120dB (20-bit floor) for voice release→idle transition?
5. **Expression ID splitting**: How many bits for channel routing vs. per-note expression? 2+2? 3+1? Configurable per instrument?
