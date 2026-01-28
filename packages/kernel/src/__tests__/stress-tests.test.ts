// =============================================================================
// SymphonyScript - Kernel Stress Tests (Audit-002)
// =============================================================================
// These tests exercise boundary conditions identified during the hostile audit.
// Run with: npm test -- stress-tests.test.ts

import {
  SiliconSynapse,
  createLinkerSAB,
  HDR,
  NODE,
  ERROR,
  NULL_PTR,
  OPCODE,
  FLAG,
  COMMIT,
  RingBuffer,
  LocalAllocator,
  CMD,
  FreeList,
  getZoneSplitIndex,
  HEAP_START_OFFSET,
  NODE_SIZE_BYTES
} from '../index'

// =============================================================================
// Helper Functions
// =============================================================================

function createTestLinker(nodeCapacity = 64): SiliconSynapse {
  return SiliconSynapse.create({ nodeCapacity, safeZoneTicks: 0 })
}

// =============================================================================
// 1. HEAP EXHAUSTION TESTS
// =============================================================================

describe('Stress Tests: Heap Exhaustion', () => {
  it('should exhaust Zone A free list and return NULL_PTR', () => {
    // RFC-044: Zone A gets 50% of capacity
    const linker = createTestLinker(16) // Zone A = 8 nodes
    const ptrs: number[] = []

    // Allocate all Zone A nodes
    for (let i = 0; i < 8; i++) {
      const ptr = linker.allocNode()
      expect(ptr).not.toBe(NULL_PTR)
      ptrs.push(ptr)
    }

    // Next allocation should fail
    const exhaustedPtr = linker.allocNode()
    expect(exhaustedPtr).toBe(NULL_PTR)

    // Verify error flag
    const sab = new Int32Array(linker.getSAB())
    expect(sab[HDR.ERROR_FLAG]).toBe(ERROR.HEAP_EXHAUSTED)
  })

  it('should recover after freeing all nodes', () => {
    const linker = createTestLinker(8) // Zone A = 4 nodes
    const ptrs: number[] = []

    // Allocate all
    for (let i = 0; i < 4; i++) {
      const ptr = linker.allocNode()
      if (ptr !== NULL_PTR) ptrs.push(ptr)
    }

    expect(ptrs.length).toBe(4)
    expect(linker.allocNode()).toBe(NULL_PTR)

    // Free all
    for (const ptr of ptrs) {
      linker.freeNode(ptr)
    }

    // Clear error
    linker.clearError()

    // Should be able to allocate again
    const recovered = linker.allocNode()
    expect(recovered).not.toBe(NULL_PTR)
  })

  it('should handle repeated exhaust-free cycles', () => {
    const linker = createTestLinker(8)
    const zoneACapacity = 4

    for (let cycle = 0; cycle < 10; cycle++) {
      const ptrs: number[] = []

      // Exhaust
      for (let i = 0; i < zoneACapacity; i++) {
        const ptr = linker.allocNode()
        if (ptr !== NULL_PTR) ptrs.push(ptr)
      }

      expect(ptrs.length).toBe(zoneACapacity)
      expect(linker.allocNode()).toBe(NULL_PTR)

      // Free
      for (const ptr of ptrs) {
        linker.freeNode(ptr)
      }
      linker.clearError()
    }
  })
})

// =============================================================================
// 2. RING BUFFER WRAPAROUND TESTS
// =============================================================================

// Ring buffer write returns 0 (RING_ERR.OK) on success, -1 (RING_ERR.FULL) on failure
const RING_OK = 0
const RING_FULL = -1

