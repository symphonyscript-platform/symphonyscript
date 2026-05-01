# RFC-002-01: Phase 1 — Core Infrastructure

**Components:** C01 `DspEngine`, C02 `AudioBuffer`, C03 `VoiceAllocator`, C04 `DspAudioThread`

**Depends on:** `synaptic-kernel` only.

---

## C01: DspEngine

**File:** `src/engine.rs`
**Role:** Main-thread owner of the DSP Kernel graph. Provides API for loading instruments,
setting parameters, and creating the audio thread handle.

### Struct

```rust
pub struct DspEngine {
    kernel: Kernel<0, 0, 0>,
    wavetable_bank: Arc<WavetableBank>,
    sample_bank: Arc<SampleBank>,
    ir_bank: Arc<IrBank>,
    instrument_slots: Vec<InstrumentSlots>,  // per-instrument: which node slots belong to it
    sample_rate: f32,
    max_buffer_size: usize,
}

/// Tracks which Kernel node/synapse slots belong to a loaded instrument.
struct InstrumentSlots {
    instrument_id: u16,
    node_slots: Vec<usize>,
    synapse_slots: Vec<usize>,
}
```

### Methods

```
DspEngine::new(sample_rate: f32, max_buffer_size: usize) -> Self
    - Creates Kernel<0,0,0> with NetworkConfig from §2 of overview
    - Creates empty WavetableBank, SampleBank, IrBank
    - mem_metadata_size: 16 (for global state: tempo, transport, etc.)

DspEngine::create_audio_thread(&self) -> DspAudioThread
    - Clones Arc refs to wavetable_bank, sample_bank, ir_bank
    - Creates EpochConsumer from kernel.get_control_plane()
    - Creates VoiceAllocator, VoiceState array, BufferPool, ProcessorStatePool
    - Returns DspAudioThread (moved to audio thread by caller)

DspEngine::load_instrument(&mut self, def: &InstrumentDef) -> u16
    - For each ProcessorDef in def.processors:
        - kernel.insert_node_after(prev_slot, kind)
        - Write initial params to node attrs via f32_to_i32
        - Write structural config to node meta
    - For each RouteDef in def.routes:
        - kernel.connect(source_slot, target_slot, route_kind)
        - Write gain/pan to synapse attrs
    - kernel.publish()
    - Returns instrument_id

DspEngine::set_param(&self, node_slot: usize, param_index: usize, value: f32)
    - kernel.get_node(node_slot).attr_write(param_index, f32_to_i32(value))
    - No publish needed — MEM plane, instant visibility

DspEngine::unload_instrument(&mut self, instrument_id: u16)
    - For each synapse_slot in instrument_slots[id].synapse_slots: kernel.disconnect_synapse()
    - For each node_slot in instrument_slots[id].node_slots: kernel.remove_node()
    - kernel.publish()
```

### KernelConfig Construction

```rust
fn default_kernel_config() -> KernelConfig<0, 0, 0> {
    KernelConfig {
        mem_metadata_size: 16,
        tb_defs: [],
        store_defs: [],
        lut_defs: [],
        network_config: NetworkConfig {
            node_capacity: 64,
            node_meta_stride: 4,
            node_attr_stride: 8,
            synapse_capacity: 128,
            synapse_meta_stride: 4,
            synapse_attr_stride: 4,
        },
    }
}
```

### Tests

```
test_create_engine:
    - Create DspEngine with 44100.0 sample rate
    - Assert kernel.node_count() == 0
    - Assert kernel.synapse_count() == 0

test_load_simple_instrument:
    - Create InstrumentDef with: WavetableOsc -> SVFilter -> Amplifier -> Output
    - Call load_instrument()
    - Assert kernel.node_count() == 4
    - Assert kernel.synapse_count() == 3
    - Read back each node's kind, verify correct
    - Read back each node's attrs, verify initial params match
```

---

## C02: AudioBuffer + BufferPool

**File:** `src/buffer.rs`
**Role:** Pre-allocated audio buffers. Zero allocation on audio thread.

### AudioBuffer

```rust
pub struct AudioBuffer {
    data: Vec<f32>,       // capacity = max_buffer_size, allocated once
    len: usize,           // actual samples this block (may be < capacity)
}
```

**Methods:**

