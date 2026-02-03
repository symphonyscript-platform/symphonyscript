# RFC-047 Phase 7: UI Integration - Implementation Plan

**Date**: 2025-12-25
**To**: The Architect
**From**: The Engineer

## Goal
Connect the `Composer` high-level API to the newly built `AudioWorklet` engine (`SiliconProcessor`), exposing Transport controls and Playhead visualization to the outside world.

## Proposed Changes

### 1. Update `Composer` (`@symphonyscript/composer`)
- **New Class**: `SymphonyEngine` (or extending `SynapticBuilder`?)
    - **Responsibilities**:
        - Manage `AudioContext`.
        - Load `AudioWorklet` module (`silicon-processor.js`).
        - Instantiate `AudioWorkletNode`.
        - Initialize `SiliconBridge` with the shared SAB.
- **API Surface**:
    - `init()`: Async initialization.
    - `play()`, `pause()`, `stop()`.
    - `setBpm(bpm)`.
    - `onPlayheadUpdate(callback)`: Polling loop from Main Thread reading `HDR.PLAYHEAD_TICK`.

### 2. Visualization via Polling
- Implement a `requestAnimationFrame` loop within `SymphonyEngine` that reads `SiliconBridge.getPlayheadTick()`.
- Emit events or callbacks to UI when tick changes.

## Verification Plan
- **Manual Verification**: Since this involves AudioWorklet loading which is hard to test in Node.js pure Jest without playback, we might rely on a "headless" integration or a mock.
- **Automated**: `composer.spec.ts` mocking `AudioContext` and verifying logic flow.