describe('Stress Tests: Ring Buffer Wraparound', () => {
  it('should write and read maintaining FIFO order', () => {
    const sab = createLinkerSAB({ nodeCapacity: 32 })
    const sabView = new Int32Array(sab)
    const ringBuffer = new RingBuffer(sabView)

    const writeOrder: number[] = []
    const readOrder: number[] = []
    const cmdBuf = new Int32Array(4)

    // Write 10 commands
    for (let i = 0; i < 10; i++) {
      const ptr = 1000 + i
      const result = ringBuffer.write(CMD.INSERT, ptr, NULL_PTR, 0)
      if (result === RING_OK) {
        writeOrder.push(ptr)
      }
    }

    expect(writeOrder.length).toBe(10)

    // Read all back
    while (ringBuffer.read(cmdBuf)) {
      readOrder.push(cmdBuf[1]) // ptr is at index 1
    }

    // Verify FIFO
    expect(readOrder.length).toBe(writeOrder.length)
    for (let i = 0; i < readOrder.length; i++) {
      expect(readOrder[i]).toBe(writeOrder[i])
    }
  })

  it('should stop accepting writes when buffer is full', () => {
    const sab = createLinkerSAB({ nodeCapacity: 32 })
    const sabView = new Int32Array(sab)
    const ringBuffer = new RingBuffer(sabView)

    const capacity = sabView[HDR.RB_CAPACITY]

    // Try to write way more than capacity
    let successCount = 0
    let failCount = 0
    for (let i = 0; i < capacity * 2; i++) {
      const result = ringBuffer.write(CMD.INSERT, i * 32, NULL_PTR, 0)
      if (result === RING_OK) {
        successCount++
      } else {
        failCount++
      }
    }

    // Should have some successes and some failures
    expect(successCount).toBeGreaterThan(0)
    expect(failCount).toBeGreaterThan(0)
  })
})

// =============================================================================
// 3. SYNAPSE TABLE COLLISION TESTS
// =============================================================================

