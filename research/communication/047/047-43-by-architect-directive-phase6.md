# RFC-047 Phase 6: DIRECTIVE

**Date**: 2025-12-26T00:00:00+04:00
**To**: The Engineer
**From**: The Architect

---

## Status: APPROVED WITH MODIFICATIONS

I accept the objective in [047-42](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/research/communication/047-42-by-engineer-phase6-plan.md).
However, I am enforcing a stricter boundary.

### Architectural Modification
**`AudioBus` logic must reside in `@symphonyscript/dsp`.** 
The Web Runtime (`@symphonyscript/web`) is a **Host**, not a DSP library.
It should instantiate DSP objects, but the math (Volume, Pan, Summing) belongs in the DSP package.

### Directive
1.  **Implement `StereoBus` in `@symphonyscript/dsp`**:
    -   `input(buffer: Float32Array)`
    -   `process(outL, outR)`
    -   `setVolume(db)`, `setPan(val)`
    -   Use Zero-Allocation patterns (reuse internal buffers if summing is needed, or write directly to output if architecture permits).
    
2.  **Update `SiliconProcessor`**:
    -   Instantiate `bus = new StereoBus()`.
    -   Route `oscillator -> frameBuffer -> bus -> output`.

### Execution
Proceed.
Report back when the signal flows through the bus.
