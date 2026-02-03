# RFC-047 Phase 4: PACKAGE STRUCTURE BRAINSTORMING

**Date**: 2025-12-25T17:25:00+04:00
**Topic**: Naming (`@symphonyscript/web`) and DSP Location

---

## 1. Naming the Runtime: `@symphonyscript/web`
**Verdict: STRONG APPROVAL**

**Discussion**:
*   `@symphonyscript/runtime-web` is defensive naming.
*   `@symphonyscript/web` is confident naming.
*   It clearly states: "This is the package you install if you are building for the Web."
*   It aligns with patterns like `react-dom` or `@tensorflow/tfjs-backend-webgl`.
*   **Decision**: It shall be called `@symphonyscript/web`.

## 2. DSP Location: "Why separate package?"

You asked: *Why not use `@symphonyscript/theory` or `@symphonyscript/synaptic`?*

### Option A: Put DSP in `Theory`?
**Analysis**:
*   **Theory** deals with *Symbolic Data*: "C4", "Major Scale", "Intervals". It is math about *Quality*.
*   **DSP** deals with *Signal Data*: "44100Hz", "Sample 0.0342", "Phase Accumulator". It is math about *Quantity*.
*   **Conflict**: If we put an Oscillator (which needs sample rates and buffers) into Theory, we pollute the pure music theory domain with audio implementation details. "C Major" exists whether or not we have a sample rate.
*   **Conclusion**: **Reject**. Theory should remain abstract.

### Option B: Put DSP in `Synaptic`?
**Analysis**:
*   **Synaptic** is the *Construction Layer* (AST Builder). It creates the nodes that get sent to the Kernel. It runs on the Main Thread (UI side).
*   **DSP** typically runs on the Audio Thread.
*   **Conflict**: If we put `PolyOscillator` in Synaptic, we are bundling the *Generator* (Synth) with the *Architect* (Builder). While possible, it couples the "Planning" (Synaptic) with the "Execution" (DSP).
*   **However**: Phase 4 DSP is *very minimal* (just a proof-of-concept Oscillator). Creating a whole package `@symphonyscript/dsp` for one file might be overkill *right now*.

### Option C: Put DSP in `Kernel`? (REJECTED)
*   As discussed, this violates purity.

### Option D: Put DSP in `@symphonyscript/web` (The Runtime)?
**Analysis**:
*   Since the `PolyOscillator` is implemented in JS/TS specifically to run in the `AudioWorklet`, maybe it belongs inside the Web Runtime?
*   **Pros**: Zero extra packaging.
*   **Cons**: If we later make a Node.js runtime (`@symphonyscript/node`), we have to duplicate the Oscillator code or extract it then.

### Proposal: The "Standard Library" Approach
If we don't want a dedicated `dsp` package yet:
We can put the reference DSP implementation inside `@symphonyscript/web` as `src/dsp/`.
*   **Reason**: Currently, the only place demanding this DSP code is the Web AudioWorklet.
*   **Trade-off**: It makes the `web` package "batteries included" (Driver + Engine).

**BUT**, if we visualize the future where we have:
1. `web` (Driver)
2. `native` (Driver)
3. `vst` (Driver)

They all need the same `Oscillator` code (if they run JS DSP).
If `Oscillator` is inside `web`, `native` cannot use it easily.

**Recommendation**:
Keep `@symphonyscript/dsp` (or `audio`).
It ensures that the "Sound Generation Logic" is portable across all future platforms.
*   **Theory**: "What to play"
*   **Kernel**: "When to play"
*   **DSP**: "How to sound"
*   **Web**: "Where to run"

Does this distinction (What/When/How/Where) clarify the need for separation?
