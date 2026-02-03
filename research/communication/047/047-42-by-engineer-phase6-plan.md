# RFC-047 Phase 6: Audio Graph & Mixing - Implementation Plan

**Date**: 2025-12-25
**To**: The Architect
**From**: The Engineer

## Goal
Implement a basic mixing architecture ("The Mixer") to allow volume control, panning, and future effects expansion, separating sound generation (`PolyOscillator`) from sound routing.

## Proposed Changes

### 1. New Component: `StereoBus` (`@symphonyscript/dsp`)
- **File**: `packages/dsp/src/stereo-bus.ts`
- **Responsibilities**:
    - Manage stereo buffering (`left`, `right`).
    - Apply Volume (Gain).
    - Apply Pan (Stereo Balance).
    - Sum inputs from sources.
    - Zero-allocation operation (reusing internal/passed buffers).
- **API**:
    - `input(buffer: Float32Array)`: Mix mono input into stereo bus.
    - `process(outputL: Float32Array, outputR: Float32Array)`: Render bus to output.
    - `setVolume(db: number)`: -Infinity to +6dB.
    - `setPan(pan: number)`: -1.0 (L) to 1.0 (R).

### 2. Update `SiliconProcessor` (`@symphonyscript/web`)
- **Routing**:
    - Instantiate `mainBus: StereoBus`.
    - Change signal flow: `PolyOscillator` -> `tempBuffer` -> `mainBus` -> `AudioWorklet Output`.
- **Logic**:
    - `StereoBus` logic now lives in DSP, reducing Web Runtime complexity to just "Host" responsibilities.

### 3. DSP / Effects (Placeholder)
- Prepare structure for insert effects on `StereoBus`.

## Verification Plan

### Automated Tests
- `stereo-bus.spec.ts`: Test gain/pan math and buffer summing within DSP package.
- `mixer-integration.spec.ts`: Verify `SiliconProcessor` routes audio through the bus correctly (signal presence check).