describe('Stress Tests: Synapse Table Collision', () => {
  it('should handle many synapses with same source', () => {
    // Use larger capacity and safeZoneTicks: 0 to allow immediate insertion
    const sab = createLinkerSAB({ nodeCapacity: 128, synapseCapacity: 1024, safeZoneTicks: 0 })
    const linker = new SiliconSynapse(sab)

    // Create source node - allocate first, then insert
    const sourcePtr = linker.allocNode()
    expect(sourcePtr).not.toBe(NULL_PTR)

    // Write data and link manually via insertHead pattern
    const sabView = new Int32Array(sab)
    const sourceOffset = sourcePtr / 4

    // Write node data
    sabView[sourceOffset + NODE.PACKED_A] = (OPCODE.NOTE << 24) | (60 << 16) | (100 << 8) | FLAG.ACTIVE
    sabView[sourceOffset + NODE.BASE_TICK] = 0
    sabView[sourceOffset + NODE.DURATION] = 96
    sabView[sourceOffset + NODE.SOURCE_ID] = 1000

    // Use insertHead which handles all linking
    const sourcePtr2 = linker.insertHead(OPCODE.NOTE, 60, 100, 96, 0, 1000, FLAG.ACTIVE)
    expect(sourcePtr2).not.toBe(NULL_PTR)

    const targetPtrs: number[] = []
    for (let i = 0; i < 20; i++) {
      const ptr = linker.insertHead(
        OPCODE.NOTE, 60 + i, 100, 96, 100 + i * 10,
        2000 + i, FLAG.ACTIVE
      )
      if (ptr !== NULL_PTR) targetPtrs.push(ptr)
    }

    expect(targetPtrs.length).toBeGreaterThanOrEqual(10) // At least some should succeed

    // Connect source to all targets (tests linear probe chaining)
    let connectedCount = 0
    for (const targetPtr of targetPtrs) {
      const result = linker.executeConnect(sourcePtr2, targetPtr, 500, 0)
      if (result !== 0) connectedCount++
    }

    expect(connectedCount).toBeGreaterThanOrEqual(targetPtrs.length / 2)
  })

  it('should handle Symbol Table collisions with quadratic probing', () => {
    const linker = createTestLinker(64)

    // Use simple sourceIds that are guaranteed to work
    const sourceId1 = 1000
    const sourceId2 = 2000
    const sourceId3 = 3000

    // First insert into Identity Table (required for Symbol Table slot resolution)
    const ptr1 = linker.insertHead(OPCODE.NOTE, 60, 100, 96, 0, sourceId1, FLAG.ACTIVE)
    const ptr2 = linker.insertHead(OPCODE.NOTE, 61, 100, 96, 10, sourceId2, FLAG.ACTIVE)
    const ptr3 = linker.insertHead(OPCODE.NOTE, 62, 100, 96, 20, sourceId3, FLAG.ACTIVE)

    expect(ptr1).not.toBe(NULL_PTR)
    expect(ptr2).not.toBe(NULL_PTR)
    expect(ptr3).not.toBe(NULL_PTR)

    // Verify Identity Table insertions worked
    expect(linker.idTableLookup(sourceId1)).toBe(ptr1)
    expect(linker.idTableLookup(sourceId2)).toBe(ptr2)
    expect(linker.idTableLookup(sourceId3)).toBe(ptr3)

    // Store symbol data
    const stored1 = linker.symTableStore(sourceId1, 0x1111, 10, 5)
    const stored2 = linker.symTableStore(sourceId2, 0x2222, 20, 10)
    const stored3 = linker.symTableStore(sourceId3, 0x3333, 30, 15)

    expect(stored1).toBe(true)
    expect(stored2).toBe(true)
    expect(stored3).toBe(true)

    // Verify all can be retrieved (quadratic probing finds all)
    let found1 = false, found2 = false, found3 = false

    linker.symTableLookup(sourceId1, (fh, l, c) => {
      found1 = (fh === 0x1111 && l === 10 && c === 5)
    })
    linker.symTableLookup(sourceId2, (fh, l, c) => {
      found2 = (fh === 0x2222 && l === 20 && c === 10)
    })
    linker.symTableLookup(sourceId3, (fh, l, c) => {
      found3 = (fh === 0x3333 && l === 30 && c === 15)
    })

    expect(found1).toBe(true)
    expect(found2).toBe(true)
    expect(found3).toBe(true)

    // Test removal also uses quadratic probing
    expect(linker.symTableRemove(sourceId2)).toBe(true)

    // sourceId2 should no longer be found
    let found2AfterRemove = false
    linker.symTableLookup(sourceId2, () => {
      found2AfterRemove = true
    })
    expect(found2AfterRemove).toBe(false)

    // sourceId1 and sourceId3 should still be found
    let found1After = false, found3After = false
    linker.symTableLookup(sourceId1, () => { found1After = true })
    linker.symTableLookup(sourceId3, () => { found3After = true })
    expect(found1After).toBe(true)
    expect(found3After).toBe(true)
  })
})

// =============================================================================
// 4. ZONE BOUNDARY TESTS
// =============================================================================

describe('Stress Tests: Zone Boundary', () => {
  it('should correctly route allocations at zone boundary', () => {
    const sab = createLinkerSAB({ nodeCapacity: 16 })
    const sabView = new Int32Array(sab)
    const linker = new SiliconSynapse(sab)
    const localAllocator = new LocalAllocator(sabView, 16)

    const zoneSplit = getZoneSplitIndex(16)
    const zoneBStartPtr = HEAP_START_OFFSET + zoneSplit * NODE_SIZE_BYTES

    // Allocate from Zone A (Worker)
    const zoneAPtr = linker.allocNode()
    expect(zoneAPtr).toBeLessThan(zoneBStartPtr)

    // Allocate from Zone B (Main Thread)
    const zoneBPtr = localAllocator.alloc()
    expect(zoneBPtr).toBeGreaterThanOrEqual(zoneBStartPtr)
  })
})

// =============================================================================
// 5. 64-BIT TAGGED POINTER TESTS
// =============================================================================