```
AudioBuffer::new(max_size: usize) -> Self
    - Allocates Vec with capacity and length = max_size
    - Fills with 0.0

AudioBuffer::clear(&mut self)
    - Fills data[0..self.len] with 0.0

AudioBuffer::len(&self) -> usize
    - Returns self.len

AudioBuffer::set_len(&mut self, len: usize)
    - debug_assert!(len <= self.data.len())
    - self.len = len

AudioBuffer::as_slice(&self) -> &[f32]
    - &self.data[0..self.len]

AudioBuffer::as_mut_slice(&mut self) -> &mut [f32]
    - &mut self.data[0..self.len]

AudioBuffer::add_from(&mut self, source: &AudioBuffer, gain: f32)
    - for i in 0..self.len: self.data[i] += source.data[i] * gain
    - This is the core mixing operation
```

### BufferPool

```rust
pub struct BufferPool {
    buffers: Vec<AudioBuffer>,    // indexed by node slot
    scratch: Vec<AudioBuffer>,    // temporary mixing buffers
}
```

**Methods:**

```
BufferPool::new(node_capacity: usize, max_buffer_size: usize, scratch_count: usize) -> Self
    - Allocates node_capacity + scratch_count AudioBuffers

BufferPool::get(&self, node_slot: usize) -> &AudioBuffer
BufferPool::get_mut(&mut self, node_slot: usize) -> &mut AudioBuffer

BufferPool::get_scratch(&mut self, index: usize) -> &mut AudioBuffer
    - Returns a scratch buffer, cleared to 0.0
```

### Tests

```
test_buffer_clear:
    - Write non-zero values, call clear(), assert all zeros

test_buffer_add_from:
    - buf_a = [1.0, 2.0, 3.0], buf_b = [0.5, 0.5, 0.5], gain = 2.0
    - buf_a.add_from(&buf_b, 2.0)
    - Assert buf_a = [2.0, 3.0, 4.0]

test_buffer_pool_scratch_is_zeroed:
    - Write to scratch buffer
    - Get it again
    - Assert all zeros (scratch is cleared on get)
```

---

## C03: VoiceAllocator + VoiceState

**File:** `src/voice.rs`
**Role:** 128-voice polyphony. Audio-thread-local. No Kernel involvement.

### VoiceAllocator

```rust
pub const MAX_VOICES: usize = 128;

pub struct VoiceAllocator {
    active: [bool; MAX_VOICES],
    note: [u8; MAX_VOICES],
    velocity: [u8; MAX_VOICES],
    instrument_id: [u16; MAX_VOICES],
    age: [u32; MAX_VOICES],
    global_age: u32,
}
```

**Methods:**

```
VoiceAllocator::new() -> Self
    - All slots inactive, age = 0

VoiceAllocator::note_on(&mut self, instrument_id: u16, note: u8, velocity: u8) -> usize
    - Step 1: Find first inactive slot. If found, activate it and return.
    - Step 2: No free slot — steal. Find slot with lowest age value (oldest note).
      Tie-break: prefer instrument with most active voices (prevents starvation).
    - Set: active[slot] = true, note[slot] = note, velocity[slot] = velocity,
      instrument_id[slot] = instrument_id, age[slot] = global_age, global_age += 1.
    - Return slot index.

VoiceAllocator::note_off(&mut self, instrument_id: u16, note: u8) -> Option<usize>
    - Find active slot where note[slot] == note AND instrument_id[slot] == instrument_id.
    - If multiple matches (same note retriggered), pick oldest (lowest age).
    - Return Some(slot) if found, None otherwise.
    - Does NOT deactivate — caller transitions envelope to Release.

VoiceAllocator::deactivate(&mut self, slot: usize)
    - active[slot] = false
    - Called when voice's amp envelope reaches zero.

VoiceAllocator::active_voice_count(&self) -> usize
VoiceAllocator::active_voices_for_instrument(&self, instrument_id: u16) -> usize
VoiceAllocator::is_active(&self, slot: usize) -> bool
```

### VoiceState

Per-voice DSP state. One per voice slot. Audio-thread-owned.

```rust
pub struct VoiceState {
    // Oscillator state
    pub osc_phase: f64,           // f64 for precision over long playback
    pub osc_frame_pos: f32,       // wavetable scan position [0.0, 1.0]

    // Filter state (SVF integrators)
    pub filter_ic1eq: f32,
    pub filter_ic2eq: f32,

    // Envelope states (amp + filter)
    pub amp_env: EnvelopeState,
    pub filter_env: EnvelopeState,

    // LFO state
    pub lfo_phase: f64,

    // Smoothed parameters (current values during interpolation)
    pub smoothed_gain: f32,

    // Status
    pub note: u8,
    pub velocity: u8,
    pub instrument_id: u16,
    pub active: bool,
    pub releasing: bool,          // true after note_off, before deactivation
}

pub struct EnvelopeState {
    pub stage: EnvelopeStage,     // Attack, Decay, Sustain, Release, Idle
    pub level: f32,               // current envelope output [0.0, 1.0]
    pub phase: f32,               // position within current stage [0.0, 1.0]
}

#[repr(u8)]
pub enum EnvelopeStage {
    Idle = 0,
    Attack = 1,
    Decay = 2,
    Sustain = 3,
    Release = 4,
}
```

