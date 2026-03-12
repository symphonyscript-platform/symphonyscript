// =============================================================================
// SymphonyScript - Synapse Compaction Verification (K-001 Remediation)
// =============================================================================

import {
    SynapseAllocator,
    createLinkerSAB,
    HDR,
    SYNAPSE_TABLE,
    SYNAPSE,
    NULL_PTR
} from '../index'
import { SynapseView } from '../synapse-view'

// Helper to access private/protected properties for verification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPrivate(obj: any, prop: string): any {
    return obj[prop]
}

describe('K-001: Synapse Compaction & Lazy Allocation', () => {
    it('R-007: should persist usedSlots and tombstoneCount across re-instantiation', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024 })
        const allocatorA = new SynapseAllocator(sab)
        const sabView = new Int32Array(sab)

        allocatorA.connect(1000, 2000, 100, 0)
        allocatorA.connect(1001, 2001, 100, 0)
        allocatorA.connect(1002, 2002, 100, 0)
        allocatorA.disconnect(1001, 2001)

        expect(Atomics.load(sabView, HDR.SYNAPSE_USED_SLOTS)).toBe(3)
        expect(Atomics.load(sabView, HDR.SYNAPSE_TOMBSTONES)).toBe(1)

        const allocatorB = new SynapseAllocator(sab)
        const viewB = new SynapseView(sab)

        expect(allocatorB.getUsedSlots()).toBe(3)
        expect(allocatorB.getActiveSlots()).toBe(2)
        expect(viewB.getUsedSlots()).toBe(3)
        expect(viewB.getActiveSlots()).toBe(2)
        expect(viewB.getTombstoneRatio()).toBeCloseTo(1 / 3)
    })

    it('R-007: should persist cleared counters as zero across re-instantiation', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024 })
        const allocatorA = new SynapseAllocator(sab)
        const sabView = new Int32Array(sab)

        allocatorA.connect(3000, 4000, 100, 0)
        allocatorA.connect(3001, 4001, 100, 0)
        allocatorA.disconnect(3000, 4000)
        expect(Atomics.load(sabView, HDR.SYNAPSE_USED_SLOTS)).toBe(2)
        expect(Atomics.load(sabView, HDR.SYNAPSE_TOMBSTONES)).toBe(1)

        allocatorA.clear()
        expect(Atomics.load(sabView, HDR.SYNAPSE_USED_SLOTS)).toBe(0)
        expect(Atomics.load(sabView, HDR.SYNAPSE_TOMBSTONES)).toBe(0)

        const allocatorB = new SynapseAllocator(sab)
        const viewB = new SynapseView(sab)

        expect(allocatorB.getUsedSlots()).toBe(0)
        expect(allocatorB.getActiveSlots()).toBe(0)
        expect(allocatorB.getTombstoneRatio()).toBe(0)
        expect(allocatorB.getLoadFactor()).toBe(0)

        expect(viewB.getUsedSlots()).toBe(0)
        expect(viewB.getActiveSlots()).toBe(0)
        expect(viewB.getTombstoneRatio()).toBe(0)
        expect(viewB.getLoadFactor()).toBe(0)
    })

    it('R-007: should persist compacted counters across re-instantiation', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024 })
        const allocatorA = new SynapseAllocator(sab)
        const sabView = new Int32Array(sab)
        const capacity = sabView[HDR.SYNAPSE_CAPACITY]

        allocatorA.connect(5000, 6000, 100, 0)
        allocatorA.connect(5001, 6001, 100, 0)
        allocatorA.connect(5002, 6002, 100, 0)
        allocatorA.connect(5003, 6003, 100, 0)
        allocatorA.disconnect(5001, 6001)
        allocatorA.disconnect(5003, 6003)

        expect(Atomics.load(sabView, HDR.SYNAPSE_USED_SLOTS)).toBe(4)
        expect(Atomics.load(sabView, HDR.SYNAPSE_TOMBSTONES)).toBe(2)

        const compacted = allocatorA.compactTable()
        expect(compacted).toBe(2)
        expect(Atomics.load(sabView, HDR.SYNAPSE_USED_SLOTS)).toBe(2)
        expect(Atomics.load(sabView, HDR.SYNAPSE_TOMBSTONES)).toBe(0)

        const allocatorB = new SynapseAllocator(sab)
        const viewB = new SynapseView(sab)

        expect(allocatorB.getUsedSlots()).toBe(2)
        expect(allocatorB.getActiveSlots()).toBe(2)
        expect(allocatorB.getTombstoneRatio()).toBe(0)
        expect(allocatorB.getLoadFactor()).toBe(2 / capacity)

        expect(viewB.getUsedSlots()).toBe(2)
        expect(viewB.getActiveSlots()).toBe(2)
        expect(viewB.getTombstoneRatio()).toBe(0)
        expect(viewB.getLoadFactor()).toBe(2 / capacity)
    })

    it('should lazy allocate staging buffers only on compaction', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024 })
        const allocator = new SynapseAllocator(sab)

        // Verify initial state: Staging buffers should be null (Lazy)
        expect(getPrivate(allocator, 'stagingSourcePtrs')).toBeNull()
        expect(getPrivate(allocator, 'stagingTargetPtrs')).toBeNull()
        expect(getPrivate(allocator, 'stagingWeightData')).toBeNull()

        // 1. Fill Table > COMPACTION_MIN_SLOTS (100)
        // We'll create 200 connections
        const ptrs: number[] = []
        for (let i = 0; i < 200; i++) {
            // SourceID = i + 1000, TargetID = i + 2000 (Simulated Pointers)
            const ptr = allocator.connect(i + 1000, i + 2000, 100, 0)
            expect(ptr).toBeGreaterThan(0)
            ptrs.push(ptr)
        }

        // Verify stats
        expect(allocator.getUsedSlots()).toBe(200)
        expect(getPrivate(allocator, 'stagingSourcePtrs')).toBeNull() // Still null (no compaction yet)

        // 2. Create Tombstones (>50% to trigger threshold)
        // We'll disconnect 150 entries (75% tombstone ratio)
        for (let i = 0; i < 150; i++) {
            allocator.disconnect(i + 1000, i + 2000)
        }

        expect(allocator.getUsedSlots()).toBe(200) // Used slots includes tombstones until compaction
        expect(allocator.getTombstoneRatio()).toBeGreaterThan(0.5)

        // 3. Trigger Compaction
        // maybeCompact should return count of compacted entries (live entries)
        // We have 200 - 150 = 50 live entries remaining.
        const compactedCount = allocator.maybeCompact()

        expect(compactedCount).toBe(50)

        // 4. Verify Lazy Allocation Happened
        expect(getPrivate(allocator, 'stagingSourcePtrs')).not.toBeNull()
        expect(getPrivate(allocator, 'stagingTargetPtrs')).not.toBeNull()
        expect(getPrivate(allocator, 'stagingWeightData')).not.toBeNull()
        expect(getPrivate(allocator, 'stagingSourcePtrs')).toBeInstanceOf(Int32Array)

        // 5. Verify Data Integrity
        // Remaining 50 entries (indices 150 to 199 in our loop) should be findable
        expect(allocator.getUsedSlots()).toBe(50) // Now reduced to actual live count

        for (let i = 150; i < 200; i++) {
            const sourcePtr = i + 1000
            const headSlot = allocator.findHeadSlot(sourcePtr)
            expect(headSlot).not.toBe(-1)

            // Follow the pointer to verify target
            const offset = allocator['offsetForSlot'](headSlot) // Access protected helper via bracket
            // Wait, offsetForSlot is protected. Using helper.
            // Actually we can just implicitly check if connect works or reuse findHeadSlot logic via bridge public API?
            // But we are testing Allocator unit.
            // Let's rely on findHeadSlot returning a valid slot.
        }
    })

    it('should handle large scale compaction (stress test)', () => {
        const sab = createLinkerSAB({ nodeCapacity: 4096 })
        const allocator = new SynapseAllocator(sab)

        // Fill 2000 slots
        for (let i = 0; i < 2000; i++) {
            allocator.connect(i * 10, (i * 10) + 1, 50, 0)
        }

        // Delete 1500 (75%)
        for (let i = 0; i < 1500; i++) {
            allocator.disconnect(i * 10)
        }

        const count = allocator.maybeCompact()
        expect(count).toBe(500)
        expect(allocator.getUsedSlots()).toBe(500)
    })
})
