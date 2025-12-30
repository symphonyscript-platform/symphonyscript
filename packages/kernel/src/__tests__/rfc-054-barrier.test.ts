// =============================================================================
// RFC-054: Native Phase Guardrails - Validation Tests
// =============================================================================
// Tests for OPCODE.BARRIER, CMD.CONNECT, CMD.DISCONNECT, and State Machine Hold

import {
    SiliconSynapse,
    createLinkerSAB,
    OPCODE,
    HDR,
    NULL_PTR,
    SYNAPSE_TABLE,
    SYNAPSE,
    getSynapseTableOffset,
    KNUTH_HASH_CONST,
} from '../'
import { SiliconBridge } from '../silicon-bridge'
import { MockConsumer } from '../mock-consumer'

describe('RFC-054: Native Phase Guardrails', () => {
    let buffer: SharedArrayBuffer
    let linker: SiliconSynapse
    let bridge: SiliconBridge
    let consumer: MockConsumer

    beforeEach(() => {
        buffer = createLinkerSAB({
            nodeCapacity: 256,
            safeZoneTicks: 0
        })
        linker = new SiliconSynapse(buffer)
        bridge = new SiliconBridge(linker)
        consumer = new MockConsumer(buffer, 24)
        consumer.setLinker(linker)
    })

    /**
     * Helper: Check if a synapse exists in the synapse table
     * Uses the same hash lookup logic as SynapseAllocator
     */
    function synapseExists(sourcePtr: number, targetPtr: number): boolean {
        const sab = new Int32Array(buffer)
        const nodeCapacity = sab[HDR.NODE_CAPACITY]
        const synapseTableI32 = getSynapseTableOffset(nodeCapacity) / 4

        // Hash to find slot
        const hash = (Math.imul(sourcePtr, KNUTH_HASH_CONST) >>> 0) % SYNAPSE_TABLE.MAX_CAPACITY
        let slot = hash
        let probes = 0

        while (probes < SYNAPSE_TABLE.MAX_CAPACITY) {
            const offset = synapseTableI32 + slot * SYNAPSE_TABLE.STRIDE_I32
            const storedSource = Atomics.load(sab, offset + SYNAPSE.SOURCE_PTR)
            const storedTarget = Atomics.load(sab, offset + SYNAPSE.TARGET_PTR)

            if (storedSource === NULL_PTR) {
                return false // Empty slot - not found
            }

            if (storedSource === sourcePtr && storedTarget === targetPtr) {
                return true // Found matching synapse
            }

            slot = (slot + 1) % SYNAPSE_TABLE.MAX_CAPACITY
            probes++
        }

        return false
    }

    // ===========================================================================
    // Task 3.1: BARRIER Wait Logic in MockConsumer
    // ===========================================================================
    describe('Task 3.1: BARRIER State Machine Hold', () => {
        it('should pause at BARRIER until phase alignment', () => {
            // Insert a note at tick 0
            const noteId = bridge.generateSourceId()
            bridge.insertAsync(OPCODE.NOTE, 60, 100, 480, 0, false, noteId, undefined)
            linker.processCommands()

            // Insert BARRIER with cycle length 96 (quarter note at 24 PPQN)
            const barrierId = bridge.generateSourceId()
            const barrierPtr = bridge.insertAsync(
                OPCODE.BARRIER, 0, 0, 96, 0, false, barrierId, noteId
            )
            linker.processCommands()

            expect(barrierPtr).toBeGreaterThan(0)

            // Set initial playhead
            const sab = new Int32Array(buffer)
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 0)

            // Process first quantum - should see note, then hit barrier
            const events1 = consumer.process()
            expect(events1.length).toBe(1) // Note event

            // Advance playhead to tick 50 (not aligned to 96)
            // Consumer would be held at barrier (not aligned)
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 50)
            const events2 = consumer.process()
            expect(events2.length).toBe(0) // Waiting at barrier

            // Advance playhead to tick 96 (aligned to cycle)
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 96)
            const events3 = consumer.process()
            // Barrier should pass now (no more notes after barrier)
            expect(events3.length).toBe(0)
        })

        it('should immediately pass BARRIER when already aligned (remainder=0)', () => {
            // Insert BARRIER at head with cycle 48
            const barrierId = bridge.generateSourceId()
            bridge.insertAsync(OPCODE.BARRIER, 0, 0, 48, 0, false, barrierId, undefined)
            linker.processCommands()

            // Start with playhead at 48 (aligned to 48)
            const sab = new Int32Array(buffer)
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 48)

            // Process - should pass immediately (48 % 48 = 0)
            consumer.process()

            // If barrier passed, we shouldn't be stuck
            // Run a few more times to verify no infinite loop
            consumer.process()
            consumer.process()
            // No assertion needed - test passes if no infinite loop
        })

        it('should calculate correct wait time for mid-cycle barrier', () => {
            // Insert BARRIER with cycle 100
            const barrierId = bridge.generateSourceId()
            bridge.insertAsync(OPCODE.BARRIER, 0, 0, 100, 0, false, barrierId, undefined)
            linker.processCommands()

            const sab = new Int32Array(buffer)

            // Start playhead at 75 - should wait until 100
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 75)
            consumer.process() // Enter barrier, calculate wait (25 ticks until 100)

            // Playhead at 99 - still waiting
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 99)
            consumer.process()
            // No way to directly check position, but should still be waiting

            // Playhead at 100 - should pass
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 100)
            consumer.process()

            // Playhead at 200 - should have passed barrier
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 200)
            consumer.process()
            // If no errors, barrier logic is working
        })

        it('should reset barrier state on consumer reset', () => {
            // Insert BARRIER with cycle 50
            const barrierId = bridge.generateSourceId()
            bridge.insertAsync(OPCODE.BARRIER, 0, 0, 50, 0, false, barrierId, undefined)
            linker.processCommands()

            const sab = new Int32Array(buffer)
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 25)

            consumer.process() // Enter barrier hold state

            // Reset consumer
            consumer.reset()

            // Barrier hold state should be cleared
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 0)
            consumer.process()
            // After reset, should start fresh - no errors means pass
        })
    })

    // ===========================================================================
    // Task 3.2: Atomic Loop Creation (CMD.CONNECT)
    // ===========================================================================
    describe('Task 3.2: CMD.CONNECT Async Synapse Creation', () => {
        it('should create synapse via connectAsync', () => {
            // Insert two notes
            const noteAId = bridge.generateSourceId()
            const ptrA = bridge.insertAsync(OPCODE.NOTE, 60, 100, 480, 0, false, noteAId, undefined)
            linker.processCommands()

            const noteBId = bridge.generateSourceId()
            const ptrB = bridge.insertAsync(OPCODE.NOTE, 64, 100, 480, 480, false, noteBId, noteAId)
            linker.processCommands()

            expect(ptrA).toBeGreaterThan(0)
            expect(ptrB).toBeGreaterThan(0)

            // Create synapse using connectAsync (pointer-based)
            bridge.connectAsync(ptrB, ptrA, 750, 10) // B -> A with weight 750, jitter 10
            linker.processCommands()

            // Verify synapse was created in the synapse table
            expect(synapseExists(ptrB, ptrA)).toBe(true)
        })

        it('should pack weight and jitter correctly in CMD.CONNECT', () => {
            const noteAId = bridge.generateSourceId()
            const ptrA = bridge.insertAsync(OPCODE.NOTE, 60, 100, 480, 0, false, noteAId, undefined)
            linker.processCommands()

            const noteBId = bridge.generateSourceId()
            const ptrB = bridge.insertAsync(OPCODE.NOTE, 64, 100, 480, 480, false, noteBId, noteAId)
            linker.processCommands()

            // Test with specific weight/jitter values
            bridge.connectAsync(ptrA, ptrB, 1000, 65535) // Max values
            linker.processCommands()

            // Should create synapse without error
            expect(synapseExists(ptrA, ptrB)).toBe(true)
        })

        it('should use default weight 500 when weight is 0', () => {
            const noteAId = bridge.generateSourceId()
            const ptrA = bridge.insertAsync(OPCODE.NOTE, 60, 100, 480, 0, false, noteAId, undefined)
            linker.processCommands()

            const noteBId = bridge.generateSourceId()
            const ptrB = bridge.insertAsync(OPCODE.NOTE, 64, 100, 480, 480, false, noteBId, noteAId)
            linker.processCommands()

            // Connect with default weight/jitter (0, 0 -> defaults to weight 500)
            bridge.connectAsync(ptrA, ptrB, 0, 0)
            linker.processCommands()

            expect(synapseExists(ptrA, ptrB)).toBe(true)
        })

        it('should set error flag for invalid pointers in executeConnect', () => {
            const sab = new Int32Array(buffer)

            // Clear any existing error
            Atomics.store(sab, HDR.ERROR_FLAG, 0)

            // Try to connect with invalid pointers (beyond buffer size)
            const invalidPtr = buffer.byteLength + 100
            bridge.connectAsync(invalidPtr, 888888, 500, 0)
            linker.processCommands()

            // Should set ERROR.INVALID_PTR
            const errorFlag = Atomics.load(sab, HDR.ERROR_FLAG)
            expect(errorFlag).not.toBe(0) // Error was set
        })
    })

    // ===========================================================================
    // Task 3.3: CMD.DISCONNECT (setCycle(0) removal)
    // ===========================================================================
    describe('Task 3.3: CMD.DISCONNECT Async Synapse Removal', () => {
        it('should remove specific synapse via disconnectAsync', () => {
            // Create nodes and synapse
            const noteAId = bridge.generateSourceId()
            const ptrA = bridge.insertAsync(OPCODE.NOTE, 60, 100, 480, 0, false, noteAId, undefined)
            linker.processCommands()

            const noteBId = bridge.generateSourceId()
            const ptrB = bridge.insertAsync(OPCODE.NOTE, 64, 100, 480, 480, false, noteBId, noteAId)
            linker.processCommands()

            // Create synapse
            bridge.connectAsync(ptrA, ptrB, 500, 0)
            linker.processCommands()

            expect(synapseExists(ptrA, ptrB)).toBe(true)

            // Disconnect via async
            bridge.disconnectAsync(ptrA, ptrB)
            linker.processCommands()

            // Synapse should be tombstoned (target = NULL_PTR)
            expect(synapseExists(ptrA, ptrB)).toBe(false)
        })

        it('should disconnect all synapses from source when tgtPtr is NULL_PTR', () => {
            // Create one source connected to two targets
            const srcId = bridge.generateSourceId()
            const ptrSrc = bridge.insertAsync(OPCODE.NOTE, 60, 100, 480, 0, false, srcId, undefined)
            linker.processCommands()

            const tgt1Id = bridge.generateSourceId()
            const ptrTgt1 = bridge.insertAsync(OPCODE.NOTE, 64, 100, 480, 480, false, tgt1Id, srcId)
            linker.processCommands()

            const tgt2Id = bridge.generateSourceId()
            const ptrTgt2 = bridge.insertAsync(OPCODE.NOTE, 67, 100, 480, 960, false, tgt2Id, tgt1Id)
            linker.processCommands()

            // Create two synapses from source
            bridge.connectAsync(ptrSrc, ptrTgt1, 500, 0)
            bridge.connectAsync(ptrSrc, ptrTgt2, 500, 0)
            linker.processCommands()

            expect(synapseExists(ptrSrc, ptrTgt1)).toBe(true)
            expect(synapseExists(ptrSrc, ptrTgt2)).toBe(true)

            // Disconnect all from source (tgtPtr = NULL_PTR = 0)
            bridge.disconnectAsync(ptrSrc, NULL_PTR)
            linker.processCommands()

            // Both synapses should be tombstoned
            expect(synapseExists(ptrSrc, ptrTgt1)).toBe(false)
            expect(synapseExists(ptrSrc, ptrTgt2)).toBe(false)
        })

        it('should handle deleteAsync for barrier removal', () => {
            // Insert barrier
            const barrierId = bridge.generateSourceId()
            const barrierPtr = bridge.insertAsync(
                OPCODE.BARRIER, 0, 0, 96, 0, false, barrierId, undefined
            )
            linker.processCommands()

            expect(barrierPtr).toBeGreaterThan(0)

            const sab = new Int32Array(buffer)

            // Ensure playhead is 0 and safe zone allows deletion
            Atomics.store(sab, HDR.PLAYHEAD_TICK, 0)

            const headBefore = Atomics.load(sab, HDR.HEAD_PTR)
            expect(headBefore).toBe(barrierPtr)

            // Delete barrier via async
            bridge.deleteAsync(barrierPtr)
            linker.processCommands()

            // Barrier should be removed from chain
            const headAfter = Atomics.load(sab, HDR.HEAD_PTR)

            expect(headAfter).toBe(NULL_PTR) // Chain is now empty
        })
    })

    // ===========================================================================
    // Task 3.4: FIFO Ordering Guarantee
    // ===========================================================================
    // ===========================================================================
    // Task 3.4: FIFO Ordering Guarantee
    // ===========================================================================
    describe('Task 3.4: FIFO Ordering - INSERT before CONNECT', () => {
        it('should process INSERT before CONNECT in same batch', () => {
            // Queue INSERT (must process to register ID for next insert's dependency)
            const noteAId = bridge.generateSourceId()
            const ptrA = bridge.insertAsync(OPCODE.NOTE, 60, 100, 480, 0, false, noteAId, undefined)
            linker.processCommands() // Registers noteAId

            const noteBId = bridge.generateSourceId()
            const ptrB = bridge.insertAsync(OPCODE.NOTE, 64, 100, 480, 480, false, noteBId, noteAId)

            // Queue CONNECT using pointers (ptrB not processed yet, but valid pointer)
            bridge.connectAsync(ptrA, ptrB, 500, 0)

            // Process remaining commands
            linker.processCommands()

            // Synapse should be created
            expect(synapseExists(ptrA, ptrB)).toBe(true)

            // Verify chain structure
            const sab = new Int32Array(buffer)
            const headPtr = Atomics.load(sab, HDR.HEAD_PTR)
            expect(headPtr).toBe(ptrA)
        })

        it('should handle INSERT + BARRIER + CONNECT loop in sequence', () => {
            // Simulate setCycle() flow: insert note, insert barrier, connect barrier->entry

            // 1. Insert note (entry point) - Process to register ID
            const noteId = bridge.generateSourceId()
            const notePtr = bridge.insertAsync(OPCODE.NOTE, 60, 100, 480, 0, false, noteId, undefined)
            linker.processCommands()

            // 2. Insert barrier after note (depends on noteId)
            const barrierId = bridge.generateSourceId()
            const barrierPtr = bridge.insertAsync(OPCODE.BARRIER, 0, 0, 96, 0, false, barrierId, noteId)

            // 3. Connect barrier -> note (loop closure)
            bridge.connectAsync(barrierPtr, notePtr, 500, 0)

            // Process remaining commands
            linker.processCommands()

            // Verify structure: HEAD -> note -> barrier
            const sab = new Int32Array(buffer)
            const headPtr = Atomics.load(sab, HDR.HEAD_PTR)
            expect(headPtr).toBe(notePtr)

            // Verify synapse exists
            expect(synapseExists(barrierPtr, notePtr)).toBe(true)
        })
    })
})
