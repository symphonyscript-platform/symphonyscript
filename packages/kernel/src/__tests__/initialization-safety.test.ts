
import { createLinkerSAB, resetLinkerSAB } from '../init'
import { HEAP_START_OFFSET, NODE_SIZE_BYTES } from '../constants'

function getZoneSplitIndex(capacity: number) {
    return Math.floor(capacity / 2)
}

describe('Initialization Safety (K-003)', () => {
    test('should explicitly zero Zone B on initialization', () => {
        // 1. Create a raw buffer manually to simulate "Dirty Memory"
        // Use slightly larger capacity to ensure we have a Zone B
        const capacity = 256
        // Calculate total size based on capacity (approx formula for test)
        // We can use createLinkerSAB to get a valid buffer structure first
        const buffer = createLinkerSAB({ nodeCapacity: capacity })
        const sab = new Int32Array(buffer)

        // 2. Pollute Zone B with garbage data
        // Zone B starts after split index
        // We need to calculate split index logic manually if not exported, 
        // but better to import from constants if possible. 
        // Per RFC-044, split index is capacity / 2 usually? 
        // Let's rely on importing getZoneSplitIndex if possible, or replicate logic: Math.floor(capacity / 2)
        const splitIndex = Math.floor(capacity / 2)
        const heapStartI32 = HEAP_START_OFFSET / 4
        const zoneBStartI32 = heapStartI32 + (splitIndex * (32 / 4)) // 32 bytes = 8 ints

        // Write garbage to the first node of Zone B
        sab[zoneBStartI32 + 0] = 0xDEADBEEF // PACKED_A
        sab[zoneBStartI32 + 3] = 0xCAFEBABE // NEXT_PTR

        // 3. Re-initialize the buffer (Simulation of kernel reset)
        // We need to access FreeList.initialize or rebuild the SAB using createLinkerSAB logic 
        // BUT createLinkerSAB creates a NEW buffer usually.
        // We want to test explicit clearing.
        // The issue K-003 is about `resetLinkerSAB` or `FreeList.initialize` being called on *existing* buffer.

        // So let's call resetLinkerSAB if available
        const { resetLinkerSAB } = require('../init')
        resetLinkerSAB(buffer)

        // 4. Assert Zone B is STILL dirty (Zero-on-Alloc strategy)
        // With the new K-003 strategy, resetLinkerSAB does NOT clear Zone B.
        // It relies on LocalAllocator to clean as it goes.
        expect(sab[zoneBStartI32 + 0]).not.toBe(0) // Should be DEADBEEF

        // 5. Allocate a node using LocalAllocator
        // We need to instantiate it (mocking the Bridge's usage)
        const { LocalAllocator } = require('../local-allocator')
        const allocator = new LocalAllocator(sab, capacity)

        // alloc() should return the first slot of Zone B (zoneBStartI32 * 4)
        // AND it should zero it out before returning.
        const ptr = allocator.alloc()
        const index = ptr / 4

        // 6. Assert the allocated node is now Clean
        expect(index).toBe(zoneBStartI32)
        expect(sab[index + 0]).toBe(0) // PACKED_A cleared
        expect(sab[index + 3]).toBe(0) // NEXT_PTR cleared
    })
})
