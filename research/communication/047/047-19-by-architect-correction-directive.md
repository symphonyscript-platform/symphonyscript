# RFC-047 Phase 4: ARCHITECTURAL DIRECTIVE (CORRECTION)

**Date**: 2025-12-25T09:30:00+04:00  
**Status**: **MANDATORY DIRECTIVE**  
**Previous Status**: REJECTED (See 047-18)

---

## 1. The Core Violation
The previous attempt (Phase 4) incorrectly coupled `@symphonyscript/kernel` to the Web Platform (`AudioWorklet`, `Oscillator`).
**Axiom**: The Kernel is a *Physics Engine* for events. It manages Time and State. It does **NOT** make sound. It does **NOT** know about `Window` or `AudioContext`.

## 2. The Correct Architecture
We will introduce a strict separation of concerns via new packages.

### A. The Kernel (`@symphonyscript/kernel`) - PURE
- **Status**: **NO CHANGES** allowed to the core logic.
- **Responsibility**: Expose the SAB layout, the Linker (`SiliconSynapse`), and the Scheduler.
- **Environment**: Must run in Node.js, V8 (C++ embed), or Browser. Zero DOM dependencies.

### B. The Runtime (`@symphonyscript/runtime-web`) - NEW PACKAGE
- **Responsibility**: The Bridge between the Kernel and the Web Platform.
- **Contents**:
    1.  `SiliconProcessor` (extends `AudioWorkletProcessor`).
    2.  `SiliconDriver` (Main Thread factory for the Worklet Node).
    3.  `Adapter`: Converts Kernel Events (`NOTE_ON`) into implementation-specific actions (MIDI, Synth).
- **Dependencies**: `@symphonyscript/kernel`.

### C. The DSP (`@symphonyscript/dsp`) - NEW PACKAGE (Optional/Minimal)
- **Responsibility**: A lightweight software synthesizer to prove the kernel works.
- **Contents**: `PolyOscillator`, `Voice`, `Envelope`.
- **Pure Math**: Inputs are standard numbers (frequency, gain). Outputs are `Float32Array`.
- **Dependencies**: None (Pure JS).

## 3. Implementation Steps (Phase 4 Revised)

### Step 1: Initialize New Packages
1.  Create `packages/runtime-web`.
2.  Create `packages/dsp`.
3.  Configure `package.json` and `tsconfig.json` for both (strict ESM).

### Step 2: Implement The Code (Fresh)
1.  **Implement** `packages/dsp/src/oscillator.ts`:
    -   Create `PolyOscillator` class (pure JS).
    -   Implement `noteOn`, `noteOff`, `process` (math only).
2.  **Implement** `packages/runtime-web/src/processor.ts`:
    -   Extend `AudioWorkletProcessor`.
    -   Import `SiliconSynapse` from `@symphonyscript/kernel`.
    -   Import `PolyOscillator` from `@symphonyscript/dsp`.
    -   Implement the audio loop logic.
3.  **Implement** `packages/runtime-web/src/driver.ts`:
    -   Create `SiliconDriver` class.
    -   `createNode(context, bridge)` factory method.

### Step 3: Integration Logic
1.  **Worklet Loop**:
    ```typescript
    // In runtime-web/processor.ts
    process(inputs, outputs) {
       this.linker.poll(); // Kernel
       const tick = this.linker.getPlayheadTick();
       // ... traversal ...
       const time = getModulatedTime(tick, cycle); // Kernel
       // ... dsp ...
       this.oscillator.render(outputs[0]); // DSP
    }
    ```

### Step 4: Verification
-   **Test 1**: Build `kernel` alone. Must NOT require `dom` lib.
-   **Test 2**: Build `runtime-web`. Defines `AudioWorkletProcessor`.
-   **Test 3**: Unit test `processor.ts` logic mock-environment.

## 4. Execution Order
Proceed immediately with **Step 1**. Do not touch `packages/kernel`.
