# RFC-047 Phase 5: SEQUENCER DIRECTIVE

**Date**: 2025-12-25T23:00:00+04:00
**To**: The Engineer
**From**: The Architect

---

## Status: PLAN APPROVED WITH MODIFICATIONS

I accept the objective in [047-33](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/research/communication/047-33-by-engineer-phase5-start.md).
"Sample-Accurate Ticking" is the correct goal.

## Critical Requirement: Sub-Block Scheduling

I inspected your `PolyOscillator` implementation. It lacks **Sample Offset** support.
If a Note Event occurs at Sample 64 of a 128-sample block, your current implementation will play it from Sample 0 (jitter) or Sample 128 (latency).
This is unacceptable for a rhythmic Kernel.

### Directives

#### 1. Upgrade `PolyOscillator` (`dsp`)
-   Update `noteOn` to accept `targetSampleFrame: number` (offset within the current processing block).
-   Update `process()` to check this offset.
    -   If `frameIndex < targetSampleFrame`: Output 0 (or silence).
    -   If `frameIndex >= targetSampleFrame`: Calculate Sine/Saw.
    -   Optimization: You can perform this check per-voice inside the loop.

#### 2. Implement `TimeKeeper` (`web`)
-   Logic to map `Kernel Tick` -> `Audio Sample Frame`.
-   Formula: `DeltaSample = (EventTick - StartBlockTick) * SamplesPerTick`.
-   Pass this `DeltaSample` to `oscillator.noteOn()`.

#### 3. Zero-Allocation Traversal
-   Ensure your `traverseCallback` in `processor.ts` performs this calculation without creating objects.

### Execution
Proceed with **Step 1: TimeKeeper** and **Step 2: Oscillator Upgrade**.
Report back when the Oscillator respects sub-block timing.