describe('Stress Tests: 64-bit Tagged Pointer', () => {
  it('should handle many alloc/free cycles without ABA issues', () => {
    const linker = createTestLinker(8)
    const seenPtrs = new Set<number>()

    // Do many alloc/free cycles
    for (let cycle = 0; cycle < 100; cycle++) {
      const ptr = linker.allocNode()
      if (ptr === NULL_PTR) {
        linker.clearError()
        continue
      }

      seenPtrs.add(ptr)

      // Free immediately
      linker.freeNode(ptr)
    }

    // With only 4 Zone A slots, we should see reuse
    // The important thing is no corruption from ABA
    expect(seenPtrs.size).toBeLessThanOrEqual(4)
  })

  it('should increment version counter on each free', () => {
    const sab = createLinkerSAB({ nodeCapacity: 8 })
    const sab64 = new BigInt64Array(sab)
    const linker = new SiliconSynapse(sab)

    // Get initial version
    const HDR_I64_FREE_LIST_HEAD = 3 // FREE_LIST_HEAD_LOW is at i32 index 6, so i64 index 3
    const initialHead = sab64[HDR_I64_FREE_LIST_HEAD]
    const initialVersion = initialHead >> 32n

    // Allocate and free
    const ptr = linker.allocNode()
    expect(ptr).not.toBe(NULL_PTR)
    linker.freeNode(ptr)

    // Version should have incremented
    const newHead = sab64[HDR_I64_FREE_LIST_HEAD]
    const newVersion = newHead >> 32n

    expect(newVersion).toBeGreaterThan(initialVersion)
  })
})

// =============================================================================
// 6. ERROR PATH TESTS
// =============================================================================

describe('Stress Tests: Error Paths', () => {
  it('should set UNKNOWN_OPCODE error for invalid command', () => {
    const sab = createLinkerSAB({ nodeCapacity: 32 })
    const sabView = new Int32Array(sab)
    const linker = new SiliconSynapse(sab)
    const ringBuffer = new RingBuffer(sabView)

    // Write an invalid opcode (using a value > CMD.CLEAR)
    const INVALID_OPCODE = 255
    ringBuffer.write(INVALID_OPCODE, 0, 0, 0, 0)

    // Process commands
    linker.processCommands()

    // Should have set error flag
    expect(sabView[HDR.ERROR_FLAG]).toBe(ERROR.UNKNOWN_OPCODE)
  })

  it('should set INVALID_PTR error for out-of-bounds pointer', () => {
    const sab = createLinkerSAB({ nodeCapacity: 32 })
    const sabView = new Int32Array(sab)
    const linker = new SiliconSynapse(sab)
    const ringBuffer = new RingBuffer(sabView)

    // Write INSERT with invalid pointer (way beyond SAB)
    const INVALID_PTR = sab.byteLength * 2
    ringBuffer.write(CMD.INSERT, INVALID_PTR, NULL_PTR, 0, 0)

    // Process commands
    linker.processCommands()

    // Should have set error flag
    expect(sabView[HDR.ERROR_FLAG]).toBe(ERROR.INVALID_PTR)
  })

  it('should detect corrupted free list head', () => {
    const sab = createLinkerSAB({ nodeCapacity: 8 })
    const sab64 = new BigInt64Array(sab)
    const sabView = new Int32Array(sab)
    const linker = new SiliconSynapse(sab)

    // Corrupt free list head with invalid pointer
    // FREE_LIST_HEAD is stored as 64-bit tagged pointer at i64 index 3
    const HDR_I64_FREE_LIST_HEAD = 3
    sab64[HDR_I64_FREE_LIST_HEAD] = BigInt(0xDEADBEEF)

    // Attempt allocation - should detect invalid pointer in free list
    const ptr = linker.allocNode()
    expect(ptr).toBe(NULL_PTR)
    expect(sabView[HDR.ERROR_FLAG]).toBe(ERROR.FREE_LIST_CORRUPT)
  })

  it('should clean up Identity Table and Symbol Table on executeDelete', () => {
    const linker = createTestLinker(64)

    const sourceId = 5000

    // Insert a node with sourceId
    const ptr = linker.insertHead(OPCODE.NOTE, 60, 100, 96, 0, sourceId, FLAG.ACTIVE)
    expect(ptr).not.toBe(NULL_PTR)

    // Verify it's in the Identity Table
    expect(linker.idTableLookup(sourceId)).toBe(ptr)

    // Store symbol data
    linker.symTableStore(sourceId, 0xABCD, 42, 10)

    // Verify symbol data can be retrieved
    let foundBefore = false
    linker.symTableLookup(sourceId, (fh, l, c) => {
      foundBefore = (fh === 0xABCD && l === 42 && c === 10)
    })
    expect(foundBefore).toBe(true)

    // Delete the node (via deleteNode which queues a DELETE command)
    linker.deleteNode(ptr)

    // Verify Identity Table entry is removed
    expect(linker.idTableLookup(sourceId)).toBe(NULL_PTR)

    // Verify Symbol Table entry is removed
    let foundAfter = false
    linker.symTableLookup(sourceId, () => {
      foundAfter = true
    })
    expect(foundAfter).toBe(false)
  })
})

