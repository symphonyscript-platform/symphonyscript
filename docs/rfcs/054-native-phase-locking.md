# RFC-054: Native Phase Guardrails

**Status**: PROPOSED
**Author**: Antigravity
**Created**: 2025-12-30

## 1. Abstract

This RFC proposes the introduction of a native **Phase Barrier** mechanism in the SymphonyScript Kernel (`OPCODE.BARRIER`) to enforcing topological phase alignment at the "Bare Metal" level. This replaces OS-level "Elastic Spacer" logic with a robust, runtime-evaluated CPU instruction. It also defines the "Implicit Loop" architecture in the Synaptic Layer, where defining a loop instantly reifies it as a closed topology with a Phase Barrier, removing the need for manual finalization.

## 2. Motivation

Previous attempts to implement phase locking relied on "Ghost State" (properties in `SynapticNode` that didn't exist in the graph) or "Elastic Spacers" (standard REST nodes resized at build time). These approaches had significant downsides:
1.  **Complexity**: The OS had to manually calculate duration gaps.
2.  **Fragility**: Generative or variable-length content could break the pre-calculated spacing.
3.  **UX Burden**: Users often had to call `.finalize()` to "seal" the loop.

We desire a system where:
*   Phase is a First-Class Kernel Primitive.
*   Looping is implicit and impossible to break.
*   Generative paths automatically quantize to the phase cycle.

## 3. Specification

### 3.1 Kernel Layer: `OPCODE.BARRIER`

We define a new Opcode `0x05` (BARRIER).

*   **Instruction**: `BARRIER`
*   **Operand (Duration)**: `CYCLE_LENGTH` (in ticks)
*   **Semantics**:
    When the Playback Engine (Consumer) encounters a `BARRIER`:
    1.  Calculates `Remainder = CurrentTick % CYCLE_LENGTH`.
    2.  Calculates `Wait = CYCLE_LENGTH - Remainder`.
    3.  **Pauses** execution (holds state) for `Wait` ticks.
    4.  Proceeds to `NEXT_PTR` exactly on the phase boundary.

This ensures that regardless of *when* the barrier is reached (early, late, or randomly), the exit is always quantized.

### 3.2 OS Layer: Implicit Topology

The `SynapticNode` (OS) exposes this via `setCycle(ticks)`.

*   **Behavior**:
    1.  Immediately calls `bridge.insertAsync(OPCODE.BARRIER, ..., duration=ticks)`.
    2.  Appends this **Barrier Node** to the end of the current chain.
    3.  (If Looping) Links the Barrier Node's Exit to the Chain's Entry (`bridge.connect`).

This "Reification" means the Loop is real effectively immediately.

### 3.3 Application Layer: Zero-Burden UX & Insertion Order

The `SynapticClip` (App) removes `.finalize()`.

*   User calls `clip.loop(16)`.
*   System immediately appends the Barrier(16) and closes the loop.
*   The topology is valid instantly.

**Insertion Logic (Critical)**:
To support `loop(16).note().note()` (Reverse Polish Notation style definition), the Synaptic Layer must track two pointers:
1.  `writeId` (The last musical note added).
2.  `barrierId` (The immutable phase barrier at the end).

When `addNote` is called:
*   If `barrierId` exists: Insert NewNote **after** `writeId` and **before** `barrierId` (Mid-Chain Splicing).
*   Correct chaining: `writeId` -> `NewNote` -> `barrierId`.
*   Update `writeId` = `NewNote`.

This ensures the user can define the container (`loop`) first, then fill it, without breaking the topological closure.

## 4. Implementation Plan

1.  **Kernel**: Add `OPCODE.BARRIER = 0x05` to `constants.ts`.
2.  **Kernel Reference**: Update `mock-consumer.ts` to implement the Wait Logic (proving the concept).
3.  **OS**: Update `SynapticNode.ts` to use `addBarrier` instead of `enforcePhase`.
4.  **App**: Update `SynapticClip.ts` to remove `finalize` and use implicit barrier strategy in `loop()`.

## 5. Alternatives Considered

*   **Elastic Spacers (REST)**: Viable, but requires build-time math and fails with generative paths.
*   **No Phase Locking**: Rejected. The "Music OS" requires tight timing.

## 6. Compatibility

This adds a new Opcode. Existing consumers (if any) will need to be updated to handle `0x05` or they will skip/error. Since the production Audio Engine is external/opaque, this RFC assumes we are defining the specificiation for the *Next Generation* Engine, while implementing the Reference Behavior in `MockConsumer`.
