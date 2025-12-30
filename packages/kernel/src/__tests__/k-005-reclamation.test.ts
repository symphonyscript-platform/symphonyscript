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
})