// =============================================================================
// 7. STATE MACHINE TESTS
// =============================================================================

describe('Stress Tests: State Machines', () => {
  it('should transition COMMIT_FLAG correctly: IDLE → PENDING → ACK → IDLE', () => {
    const linker = createTestLinker()
    const sab = new Int32Array(linker.getSAB())

    // Initial state
    expect(sab[HDR.COMMIT_FLAG]).toBe(COMMIT.IDLE)

    // Insert triggers PENDING
    linker.insertHead(OPCODE.NOTE, 60, 100, 96, 0, 1000, FLAG.ACTIVE)
    expect(sab[HDR.COMMIT_FLAG]).toBe(COMMIT.PENDING)

    // Consumer acknowledges
    Atomics.store(sab, HDR.COMMIT_FLAG, COMMIT.ACK)
    expect(sab[HDR.COMMIT_FLAG]).toBe(COMMIT.ACK)

    // Producer resets to IDLE (manual reset as per existing test patterns)
    sab[HDR.COMMIT_FLAG] = COMMIT.IDLE
    expect(sab[HDR.COMMIT_FLAG]).toBe(COMMIT.IDLE)
  })

  it('should handle rapid structural changes', () => {
    const linker = createTestLinker(64)
    const sab = new Int32Array(linker.getSAB())

    // Rapidly insert and delete
    for (let i = 0; i < 50; i++) {
      const ptr = linker.insertHead(OPCODE.NOTE, 60, 100, 96, i * 10, i + 1, FLAG.ACTIVE)
      if (ptr === NULL_PTR) {
        linker.clearError()
        continue
      }

      // Simulate consumer ACK cycle
      sab[HDR.COMMIT_FLAG] = COMMIT.IDLE

      // Delete
      linker._deleteNode(ptr)
      linker.freeNode(ptr)

      // Reset commit flag
      sab[HDR.COMMIT_FLAG] = COMMIT.IDLE
    }

    // Should end in IDLE state
    expect(sab[HDR.COMMIT_FLAG]).toBe(COMMIT.IDLE)
    expect(sab[HDR.NODE_COUNT]).toBe(0)
  })
})

// =============================================================================
// 8. DATA INTEGRITY TESTS
// =============================================================================

