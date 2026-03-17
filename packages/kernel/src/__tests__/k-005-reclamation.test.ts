// =============================================================================
// SymphonyScript - Zone B Reclamation Verification (K-005)
// =============================================================================

import {
    SiliconBridge,
    SiliconSynapse,
    createLinkerSAB,
    HDR,
    ERROR,
    NODE_SIZE_BYTES
} from '../index'

// Helper to access private internals
function getPrivate(obj: any, prop: string): any {
    return obj[prop]
}

describe('K-005: Zone B Reclamation', () => {
    it('should reuse deleted Zone B nodes', async () => {
        // Disable safe zone to allow immediate deletion at tick 0
        // This allows us to verify reclamation synchronously without advancing playhead
        const sab = createLinkerSAB({ nodeCapacity: 1024, safeZoneTicks: 0 })!
        const linker = new SiliconSynapse(sab)
        const bridge = new SiliconBridge(linker)

        // 1. Insert a note (Allocates from Zone B)
        // insertNoteDebounced(pitch, velocity, duration, baseTick, muted)
        const sourceId1 = bridge.insertNoteDebounced(60, 100, 480, 0, false)

        // Flush Bridge (Writes to Command Ring)
        bridge.flushStructural()

        // Process command (Linker reads Command Ring, writes to Synapse Table/Heap)
        linker.processCommands()

        // Get the pointer for this note (via mapping)
        // We spy on LocalAllocator state from Bridge
        const localAlloc = getPrivate(bridge, 'localAllocator')
        const ptr1 = getPrivate(localAlloc, 'nextPtr') - NODE_SIZE_BYTES

        // 2. Delete the note
        bridge.deleteNoteDebounced(sourceId1)
        bridge.flushStructural()

        // Process command (Linker executes DELETE -> Pushes to Reclaim Ring)
        linker.processCommands()

        // 3. Flush Bridge (Should Poll Reclaim Ring -> Free to Local List)
        // Note: flushStructural() in K-005 plan includes pollReclaim()
        bridge.flushStructural()

        // 4. Insert another note
        const sourceId2 = bridge.insertNoteDebounced(64, 100, 480, 0, false)
        bridge.flushStructural()
        linker.processCommands()

        const ptr2 = getPrivate(localAlloc, 'nextPtr') - NODE_SIZE_BYTES

        // With bump pointer only (current state), ptr2 will be ptr1 + 32
        // With reclamation, ptr2 should be ptr1 (popped from free list)

        expect(ptr2).toBe(ptr1)
    })

    it('R-001: should not advance tail or overwrite slot when reclaim ring is full (modular)', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024, safeZoneTicks: 0 })!
        const linker = new SiliconSynapse(sab)
        const bridge = new SiliconBridge(linker)
        const view = new Int32Array(sab)

        const sourceId = bridge._insertNoteImmediate({ pitch: 60, velocity: 100, duration: 480, baseTick: 0 })
        const ptr = bridge.getNodePtr(sourceId)
        expect(ptr).toBeDefined()

        // Force a tiny full ring to hit overflow branch deterministically:
        // modular full when nextTail === head.
        Atomics.store(view, HDR.RECLAIM_RB_CAPACITY, 8)
        Atomics.store(view, HDR.RECLAIM_RB_HEAD, 3)
        Atomics.store(view, HDR.RECLAIM_RB_TAIL, 2) // nextTail=(2+1)&7 => 3 => full

        const ringDataI32 = Atomics.load(view, HDR.RECLAIM_RING_PTR) / 4
        const tailBefore = Atomics.load(view, HDR.RECLAIM_RB_TAIL)
        const slotIdx = tailBefore & 7 // mask for capacity=8
        const sentinel = 0x12345678
        Atomics.store(view, ringDataI32 + slotIdx, sentinel)
        Atomics.store(view, HDR.ERROR_FLAG, ERROR.OK)

        const result = bridge.deleteNoteImmediate(sourceId)
        expect(result).toBe(0)

        // R-001 correctness: full ring must not mutate data or tail.
        expect(Atomics.load(view, HDR.RECLAIM_RB_TAIL)).toBe(tailBefore)
        expect(Atomics.load(view, ringDataI32 + slotIdx)).toBe(sentinel)
        expect(Atomics.load(view, HDR.ERROR_FLAG) & ERROR.RECLAIM_OVERFLOW).toBe(ERROR.RECLAIM_OVERFLOW)

        // Lock/release behavior is preserved (mutex not leaked on overflow branch).
        expect(linker.acquireMutex()).toBe(true)
        linker.releaseMutex()
    })

    it('R-001: should enqueue reclaim pointer and wrap tail modulo capacity', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024, safeZoneTicks: 0 })!
        const linker = new SiliconSynapse(sab)
        const bridge = new SiliconBridge(linker)
        const view = new Int32Array(sab)

        const sourceId = bridge._insertNoteImmediate({ pitch: 64, velocity: 100, duration: 480, baseTick: 0 })
        const ptr = bridge.getNodePtr(sourceId)
        expect(ptr).toBeDefined()
        const nodePtr = ptr as number

        Atomics.store(view, HDR.RECLAIM_RB_CAPACITY, 8)
        Atomics.store(view, HDR.RECLAIM_RB_HEAD, 3)
        Atomics.store(view, HDR.RECLAIM_RB_TAIL, 7) // not full, nextTail wraps to 0

        const ringDataI32 = Atomics.load(view, HDR.RECLAIM_RING_PTR) / 4
        const tailBefore = Atomics.load(view, HDR.RECLAIM_RB_TAIL)
        const slotIdx = tailBefore & 7
        Atomics.store(view, ringDataI32 + slotIdx, -1)
        Atomics.store(view, HDR.ERROR_FLAG, ERROR.OK)

        const result = bridge.deleteNoteImmediate(sourceId)
        expect(result).toBe(0)

        expect(Atomics.load(view, HDR.RECLAIM_RB_TAIL)).toBe(0)
        expect(Atomics.load(view, ringDataI32 + slotIdx)).toBe(nodePtr)
        expect(Atomics.load(view, HDR.ERROR_FLAG) & ERROR.RECLAIM_OVERFLOW).toBe(0)
    })

    it('R-001: pollReclaim should drain wrapped ring and preserve empty semantics', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024, safeZoneTicks: 0 })!
        const linker = new SiliconSynapse(sab)
        const bridge = new SiliconBridge(linker)
        const view = new Int32Array(sab)

        const localAlloc = getPrivate(bridge, 'localAllocator')
        const ptrA = localAlloc.alloc()
        const ptrB = localAlloc.alloc()
        const ptrC = localAlloc.alloc()

        expect(ptrA).toBeGreaterThan(0)
        expect(ptrB).toBeGreaterThan(0)
        expect(ptrC).toBeGreaterThan(0)

        Atomics.store(view, HDR.RECLAIM_RB_CAPACITY, 8)
        Atomics.store(view, HDR.RECLAIM_RB_HEAD, 7)
        Atomics.store(view, HDR.RECLAIM_RB_TAIL, 2) // entries at [7,0,1]

        const ringDataI32 = Atomics.load(view, HDR.RECLAIM_RING_PTR) / 4
        Atomics.store(view, ringDataI32 + 7, ptrA)
        Atomics.store(view, ringDataI32 + 0, ptrB)
        Atomics.store(view, ringDataI32 + 1, ptrC)

        bridge.flushStructural() // calls pollReclaim()

        expect(Atomics.load(view, HDR.RECLAIM_RB_HEAD)).toBe(2)
        expect(Atomics.load(view, HDR.RECLAIM_RB_TAIL)).toBe(2)

        // LIFO free-list order after draining A -> B -> C is C, B, A.
        expect(localAlloc.alloc()).toBe(ptrC)
        expect(localAlloc.alloc()).toBe(ptrB)
        expect(localAlloc.alloc()).toBe(ptrA)

        // Empty ring remains stable on additional polls.
        bridge.flushStructural()
        expect(Atomics.load(view, HDR.RECLAIM_RB_HEAD)).toBe(2)
        expect(Atomics.load(view, HDR.RECLAIM_RB_TAIL)).toBe(2)
    })

    it('executeClear should not free Zone B nodes to Zone A free list', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024, safeZoneTicks: 0 })!
        const linker = new SiliconSynapse(sab)
        const bridge = new SiliconBridge(linker)

        // Record Zone A free count before inserting
        const freeCountBefore = linker.getFreeCount()

        // Insert 3 notes via Bridge (allocates Zone B nodes)
        bridge._insertNoteImmediate({ pitch: 60, velocity: 100, duration: 480, baseTick: 0 })
        bridge._insertNoteImmediate({ pitch: 64, velocity: 100, duration: 480, baseTick: 480 })
        bridge._insertNoteImmediate({ pitch: 67, velocity: 100, duration: 480, baseTick: 960 })

        expect(linker.getNodeCount()).toBe(3)

        // Zone A free count should be unchanged (nodes came from Zone B)
        expect(linker.getFreeCount()).toBe(freeCountBefore)

        // Clear all nodes
        bridge.clear()

        expect(linker.getNodeCount()).toBe(0)

        // BUG FIX VERIFICATION: Zone A free count must remain unchanged.
        // Before the fix, executeClear freed Zone B pointers into Zone A free list,
        // inflating the count by 3 and risking double-use corruption.
        expect(linker.getFreeCount()).toBe(freeCountBefore)
    })

    it('clear then re-insert should not cause pointer corruption', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024, safeZoneTicks: 0 })!
        const linker = new SiliconSynapse(sab)
        const bridge = new SiliconBridge(linker)

        // Insert notes (Zone B)
        const id1 = bridge._insertNoteImmediate({ pitch: 60, velocity: 100, duration: 480, baseTick: 0 })
        const id2 = bridge._insertNoteImmediate({ pitch: 64, velocity: 100, duration: 480, baseTick: 480 })
        expect(id1).toBeGreaterThan(0)
        expect(id2).toBeGreaterThan(0)
        expect(linker.getNodeCount()).toBe(2)

        // Clear
        bridge.clear()
        expect(linker.getNodeCount()).toBe(0)

        // Re-insert after clear — Zone B allocator was reset, so new nodes
        // get fresh Zone B pointers without corrupting Zone A.
        const id3 = bridge._insertNoteImmediate({ pitch: 72, velocity: 100, duration: 480, baseTick: 0 })
        const id4 = bridge._insertNoteImmediate({ pitch: 76, velocity: 100, duration: 480, baseTick: 480 })
        expect(id3).toBeGreaterThan(0)
        expect(id4).toBeGreaterThan(0)
        expect(linker.getNodeCount()).toBe(2)

        // Verify notes are readable and correct
        let pitch3 = -1
        let pitch4 = -1
        bridge.readNote(id3, (p) => { pitch3 = p })
        bridge.readNote(id4, (p) => { pitch4 = p })
        expect(pitch3).toBe(72)
        expect(pitch4).toBe(76)
    })
})
