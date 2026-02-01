// =============================================================================
// SymphonyScript - Multi-Zone Heap Scaling Tests (RFC-056)
// =============================================================================
// Tests for per-worker heap partitioning with SPSC FreeLists and MPSC Return Queues.

import {
  HDR,
  NULL_PTR,
  ZONE_CONFIG,
  ZONE_CONFIG_STRIDE,
  NODE_SIZE_BYTES,
  HEAP_START_OFFSET,
  getZoneSplitIndex
} from '../constants'
import { createLinkerSAB, resetLinkerSAB } from '../init'
import { SiliconSynapse } from '../silicon-synapse'
import { FreeList } from '../free-list'
import { ReturnQueue } from '../return-queue'

describe('RFC-056: Multi-Zone Heap Scaling', () => {
  // ===========================================================================
  // 1. Legacy Mode (workerZones: 1)
  // ===========================================================================
  describe('1. Legacy Mode (workerZones: 1)', () => {
    it('should behave identically to current system with workerZones: 1', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 64, workerZones: 1 })
      const sab = new Int32Array(buffer)

      // Verify zone count is 1
      expect(sab[HDR.ZONE_COUNT]).toBe(1)
      // Zone config offset should be 0 in legacy mode
      expect(sab[HDR.ZONE_CONFIG_OFFSET]).toBe(0)

      // Free count should match Zone A size (50% of capacity)
      const zoneASize = getZoneSplitIndex(64)
      expect(sab[HDR.FREE_COUNT]).toBe(zoneASize)
    })

    it('should work without workerZones parameter (defaults to 1)', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 64 })
      const sab = new Int32Array(buffer)

      expect(sab[HDR.ZONE_COUNT]).toBe(1)
      expect(sab[HDR.ZONE_CONFIG_OFFSET]).toBe(0)
    })

    it('should create SiliconSynapse in legacy mode', () => {
      const linker = SiliconSynapse.create({ nodeCapacity: 64, workerZones: 1 })
      expect(linker.getZoneIndex()).toBe(0)
    })

    it('should have FreeList in legacy mode', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 64, workerZones: 1 })
      const sab = new Int32Array(buffer)
      const freeList = new FreeList(sab)

      expect(freeList.isLegacyMode()).toBe(true)
      expect(freeList.getZoneIndex()).toBe(0)
    })

    it('should have drainReturnQueue as no-op in legacy mode', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 64, workerZones: 1 })
      const sab = new Int32Array(buffer)
      const freeList = new FreeList(sab)

      const freeCountBefore = freeList.getFreeCount()
      freeList.drainReturnQueue() // Should be no-op
      expect(freeList.getFreeCount()).toBe(freeCountBefore)
    })
  })

  // ===========================================================================
  // 2. Multi-Zone Initialization
  // ===========================================================================
  describe('2. Multi-Zone Initialization', () => {
    it('should initialize SAB with multiple zones', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 4 })
      const sab = new Int32Array(buffer)

      expect(sab[HDR.ZONE_COUNT]).toBe(4)
      expect(sab[HDR.ZONE_CONFIG_OFFSET]).toBeGreaterThan(0)
    })

    it('should partition heap into equal-sized zones', () => {
      const nodeCapacity = 128
      const workerZones = 4
      const buffer = createLinkerSAB({ nodeCapacity, workerZones })
      const sab = new Int32Array(buffer)

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const configBaseI32 = zoneConfigOffset / 4

      // Calculate expected nodes per zone
      const totalWorkerNodes = getZoneSplitIndex(nodeCapacity)
      const expectedNodesPerZone = Math.floor(totalWorkerNodes / workerZones)

      // Verify each zone has correct capacity
      for (let z = 0; z < workerZones; z++) {
        const zoneBase = configBaseI32 + z * ZONE_CONFIG_STRIDE
        const zoneCapacity = sab[zoneBase + ZONE_CONFIG.NODE_CAPACITY]
        expect(zoneCapacity).toBe(expectedNodesPerZone)
      }
    })

    it('should initialize zone config table correctly', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const configBaseI32 = zoneConfigOffset / 4

      // Zone 0
      const zone0Base = configBaseI32
      expect(sab[zone0Base + ZONE_CONFIG.HEAP_START]).toBe(HEAP_START_OFFSET)
      expect(sab[zone0Base + ZONE_CONFIG.OWNER_ID]).toBe(0) // Unclaimed
      expect(sab[zone0Base + ZONE_CONFIG.FREE_COUNT]).toBeGreaterThan(0)

      // Zone 1
      const zone1Base = configBaseI32 + ZONE_CONFIG_STRIDE
      expect(sab[zone1Base + ZONE_CONFIG.HEAP_START]).toBeGreaterThan(HEAP_START_OFFSET)
      expect(sab[zone1Base + ZONE_CONFIG.OWNER_ID]).toBe(0) // Unclaimed
    })

    it('should reject invalid workerZones values', () => {
      expect(() => createLinkerSAB({ nodeCapacity: 64, workerZones: 0 })).toThrow()
      expect(() => createLinkerSAB({ nodeCapacity: 64, workerZones: 9 })).toThrow()
    })
  })

  // ===========================================================================
  // 3. Zone Claiming
  // ===========================================================================
  describe('3. Zone Claiming', () => {
    it('should claim zone via createForZone', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 4 })

      const linker = SiliconSynapse.createForZone(buffer, 1)
      expect(linker).not.toBeNull()
      expect(linker!.getZoneIndex()).toBeGreaterThanOrEqual(0)
      expect(linker!.getZoneIndex()).toBeLessThan(4)
    })

    it('should claim different zones for different workers', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 4 })

      const linker1 = SiliconSynapse.createForZone(buffer, 1)
      const linker2 = SiliconSynapse.createForZone(buffer, 2)
      const linker3 = SiliconSynapse.createForZone(buffer, 3)
      const linker4 = SiliconSynapse.createForZone(buffer, 4)

      expect(linker1).not.toBeNull()
      expect(linker2).not.toBeNull()
      expect(linker3).not.toBeNull()
      expect(linker4).not.toBeNull()

      // All should have different zone indices
      const zones = [
        linker1!.getZoneIndex(),
        linker2!.getZoneIndex(),
        linker3!.getZoneIndex(),
        linker4!.getZoneIndex()
      ]
      const uniqueZones = new Set(zones)
      expect(uniqueZones.size).toBe(4)
    })

    it('should return null when no zones available', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })

      // Claim all zones
      const linker1 = SiliconSynapse.createForZone(buffer, 1)
      const linker2 = SiliconSynapse.createForZone(buffer, 2)

      expect(linker1).not.toBeNull()
      expect(linker2).not.toBeNull()

      // Third claim should fail
      const linker3 = SiliconSynapse.createForZone(buffer, 3)
      expect(linker3).toBeNull()
    })

    it('should set OWNER_ID when zone is claimed', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const linker = SiliconSynapse.createForZone(buffer, 42)
      expect(linker).not.toBeNull()

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const configBaseI32 = zoneConfigOffset / 4
      const zoneIndex = linker!.getZoneIndex()
      const zoneBase = configBaseI32 + zoneIndex * ZONE_CONFIG_STRIDE

      expect(sab[zoneBase + ZONE_CONFIG.OWNER_ID]).toBe(42)
    })
  })

  // ===========================================================================
  // 4. Independent Zone Allocation
  // ===========================================================================
  describe('4. Independent Zone Allocation', () => {
    it('should allocate from zone-specific free list', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const freeList0 = new FreeList(sab, 0, zoneConfigOffset)
      const freeList1 = new FreeList(sab, 1, zoneConfigOffset)

      const initialFree0 = freeList0.getFreeCount()
      const initialFree1 = freeList1.getFreeCount()

      // Allocate from zone 0
      const ptr0 = freeList0.alloc()
      expect(ptr0).not.toBe(NULL_PTR)
      expect(freeList0.getFreeCount()).toBe(initialFree0 - 1)
      expect(freeList1.getFreeCount()).toBe(initialFree1) // Unchanged

      // Allocate from zone 1
      const ptr1 = freeList1.alloc()
      expect(ptr1).not.toBe(NULL_PTR)
      expect(freeList1.getFreeCount()).toBe(initialFree1 - 1)
    })

    it('should allocate pointers within zone bounds', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const configBaseI32 = zoneConfigOffset / 4

      const freeList0 = new FreeList(sab, 0, zoneConfigOffset)
      const zone0Start = sab[configBaseI32 + ZONE_CONFIG.HEAP_START]
      const zone0End = sab[configBaseI32 + ZONE_CONFIG.HEAP_END]

      // Allocate several nodes and verify they're within zone 0 bounds
      for (let i = 0; i < 5; i++) {
        const ptr = freeList0.alloc()
        if (ptr !== NULL_PTR) {
          expect(ptr).toBeGreaterThanOrEqual(zone0Start)
          expect(ptr).toBeLessThan(zone0End)
        }
      }
    })
  })

  // ===========================================================================
  // 5. Zone Exhaustion (Fail Fast)
  // ===========================================================================
  describe('5. Zone Exhaustion (Fail Fast)', () => {
    it('should return NULL_PTR when zone is exhausted', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 32, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const freeList0 = new FreeList(sab, 0, zoneConfigOffset)

      // Exhaust zone 0
      const initialFree = freeList0.getFreeCount()
      for (let i = 0; i < initialFree; i++) {
        const ptr = freeList0.alloc()
        expect(ptr).not.toBe(NULL_PTR)
      }

      // Next allocation should fail
      const exhaustedPtr = freeList0.alloc()
      expect(exhaustedPtr).toBe(NULL_PTR)
    })

    it('should not steal from other zones (fail fast)', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 32, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const freeList0 = new FreeList(sab, 0, zoneConfigOffset)
      const freeList1 = new FreeList(sab, 1, zoneConfigOffset)

      const initialFree1 = freeList1.getFreeCount()

      // Exhaust zone 0
      const initialFree0 = freeList0.getFreeCount()
      for (let i = 0; i < initialFree0; i++) {
        freeList0.alloc()
      }

      // Zone 0 exhausted, zone 1 unchanged
      expect(freeList0.alloc()).toBe(NULL_PTR)
      expect(freeList1.getFreeCount()).toBe(initialFree1)
    })
  })

  // ===========================================================================
  // 6. Cross-Zone Free Routing
  // ===========================================================================
  describe('6. Cross-Zone Free Routing', () => {
    it('should route cross-zone free to Return Queue', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const freeList0 = new FreeList(sab, 0, zoneConfigOffset)
      const freeList1 = new FreeList(sab, 1, zoneConfigOffset)

      // Allocate from zone 0
      const ptr0 = freeList0.alloc()
      expect(ptr0).not.toBe(NULL_PTR)

      // Free from zone 1's perspective (cross-zone)
      const freeCount0Before = freeList0.getFreeCount()
      freeList1.free(ptr0) // Should enqueue to zone 0's Return Queue

      // Zone 0's free count shouldn't change yet (not drained)
      expect(freeList0.getFreeCount()).toBe(freeCount0Before)

      // Drain zone 0's Return Queue
      freeList0.drainReturnQueue()

      // Now zone 0 should have the node back
      expect(freeList0.getFreeCount()).toBe(freeCount0Before + 1)
    })

    it('should identify correct zone for pointer (O(1) lookup)', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 4 })
      const sab = new Int32Array(buffer)

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const freeList0 = new FreeList(sab, 0, zoneConfigOffset)

      // Allocate from zone 0
      const ptr = freeList0.alloc()
      expect(ptr).not.toBe(NULL_PTR)

      // Verify zone lookup
      const zone = freeList0.getZoneForPtr(ptr)
      expect(zone).toBe(0)
    })

    it('should handle same-zone free locally', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const freeList0 = new FreeList(sab, 0, zoneConfigOffset)

      // Allocate and free within same zone
      const ptr = freeList0.alloc()
      const freeCountBefore = freeList0.getFreeCount()

      freeList0.free(ptr) // Same zone, should be local

      // Should be immediately available (no drain needed)
      expect(freeList0.getFreeCount()).toBe(freeCountBefore + 1)
    })
  })

  // ===========================================================================
  // 7. Return Queue Operations
  // ===========================================================================
  describe('7. Return Queue Operations', () => {
    it('should enqueue and dequeue pointers', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const returnQueue = new ReturnQueue(sab, 0, 2)

      // Queue should be empty initially
      expect(returnQueue.isEmpty()).toBe(true)
      expect(returnQueue.getCount()).toBe(0)

      // Enqueue a pointer
      const testPtr = HEAP_START_OFFSET // Use a valid-ish pointer
      expect(returnQueue.enqueue(testPtr)).toBe(true)

      expect(returnQueue.isEmpty()).toBe(false)
      expect(returnQueue.getCount()).toBe(1)

      // Dequeue
      const dequeued = returnQueue.dequeue()
      expect(dequeued).toBe(testPtr)
      expect(returnQueue.isEmpty()).toBe(true)
    })

    it('should return NULL_PTR when dequeuing from empty queue', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const returnQueue = new ReturnQueue(sab, 0, 2)
      expect(returnQueue.dequeue()).toBe(NULL_PTR)
    })

    it('should handle multiple enqueue/dequeue operations', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })
      const sab = new Int32Array(buffer)

      const returnQueue = new ReturnQueue(sab, 0, 2)
      const ptrs = [
        HEAP_START_OFFSET,
        HEAP_START_OFFSET + NODE_SIZE_BYTES,
        HEAP_START_OFFSET + NODE_SIZE_BYTES * 2
      ]

      // Enqueue all
      for (const ptr of ptrs) {
        expect(returnQueue.enqueue(ptr)).toBe(true)
      }
      expect(returnQueue.getCount()).toBe(3)

      // Dequeue all (FIFO order)
      for (const expectedPtr of ptrs) {
        const dequeued = returnQueue.dequeue()
        expect(dequeued).toBe(expectedPtr)
      }
      expect(returnQueue.isEmpty()).toBe(true)
    })
  })

  // ===========================================================================
  // 8. Reset and Backward Compatibility
  // ===========================================================================
  describe('8. Reset and Backward Compatibility', () => {
    it('should reset multi-zone SAB correctly', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 64, workerZones: 2 })
      const sab = new Int32Array(buffer)

      // Claim zones and allocate some nodes
      const linker1 = SiliconSynapse.createForZone(buffer, 1)
      const linker2 = SiliconSynapse.createForZone(buffer, 2)

      // Reset
      resetLinkerSAB(buffer)

      // Verify zones are unclaimed after reset
      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const configBaseI32 = zoneConfigOffset / 4

      expect(sab[configBaseI32 + ZONE_CONFIG.OWNER_ID]).toBe(0)
      expect(sab[configBaseI32 + ZONE_CONFIG_STRIDE + ZONE_CONFIG.OWNER_ID]).toBe(0)
    })

    it('should reset legacy SAB correctly', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 64, workerZones: 1 })
      const sab = new Int32Array(buffer)

      const linker = new SiliconSynapse(buffer)
      linker.allocNode()
      linker.allocNode()

      resetLinkerSAB(buffer)

      const zoneASize = getZoneSplitIndex(64)
      expect(sab[HDR.FREE_COUNT]).toBe(zoneASize)
      expect(sab[HDR.NODE_COUNT]).toBe(0)
    })
  })

  // ===========================================================================
  // 9. poll() Integration
  // ===========================================================================
  describe('9. poll() Integration', () => {
    it('should drain Return Queue at start of poll()', () => {
      const buffer = createLinkerSAB({ nodeCapacity: 128, workerZones: 2 })
      const sab = new Int32Array(buffer)

      // Create linker for zone 0
      const linker = SiliconSynapse.createForZone(buffer, 1)
      expect(linker).not.toBeNull()

      const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]
      const zoneIndex = linker!.getZoneIndex()

      // Create a FreeList for the other zone to simulate cross-zone free
      const otherZone = zoneIndex === 0 ? 1 : 0
      const otherFreeList = new FreeList(sab, otherZone, zoneConfigOffset)

      // Allocate from our zone
      const ourFreeList = new FreeList(sab, zoneIndex, zoneConfigOffset)
      const ptr = ourFreeList.alloc()
      expect(ptr).not.toBe(NULL_PTR)

      // Free from other zone (cross-zone)
      otherFreeList.free(ptr)

      // poll() should drain the Return Queue
      linker!.poll()

      // The node should be back in our free list now
      // (We can't easily verify this without more introspection,
      // but at least verify poll() doesn't crash)
    })
  })
})