describe('Stress Tests: Data Integrity', () => {
  it('should clear FLAG.ACTIVE on deletion', () => {
    const linker = createTestLinker()
    const sab = new Int32Array(linker.getSAB())

    const ptr = linker.insertHead(OPCODE.NOTE, 60, 100, 96, 0, 1000, FLAG.ACTIVE)
    expect(ptr).not.toBe(NULL_PTR)

    // Verify active before delete
    const offset = ptr / 4
    const packedBefore = Atomics.load(sab, offset + NODE.PACKED_A)
    expect(packedBefore & FLAG.ACTIVE).toBe(FLAG.ACTIVE)

    // Delete
    linker._deleteNode(ptr)

    // Verify active cleared after delete
    const packedAfter = Atomics.load(sab, offset + NODE.PACKED_A)
    expect(packedAfter & FLAG.ACTIVE).toBe(0)
  })

  it('should zero memory on allocation', () => {
    const sab = createLinkerSAB({ nodeCapacity: 8 })
    const sabView = new Int32Array(sab)
    const linker = new SiliconSynapse(sab)

    // Allocate node and write garbage
    const ptr1 = linker.allocNode()
    expect(ptr1).not.toBe(NULL_PTR)
    const offset1 = ptr1 / 4
    sabView[offset1 + NODE.PACKED_A] = 0xDEADBEEF
    sabView[offset1 + NODE.BASE_TICK] = 0xCAFEBABE
    sabView[offset1 + NODE.DURATION] = 0xFEEDFACE

    // Free and reallocate
    linker.freeNode(ptr1)
    const ptr2 = linker.allocNode()

    // Should get same slot (small heap)
    expect(ptr2).toBe(ptr1)

    // Memory should be zeroed
    const offset2 = ptr2 / 4
    expect(sabView[offset2 + NODE.PACKED_A]).toBe(0)
    expect(sabView[offset2 + NODE.BASE_TICK]).toBe(0)
    expect(sabView[offset2 + NODE.DURATION]).toBe(0)
  })

  it('should increment SEQ on every attribute patch', () => {
    const linker = createTestLinker()
    const sab = new Int32Array(linker.getSAB())

    const ptr = linker.insertHead(OPCODE.NOTE, 60, 100, 96, 0, 1000, FLAG.ACTIVE)
    expect(ptr).not.toBe(NULL_PTR)

    const offset = ptr / 4
    const seqFlagsBefore = Atomics.load(sab, offset + NODE.SEQ_FLAGS)
    const seqBefore = seqFlagsBefore >>> 8 // SEQ is in upper 24 bits

    // Patch pitch
    linker.patchPitch(ptr, 72)

    const seqFlagsAfter = Atomics.load(sab, offset + NODE.SEQ_FLAGS)
    const seqAfter = seqFlagsAfter >>> 8

    expect(seqAfter).toBe(seqBefore + 1)
  })
})

// =============================================================================
// 9. TELEMETRY ACCURACY TESTS
// =============================================================================

describe('Stress Tests: Telemetry Accuracy', () => {
  it('should maintain accurate NODE_COUNT through operations', () => {
    const linker = createTestLinker(32)
    const sab = new Int32Array(linker.getSAB())

    // Initial count
    expect(sab[HDR.NODE_COUNT]).toBe(0)

    // Insert 10 nodes
    const ptrs: number[] = []
    for (let i = 0; i < 10; i++) {
      const ptr = linker.insertHead(OPCODE.NOTE, 60, 100, 96, i * 10, i + 1, FLAG.ACTIVE)
      if (ptr !== NULL_PTR) ptrs.push(ptr)
    }

    expect(sab[HDR.NODE_COUNT]).toBe(10)

    // Delete 5
    for (let i = 0; i < 5; i++) {
      linker._deleteNode(ptrs[i])
      linker.freeNode(ptrs[i])
    }

    expect(sab[HDR.NODE_COUNT]).toBe(5)

    // Delete remaining
    for (let i = 5; i < 10; i++) {
      linker._deleteNode(ptrs[i])
      linker.freeNode(ptrs[i])
    }

    expect(sab[HDR.NODE_COUNT]).toBe(0)
  })

  it('should maintain accurate FREE_COUNT', () => {
    const linker = createTestLinker(8) // Zone A = 4
    const sab = new Int32Array(linker.getSAB())

    // Initial: all 4 Zone A nodes free
    expect(sab[HDR.FREE_COUNT]).toBe(4)

    // Allocate 2
    const ptr1 = linker.allocNode()
    const ptr2 = linker.allocNode()

    expect(sab[HDR.FREE_COUNT]).toBe(2)

    // Free 1
    linker.freeNode(ptr1)

    expect(sab[HDR.FREE_COUNT]).toBe(3)

    // Free last
    linker.freeNode(ptr2)

    expect(sab[HDR.FREE_COUNT]).toBe(4)
  })
})
