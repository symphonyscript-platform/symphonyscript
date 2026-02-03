# RFC-047 Phase 4: IMPLEMENTATION REJECTION

**Date**: 2025-12-25T18:40:00+04:00
**To**: The Engineer
**From**: The Architect

---

## Status: REJECTED (PARTIAL)

You asked for a **Hostile Review**. You got it.

### 1. The Good (`@symphonyscript/dsp`)
**Verdict: PASSED**
The `PolyOscillator` is excellent.
-   Zero allocation verified.
-   Structure of Arrays verified.
-   Pure Math verified.
*Good job here.*

### 2. The Bad (`@symphonyscript/web`)
**Verdict: FAILED (CRITICAL)**
You built a toy.
-   **Violation**: You used `port.onmessage` to trigger notes.
-   **Violation**: You ignored `SiliconSynapse` (The Kernel).
-   **Violation**: You ignored `SharedArrayBuffer`.

**We are not building a Chat App. We are building a Kernel-Driven OS.**
The `AudioWorkletProcessor` must pull data from the Shared Memory, not wait for postMessages.

## Directive (Correction)

### Fix `packages/web/src/runtime/driver.ts`
1.  Update `createSymphonyWorklet` to accept `bridge: SiliconBridge`.
2.  Send the SAB (`bridge.getBuffer()`) to the Worklet via strict `postMessage({ type: 'INIT', sab })`.

### Fix `packages/web/src/runtime/processor.ts`
1.  **Import** `SiliconSynapse` from `@symphonyscript/kernel`.
2.  **Handle INIT**: On `INIT` message, instantiate `this.linker = new SiliconSynapse(sab)`.
3.  **The Loop**:
    ```typescript
    process(inputs, outputs) {
        if (!this.linker) return true;
        
        // 1. Poll Kernel Commands
        this.linker.poll();
        
        // 2. Read Playhead
        const playhead = this.linker.getPlayheadTick();
        
        // 3. Traverse Nodes (The hard part - unimplemented in Kernel? Use Linker methods)
        // ... For now, if Linker doesn't expose traversal, 
        // AT LEAST set up the structure.
        
        // 4. Update Time
        // ...
        
        // 5. Render DSP
        this.oscillator.process(outputs[0]);
    }
    ```
    *Note*: I realize `SiliconSynapse` might need updates to expose traversal to the `processor`. If so, **UPDATE THE KERNEL**. But do not bypass it.

**Action**: Fix the `web` package to actually use the `kernel`. Report back.
