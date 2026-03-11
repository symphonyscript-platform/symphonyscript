// =============================================================================
// SymphonyScript - Zone B Reclamation Verification (K-005)
// =============================================================================

import {
    SiliconBridge,
    SiliconSynapse,
    createLinkerSAB,
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
        const sab = createLinkerSAB({ nodeCapacity: 1024, safeZoneTicks: 0 })
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

    it('should handle reclaim ring wrap-around', () => {
        // TODO: Implement stress test once basic reuse works (Future Task)
    })

    it('executeClear should not free Zone B nodes to Zone A free list', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024, safeZoneTicks: 0 })
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
        const sab = createLinkerSAB({ nodeCapacity: 1024, safeZoneTicks: 0 })
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
