# K-001 Implementation Plan: Class Separation

**Target**: Reduce memory overhead in `SiliconBridge` by eliminating unused write buffers.
**Strategy**: Split `SynapseAllocator` into `SynapseView` (Read-Only) and `SynapseManager` (Write/Alloc).
**Scope**: `packages/kernel/src/synapse-allocator.ts`, `packages/kernel/src/synapse-view.ts`, `packages/kernel/src/silicon-bridge.ts`, `packages/kernel/src/silicon-synapse.ts`
**Author**: Antigravity

## 1. Problem Statement
`SiliconBridge` (Main Thread) instantiates `SynapseAllocator`.
`SynapseAllocator` allocates 3 x Int32Array(65536) for compaction staging (~786KB).
`SiliconBridge` is read-only (observability) in the Remote-Link architecture and never compacts.
Result: ~0.75MB wasted per Bridge instance.

## 2. Proposed Solution
Create a class hierarchy:

1.  **`SynapseView`** (New File: `synapse-view.ts`)
    -   Base class.
    -   Read-only access to SAB.
    -   Methods: `getLoadFactor`, `getTombstoneRatio`, `findHeadSlot`, `hash`, `getNextPtr`, `ptrFromSlot`, `slotFromPtr`.
    -   **NO** staging buffers.

2.  **`SynapseAllocator`** (Modified `synapse-allocator.ts`)
    -   Extends `SynapseView`.
    -   Adds Write capability.
    -   Methods: `connect`, `disconnect`, `maybeCompact`, `clear`.
    -   Owns the staging buffers.

3.  **`SiliconBridge`** Update
    -   Change `private synapseAllocator` to `private synapseView: SynapseView`.
    -   Instantiate `SynapseView` instead of `SynapseAllocator`.
    -   Update `getSynapseAllocator()` to `getSynapseView()` (Breaking change, or return View).

4.  **`SiliconSynapse`** Update
    -   Continues to use `SynapseAllocator` (The Manager).

## 3. Implementation Steps
1.  Extract read-only logic from `SynapseAllocator` to `SynapseView`.
2.  Make `SynapseAllocator` extend `SynapseView`.
3.  Update consumers.

## 4. Verification
1.  **Memory Check**: Manually verify `SynapseView` does not allocate staging arrays.
2.  **Functional Check**: Ensure `SiliconBridge` can still read stats (`getSynapseStats`).
3.  **Regression Check**: Ensure `SiliconSynapse` can still connect/disconnect/compact.

## 5. Risks
-   **Breaking Change**: `bridge.getSynapseAllocator()` will now return a View (subset of API). If user relied on direct writes from Bridge, this will break. (Correct behavior per architecture).
