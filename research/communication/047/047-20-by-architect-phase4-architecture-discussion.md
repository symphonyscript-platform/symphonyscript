# RFC-047 Phase 4: ARCHITECTURE DISCUSSION

**Date**: 2025-12-25T17:20:00+04:00
**Topic**: Package Structure & Naming Strategy for Phase 4

---

## 1. The Architectural Philosophy
We are building a "Music Operating System", not just a Web Synth.
An OS has a **Kernel** (Scheduler/State), **Drivers** (Platform Adapters), and **User Space** (DSP/Instruments/Sequencers).

### The Original Sin (Rejected Phase 4)
The rejected implementation collapsed all these layers into one:
> `kernel` depended on `AudioWorklet` (Driver) AND `Oscillator` (User Space).
This made the Kernel a "Monolithic Web Synth Kernel", impossible to port to C++/VST later.

## 2. Proposed Packages & Rationale

### A. `@symphonyscript/kernel` ("The Brain")
*   **Purpose**: To be the **Platonic Ideal** of the sequencer.
*   **Capabilities**:
    *   Knows what "Tick 480" is.
    *   Knows what "Note C4" is.
    *   Does **NOT** know what a "Sample Rate" is.
    *   Does **NOT** know what a "Speaker" is.
*   **Why "Kernel"?**: Just like Linux, it manages resources (voices, time) and processes (notes). It doesn't draw pixels or make beep noises itself; it tells drivers to do that.

### B. `@symphonyscript/runtime-web` ("The Body")
*   **Purpose**: To give the Brain a body in the Browser.
*   **Capabilities**:
    *   Implements `AudioWorkletProcessor` (the browser's audio thread).
    *   Manages the `AudioContext`.
    *   **The Translation Layer**: It reads the Kernel's "Event: Play C4" and translates it into "DSP: Set Freq(261.6Hz)".
*   **Why "runtime-web"?**:
    *   **Runtime**: It provides the execution environment (the loop).
    *   **Web**: Explicitly tied to DOM/WebAudio APIs.
    *   *Alternative Names Considered*: `web-host`, `browser-adapter`, `drivers-web`. "Runtime" felt most accurate because it *runs* the kernel.

### C. `@symphonyscript/dsp` ("The Voice")
*   **Purpose**: To generate audio samples (float32).
*   **Capabilities**:
    *   Oscillators (Sine, Saw, etc.).
    *   Envelopes (ADSR).
    *   Filters.
    *   **Pure Math**: `Input State -> Math -> Output Array`.
*   **Why "dsp"?**: Standard industry term (Digital Signal Processing). It implies immediate, mathematical transformation of signals.
*   **Important**: This package should be usable *without* the Kernel. You could use it to build a simple synth. The Kernel drives it via the Runtime.

## 3. The Data Flow (Why separation matters)

```mermaid
graph TD
    K[Kernel (SAB)] -->|Pure Integers| R[Runtime (Web)]
    R -->|Parameters| D[DSP (Oscillator)]
    D -->|Float32 Buffer| A[AudioOutput (Speakers)]
```

If we port to **VST (C++)** later:
```mermaid
graph TD
    K[Kernel (SAB)] -->|Pure Integers| R2[Runtime (C++)]
    R2 -->|Parameters| D2[DSP (C++)]
    D2 -->|Float32 Buffer| A2[VST Host]
```
The **Kernel** remains unchanged. That is the victory condition.

## 4. Discussion Point: Naming
Are you happy with `runtime-web`? It sounds slightly generic.
*   Option A: `platform-web` (implies hardware abstraction layer).
*   Option B: `web-audio-backend` (specific but long).
*   Option C: `runtime-web` (current proposal).

I recommend `runtime-web` or `platform-web`.

## 5. Summary
The separation is non-negotiable for a "Music OS". The naming is negotiable.
This structure ensures:
1.  **Testability**: Kernel tests run in Node (no mocks).
2.  **Portability**: DSP and Runtime can be swapped.
3.  **Clarity**: Junior engineers know exactly where "Sound Code" goes vs "Logic Code".
