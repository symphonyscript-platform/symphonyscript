# Phase 4 Implementation Plan: AudioWorklet Integration & DSP

# [Goal Description]
Establish the runtime environment for the SymphonyScript Kernel within the AudioWorklet thread. This involves implementing the `AudioWorkletProcessor` to execute the Kernel's audio loop (reading nodes from SharedArrayBuffer) and a minimal DSP engine (Polyphonic Oscillator) to prove that Phase 3 structure produces Phase 4 sound. "Signal Processing" is enabling the kernel to actually make noise.

## User Review Required
> [!IMPORTANT]
> This phase introduces `AudioWorkletProcessor` code. Ensure we have `AudioWorklet` types available (`lib: ["dom"]`). If not, I will add them or use type assertions.

## Proposed Changes

### Kernel Layer (`@symphonyscript/kernel`)

#### [NEW] [processor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/worker/processor.ts)
- Extends `AudioWorkletProcessor` (using global interface).
- Imports `SiliconSynapse` (Linker) and `PolyOscillator` (DSP).
- Implements `process(inputs, outputs, parameters)`:
    - Sets Linker context to Audio (`setAudioContext(true)`).
    - Checks for incoming commands (Ring Buffer logic from `MockConsumer`).
    - Traverses `SiliconSynapse` linked list for the current tick.
    - Activates DSP voices based on Note On/Off events.
    - Renders audio to `outputs`.
    - Updates `PLAYHEAD_TICK`.

#### [NEW] [driver.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/driver/driver.ts)
- `SiliconDriver`: Main thread controller.
- `static createNode(context: AudioContext)`: Factory method that initializes `SiliconBridge` and sends SAB to the Worklet via MessagePort.

#### [NEW] [oscillator.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/dsp/oscillator.ts)
- `PolyOscillator`: Minimal zero-alloc polyphonic synth.
- Active Voices pool (size 16-32).
- `render(buffer: Float32Array)`: Fills buffer with sine/saw waves.

#### [NEW] [processor.test.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/__tests__/processor.test.ts)
- Logic verification for the Processor without browser environment.
- Mocks `AudioWorklet` scope (`currentFrame`, `sampleRate`) and simulates `process()` calls.

## Verification Plan

### Automated Tests
- Run `pnpm test -- processor` in `packages/kernel`.
    - Verifies:
        - `process()` loop advances `PLAYHEAD_TICK`.
        - Note events trigger DSP voices.
        - `AudioWorklet` logic corresponds to `MockConsumer` logic.
- Run `pnpm test -- scheduler` (Regression).
