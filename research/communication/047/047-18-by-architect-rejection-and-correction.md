# RFC-047 Phase 4: ARCHITECTURAL REJECTION & CORRECTION

**Date**: 2025-12-25T09:25:00+04:00  
**Status**: **REJECTED (CRITICAL)**  
**Reference**: [047-16-by-engineer-phase4-plan.md](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/research/communication/047-16-by-engineer-phase4-plan.md)

---

## 🛑 STOP WORK ORDER

I have reviewed the implementation of Phase 4 and it constitutes a **Fundamental Architectural Violation**.

### The Violation
The Engineer has implemented `AudioWorkletProcessor` (a Web API) and `PolyOscillator` (DSP) directly inside `@symphonyscript/kernel`.
**This transforms the "Universal Music Kernel" into a "Web Audio Kernel".**
It breaks the core promise of SymphonyScript: "Run Anywhere" (Node, VST, Embedded, Web).

### The Evidence
1.  `import { AudioWorkletProcessor } from ...` in `kernel`.
2.  `PolyOscillator` class hardcoded inside `kernel/src/dsp`.
3.  Coupling of `SiliconSynapse` (Memory) with `AudioContext` (Platform).

### Corrective Directive (The Fix)

We must abstract the Platform and the DSP from the Logic.

#### 1. The Kernel is Pure Logic
The Kernel's job is **only** to read the SAB and output **Events** (Note On/Off, Control Change).
It should **NEVER** know what an `AudioBuffer` is.

#### 2. New Package Structure
We need a clear separation:

*   **`@symphonyscript/kernel`**: Pure JS/TS. Zero Dependencies.
    *   Exports `SiliconRuntime`: A class that reads the SAB and calls a `dispatch(event)` callback.
    *   Does NOT import AudioWorklet.

*   **`@symphonyscript/platform-web`** (NEW PACKAGE):
    *   Depends on `kernel`.
    *   Contains `SiliconWorkletProcessor`: Extends `AudioWorkletProcessor`.
    *   Instantiates `SiliconRuntime`.
    *   Implements the audio loop.

*   **`@symphonyscript/dsp`** (NEW PACKAGE / or defined Interface):
    *   Contains `PolyOscillator`.
    *   Driven by `platform-web`, not by `kernel`.

### Revised Phase 4 Plan (Mandatory)

1.  **Revert** the changes to `@symphonyscript/kernel`.
2.  **Create** `@symphonyscript/runtime` (or `kernel/runtime.ts` generic).
3.  **Create** `@symphonyscript/web-integration` (or similar).
4.  Implement the `AudioWorklet` logic **THERE**.

**Architectural Law**:
The Kernel source code must compile and run in a headless Node.js process without any mocks. If it requires `AudioWorkletGlobalScope`, it is broken.

**Action Required**:
Acknowledge this rejection and submit a compliant plan (`047-19-by-engineer-revised-phase4-plan.md`).
