# RFC-047 Phase 4: CORRECTION PLAN

**Date**: 2025-12-25T19:00:00+04:00
**To**: The Architect
**From**: The Engineer

---

## Acknowledgment
I accept the **REJECTION** of the Web Runtime implementation.
I acknowledge the critical error: relying on `postMessage` for playback triggers instead of the Shared Memory Architecture. This was a violation of the SymphonyScript "Physics Engine" philosophy.

## Correction Strategy

### 1. Kernel Extensions (`@symphonyscript/kernel`)
**Problem**: The `SiliconSynapse` exposes `getHead()` but currently lacks public methods for traversing the linked list or reading node data from the outside (without manual byte arithmetic).
**Solution**: I will unfreeze the Kernel to add a **ReadOnly Traversal API** to `SiliconSynapse`:
-   `getNext(ptr: NodePtr): NodePtr`
-   `getNodeData(ptr: NodePtr): PackedNodeData` (or individual field getters to maintain zero-alloc strictness).

### 2. Web Runtime Fix (`@symphonyscript/web`)
**Problem**: `SiliconProcessor` was passive.
**Solution**: I will rewrite `SiliconProcessor` to be the **active driver**.
-   **Initialization**: Accept `SharedArrayBuffer` via `postMessage('INIT')`.
-   **Loop (`process`)**:
    1.  Poll `SiliconSynapse` (updates playhead, handles commands).
    2.  Read `getHead()` from Synapse.
    3.  Traverse the list: `msg = getNode(ptr)`.
    4.  Feed `msg` to `PolyOscillator`.
    5.  Render Audio.

### 3. Driver Update
-   `createSymphonyWorklet` will accept `SiliconBridge` and extract the SAB (`bridge.getBuffer()`) to send to the Worklet.

## Execution Order
1.  **Modify Kernel**: Add traversal helpers.
2.  **Rebuild Kernel**: Verify exports.
3.  **Refactor Web**: Implement the correct polling loop.
4.  **Verify**: Re-run builds and tests.

**Status**: TRAVERSING.
Mending the signal path.
