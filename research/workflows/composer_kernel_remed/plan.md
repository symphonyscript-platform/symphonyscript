# Composer & Kernel Remediation: Direct-to-Silicon Architecture

## Executive Summary
This document outlines the remediation strategy to align the SymphonyScript Composer layer with the Kernel's Zero-Allocation and "Direct-to-Silicon" principles. The goal is to eliminate all intermediate memory allocations during production/playback and guarantee data integrity even under high load.

## 1. Architectural Principles

### 1.1 Direct-to-Silicon
-   **No Buffering**: The Composer layer (`SynapticClip`) will **NOT** buffer operations or maintain a history array (`this.operations`).
-   **Immediate Flush**: All musical events (Notes, CCs) are flushed immediately to the Kernel's `SharedArrayBuffer` via `SiliconBridge`.
-   **Kernel as Truth**: The Kernel state is the single source of truth. The Composer layer acts purely as a stateless (or minimal state) fluent API for mutation.

### 1.2 Zero-Allocation Policy
-   **Primitive State**: `SynapticClip` and its cursors must store all state (Current Time, Transpose, Velocity, etc.) using **primitive values** (numbers, enums).
-   **No Objects**: No objects, arrays, or closures may be created in hot paths (e.g., inside loops, `note()`, `commit()`).
-   **Singleton Cursors**: Cursors (e.g., `SynapticMelodyNoteCursor`) are allocated **once** per Clip and reused. `clip.note()` merely resets the state of the existing cursor instance.

## 2. Kernel Layer Remediation

To safely support the Direct-to-Silicon architecture without data loss, the Kernel must implement backpressure.

### 2.1 Ring Buffer Expansion
-   **Capacity**: Increase Command Ring Buffer capacity from `1,024` to **65,536** entries (~1MB).
-   **Impact**: Allows bursting ~65k synchronous operations (notes/edits) before filling the buffer.

### 2.2 SiliconBridge Backpressure
-   **Mechanism**: **Spin-Wait**.
-   **Behavior**: When `SiliconBridge.insertAsync` encounters a full Ring Buffer:
    1.  It enters a tight loop (Spin-Wait).
    2.  It repeatedly checks `Atomics.load` on the Ring Buffer header.
    3.  It halts the Main Thread until the Audio Thread consumes commands and frees space.
-   **Safety**: Ensure a timeout (e.g., 500ms) throws a `KERNEL_PANIC` to prevent infinite deadlocks if the Audio Thread crashes.
-   **Justification**: This guarantees data integrity (no dropped notes) while maintaining a synchronous API for user scripts.

## 3. Composer Layer Remediation

### 3.1 SynapticClip Refactor
-   **Remove Operations Array**: Delete `protected operations: Operation[]` and all `.push()` logic.
-   **Flatten State**: Replace all state objects with primitive fields:
    -   `activeDynamics` -> `_dynType`, `_dynStart`, `_dynDuration`, `_dynFrom`, `_dynTo`.
    -   `scaleContext` -> `_scaleRoot`, `_scaleMode`.
    -   `_humanizeSettings` -> `_humVel`, `_humTiming`.
-   **Refactor `flushNote`**: Rewrite to calculate final values from primitive state and call `bridge.insertAsync` directly.

### 3.2 Cursor Optimization
-   **Lifecycle**: `SynapticClip` initializes `_noteCursor` and `_chordCursor` in its constructor.
-   **Re-entry**: `clip.note(pitch)` resets `_noteCursor` state (pitch, velocity, duration) and returns it.
-   **Commit**: `cursor.commit()` calls `clip.flushNote(...)` and resets pending state.

## 4. Implementation Tasks

1.  **Task 060: Kernel Backpressure**
    -   Increase Ring Buffer to 64k.
    -   Implement Spin-Wait in `SiliconBridge`.
2.  **Task 059: Enums**
    -   Define numeric Enums for Dynamics, Curves, Modes in `types.ts`.
3.  **Task 057: Flatten Clip State**
    -   Replace object fields with primitives in `SynapticClip`.
4.  **Task 058: Remove Operations**
    -   Delete `operations` array and recording logic.

## 5. Verification
-   **Correctness**: Verify strict 1:1 mapping between API calls and Kernel commands.
-   **Memory**: Profile heap usage during a high-throughput loop (100k notes). Allocations should be effectively zero (GC flatline).
-   **Reliability**: Stress test with >65k burst edits to trigger and verify Spin-Wait behavior.