**Methods:**

```
VoiceState::reset(&mut self)
    - Zero all fields. Set stage = Idle, active = false.
    - Called when voice is allocated or deactivated.

VoiceState::activate(&mut self, note: u8, velocity: u8, instrument_id: u16)
    - self.note = note, self.velocity = velocity, self.instrument_id = instrument_id
    - self.active = true, self.releasing = false
    - self.osc_phase = 0.0
    - self.filter_ic1eq = 0.0, self.filter_ic2eq = 0.0
    - self.amp_env = EnvelopeState { stage: Attack, level: 0.0, phase: 0.0 }
    - self.filter_env = EnvelopeState { stage: Attack, level: 0.0, phase: 0.0 }
    - self.lfo_phase = 0.0

VoiceState::begin_release(&mut self)
    - self.releasing = true
    - self.amp_env.stage = Release
    - self.filter_env.stage = Release
```

### Tests

```
test_note_on_allocates_free_slot:
    - Allocate voice. Assert returned slot is active.
    - Assert note, velocity, instrument_id match.

test_note_on_steals_oldest:
    - Fill all 128 slots with ascending age.
    - Allocate 129th voice. Assert it takes slot 0 (oldest).

test_note_off_returns_slot:
    - Allocate voice for note=60, instrument=0.
    - note_off(instrument=0, note=60). Assert returns the same slot.

test_deactivate:
    - Allocate, deactivate. Assert slot is inactive.
    - Allocate again. Assert same slot is reused.

test_steal_prefers_busiest_instrument:
    - Fill 127 slots with instrument_id=0.
    - Fill 1 slot with instrument_id=1.
    - Allocate for instrument_id=1. Assert stolen slot belonged to instrument 0.
```

---

## C04: DspAudioThread + process_block

**File:** `src/dispatch.rs`
**Role:** Audio thread entry point. Called every buffer by the audio host.

### DspAudioThread

```rust
pub struct DspAudioThread {
    consumer: EpochConsumer<0, 0, 0>,
    voice_allocator: VoiceAllocator,
    voice_states: Box<[VoiceState; MAX_VOICES]>,
    buffer_pool: BufferPool,
    processor_states: ProcessorStatePool,   // per-NODE-SLOT persistent state (reverb tails, delay buffers)
    wavetable_bank: Arc<WavetableBank>,
    sample_bank: Arc<SampleBank>,
    ir_bank: Arc<IrBank>,
    sample_rate: f32,
}
```

### ProcessorStatePool

Some processors need persistent state that is NOT per-voice (delay buffers, reverb state, convolution
buffers). These are per-node-slot:

```rust
pub struct ProcessorStatePool {
    delay_states: HashMap<usize, DelayLineState>,     // node_slot -> state
    reverb_states: HashMap<usize, FreeverbState>,
    convolution_states: HashMap<usize, ConvolutionState>,
    chorus_states: HashMap<usize, ChorusState>,
    flanger_states: HashMap<usize, FlangerState>,
    distortion_states: HashMap<usize, DistortionState>,  // holds oversampler state
}
```

> **Note:** `HashMap` is allocated once at `DspAudioThread` creation. The audio thread never
> inserts/removes from these maps — only reads existing entries. If a new instrument is loaded,
> the main thread signals the audio thread to initialize new entries during a safe window
> (between buffer callbacks, or via a pre-allocated slot pool).

### process_block (the main audio loop)

