# RFC-047 Phase 4: ARCHITECTURAL DIRECTIVE (FINAL)

**Date**: 2025-12-25T17:35:00+04:00
**Status**: **APPROVED FOR EXECUTION**
**Supersedes**: 047-16, 047-18, 047-19

---

## 1. The Strategy: "The Tripartite Architecture"

We are implementing the "Physics Engine" architecture for music.
*   **The Brain**: `kernel` (Pure Logic)
*   **The Body**: `web` (Platform Integration)
*   **The Voice**: `dsp` (Audio Math)

## 2. Package Structure Definitions

### A. `@symphonyscript/kernel` (Existing)
*   **Status**: **FROZEN**.
*   **Constraint**: No changes allowed. It remains the pure event scheduler.

### B. `@symphonyscript/web` (NEW)
*   **Role**: The Web Platform Host.
*   **Dependencies**: `kernel`, `dsp`.
*   **Contents**:
    *   `src/runtime/processor.ts`: The `AudioWorkletProcessor`. Extends the browser API.
    *   `src/runtime/driver.ts`: The Main Thread `AudioWorkletNode` factory.
    *   `src/index.ts`: Exports `createSymphonyWorklet()`.

### C. `@symphonyscript/dsp` (NEW)
*   **Role**: The Portable Audio Math Library.
*   **Dependencies**: NONE (Pure JS).
*   **Contents**:
    *   `src/oscillator.ts`: `PolyOscillator` class.
    *   `src/index.ts`: Exports `PolyOscillator`.
*   **Future**: This is where Filters, Envelopes, and FFTs will live.

### D. `@symphonyscript/synthesis` (NEW)
*   **Role**: Future home of High-Level Instruments (e.g. `FM_Synth`, `Sampler`) built *on top* of `dsp`.
*   **Action**: Initialize the package structure. Let's have some fun.
*   **Contents**: `src/index.ts` (Empty export).
    *   **Requirement**: Add a nice JSDoc describing the future purpose of this package (Showroom for Instruments).

## 3. Implementation Plan (Phase 4)

### Step 1: Initialization
1.  Initialize `packages/web` (ESM, TypeScript, Vite).
2.  Initialize `packages/dsp` (ESM, TypeScript, Vite).

### Step 2: Implementation
1.  **DSP**: Implement `PolyOscillator` in `packages/dsp`.
    *   Must be zero-allocation during `process()`.
    *   Must be pure math.
2.  **Web**: Implement `SiliconProcessor` in `packages/web`.
    *   Import `SiliconSynapse` from `kernel`.
    *   Import `PolyOscillator` from `dsp`.
    *   Wire the loop: `Kernel Event -> DSP Parameter -> Audio Buffer`.

### Step 3: Verification
1.  **Build Check**: Verify `kernel` has NO DOM types.
2.  **Build Check**: Verify `web` builds `processor.ts` correctly (as a worker target).
3.  **Test**: Unit test the Processor logic (mocking the audio context environment).

## 4. Execution
Engineer, you are cleared to build the Tripartite architecture.
Make it clean. Make it pure.