```
DspAudioThread::process_block(
    &mut self,
    events: &[DspEvent],         // note on/off/param changes from SymphonyEngine
    output_left: &mut [f32],
    output_right: &mut [f32],
    buffer_size: usize,
)

ALGORITHM:
    1. FLUSH DENORMALS
       #[cfg(target_arch = "x86_64")]
       unsafe { _mm_setcsr(_mm_getcsr() | 0x8040); }

    2. PROCESS EVENTS
       For each event in events:
         match event:
           NoteOn { instrument_id, note, velocity }:
             slot = voice_allocator.note_on(instrument_id, note, velocity)
             voice_states[slot].activate(note, velocity, instrument_id)

           NoteOff { instrument_id, note }:
             if let Some(slot) = voice_allocator.note_off(instrument_id, note):
               voice_states[slot].begin_release()

           ParamChange { node_slot, param_index, value }:
             // Already written to Kernel MEM by main thread.
             // This event is informational only (for logging/debug).

    3. ACQUIRE MIRROR
       let mirror = self.consumer.acquire_mirror();

    4. SET BUFFER LENGTHS
       for buf in buffer_pool: buf.set_len(buffer_size)

    5. PROCESS GRAPH IN TOPOLOGICAL ORDER
       Walk the node linked list (head → next → next → ...):

       let mut node_opt = mirror.get_head_node();
       while let Some(node) = node_opt {
           let slot = /* current node slot */;
           let kind = node.get_kind();

           // Clear this node's output buffer
           buffer_pool.get_mut(slot).clear();

           // Gather input from incoming synapses
           let input = gather_input(&mirror, &node, &buffer_pool);

           // Dispatch to processor
           match ProcessorKind::from_i32(kind) {
               WavetableOsc => process_wavetable_osc(
                   &node, &mut self.voice_states, &self.voice_allocator,
                   &self.wavetable_bank, buffer_pool.get_mut(slot),
                   self.sample_rate, buffer_size,
               ),
               SVFilter => process_svf_filter(
                   &node, &mut self.voice_states, &self.voice_allocator,
                   &input, buffer_pool.get_mut(slot),
                   self.sample_rate, buffer_size,
               ),
               Amplifier => process_amplifier(
                   &node, &mut self.voice_states, &self.voice_allocator,
                   &input, buffer_pool.get_mut(slot),
                   buffer_size,
               ),
               Envelope => { /* writes to voice_states, no audio output */ },
               LFO => { /* writes to modulation target via synapse */ },
               Delay => process_delay(
                   &node, self.processor_states.delay_states.get_mut(&slot),
                   &input, buffer_pool.get_mut(slot),
                   self.sample_rate, buffer_size,
               ),
               // ... etc for each ProcessorKind
               Output => {
                   // Copy input to final output buffers
                   output_left.copy_from_slice(input.as_slice());
                   output_right.copy_from_slice(input.as_slice());
               },
               _ => {},
           }

           node_opt = /* next node in chain */;
       }

    6. DEACTIVATE FINISHED VOICES
       for slot in 0..MAX_VOICES:
         if voice_states[slot].active
            && voice_states[slot].amp_env.stage == Idle
            && voice_states[slot].amp_env.level < 0.0001:
           voice_allocator.deactivate(slot)
           voice_states[slot].reset()
```

### gather_input

```
fn gather_input(
    mirror: &EpochMirror<0,0,0>,
    node: &NodeReader,
    buffer_pool: &BufferPool,
) -> AudioBuffer   // returns scratch buffer with summed inputs
{
    let mut scratch = buffer_pool.get_scratch(0);
    scratch.clear();

    let mut syn_slot = node.get_incoming_synapse_head();
    while syn_slot != 0 {
        let syn = mirror.get_synapse(syn_slot);
        let source_slot = syn.get_source_ptr();
        let gain = i32_to_f32(syn.attr_read(0));

        scratch.add_from(buffer_pool.get(source_slot), gain);

        syn_slot = syn.get_incoming_next_ptr();
    }

    scratch
}
```

### DspEvent Enum

```rust
pub enum DspEvent {
    NoteOn { instrument_id: u16, note: u8, velocity: u8 },
    NoteOff { instrument_id: u16, note: u8 },
    ParamChange { node_slot: usize, param_index: usize, value: f32 },
    AllNotesOff,
    AllSoundOff,  // immediate silence, no release
}
```

### Tests

```
test_empty_graph_produces_silence:
    - Create DspAudioThread with no instruments loaded.
    - Call process_block with empty events and 128-sample buffer.
    - Assert output is all zeros.

test_note_on_activates_voice:
    - Load simple instrument (osc -> output).
    - Send NoteOn event.
    - Call process_block.
    - Assert output is non-zero.

test_note_off_release:
    - Send NoteOn, process several blocks.
    - Send NoteOff.
    - Process blocks until amp envelope reaches zero.
    - Assert voice is deactivated.

test_multiple_instruments:
    - Load 2 instruments.
    - Send NoteOn for each.
    - Assert both produce audio (output is sum of both).
```
