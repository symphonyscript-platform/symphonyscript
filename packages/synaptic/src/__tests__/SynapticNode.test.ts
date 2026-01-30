// =============================================================================
// SynapticNode Tests - Synaptic Package
// =============================================================================
// [2026-01-30] Updated for abstract SynapticNode with error handling tests

import { SynapticNode } from '../SynapticNode'
import { SiliconSynapse, SiliconBridge, NULL_PTR } from '@symphonyscript/kernel'

// Flush pending microtasks after each test to prevent hanging
afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
})

// =============================================================================
// Test Implementation: Concrete SynapticNode
// =============================================================================

/**
 * TestNode - Concrete implementation of SynapticNode for testing.
 * Provides addNote() method to populate the node with content.
 */
class TestNode extends SynapticNode {
    constructor(bridge: SiliconBridge) {
        super(bridge)
    }

    /**
     * Add a note to the node's chain using _insertNoteImmediate (test-only).
     * This is synchronous and registers the ID mapping immediately.
     */
    addNote(pitch: number, velocity: number, duration: number, baseTick: number, muted: boolean = false): void {
        // Use _insertNoteImmediate for synchronous test behavior
        // Returns SOURCE_ID on success, negative on error
        const sourceId = this.bridge._insertNoteImmediate(
            { pitch, velocity, duration, baseTick, muted },
            this.exitId // Chain after previous (or undefined for first)
        )
        
        if (sourceId >= 0) {
            if (this.entryId === undefined) {
                this.entryId = sourceId
            }
            this.exitId = sourceId
            this.writeId = sourceId
        }
    }

    /**
     * Helper to set IDs directly for unit testing.
     */
    setIds(entry: number, exit: number): void {
        this.entryId = entry
        this.exitId = exit
    }
}

// =============================================================================
// Test Helpers
// =============================================================================

function createTestBridge(): SiliconBridge {
    const linker = SiliconSynapse.create({
        nodeCapacity: 256,
        safeZoneTicks: 0 // Disable safe zone for testing
    })
    return new SiliconBridge(linker)
}

// Helper to read node data from SAB using the linker's readNode callback
function readNodeFromSAB(
    bridge: SiliconBridge,
    ptr: number
): {
    pitch: number
    velocity: number
    duration: number
    baseTick: number
    nextPtr: number
    sourceId: number
} | null {
    let result: {
        pitch: number
        velocity: number
        duration: number
        baseTick: number
        nextPtr: number
        sourceId: number
    } | null = null

    bridge.getLinker().readNode(ptr, (
        _ptr: number,
        _opcode: number,
        pitch: number,
        velocity: number,
        duration: number,
        baseTick: number,
        nextPtr: number,
        sourceId: number,
        _flags: number,
        _seq: number
    ): void => {
        result = {
            pitch,
            velocity,
            duration,
            baseTick,
            nextPtr,
            sourceId
        }
    })

    return result
}

// Helper to check if a synapse exists between two source IDs
function synapseExists(
    bridge: SiliconBridge,
    sourceId: number,
    targetId: number
): boolean {
    let found = false

    bridge.snapshotStream(
        (sid: number, tid: number, _weight: number, _jitter: number): void => {
            if (sid === sourceId && tid === targetId) {
                found = true
            }
        },
        (_count: number): void => { } // onComplete callback
    )

    return found
}

// =============================================================================
// SynapticNode Tests
// =============================================================================

describe('SynapticNode - Basic Construction', () => {
    test('constructs with SiliconBridge', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)

        expect(node).toBeInstanceOf(SynapticNode)
    })

    test('getEntryId throws when no notes added', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)

        expect(() => node.getEntryId()).toThrow('Node has no entry ID assigned')
    })

    test('getExitId throws when no notes added', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)

        expect(() => node.getExitId()).toThrow('Node has no exit ID assigned')
    })
})

describe('SynapticNode - Adding Notes', () => {
    test('addNote sets entryId and exitId', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)

        node.addNote(60, 100, 480, 0)

        expect(() => node.getEntryId()).not.toThrow()
        expect(() => node.getExitId()).not.toThrow()
        expect(node.getEntryId()).toBe(node.getExitId())
    })

    test('addNote creates linked list in SAB', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)

        node.addNote(60, 100, 480, 0)
        node.addNote(64, 110, 480, 480)

        const entryId = node.getEntryId()
        const exitId = node.getExitId()

        // Entry and exit should be different for 2 notes
        expect(entryId).not.toBe(exitId)

        // Read the entry node from SAB
        const entryPtr = bridge.getNodePtr(entryId)!
        const entryNode = readNodeFromSAB(bridge, entryPtr)!

        expect(entryNode.pitch).toBe(60)
        expect(entryNode.velocity).toBe(100)
        expect(entryNode.duration).toBe(480)
        expect(entryNode.baseTick).toBe(0)

        // Verify linked list: entry's nextPtr should point to exit node
        expect(entryNode.nextPtr).not.toBe(NULL_PTR)

        const exitPtr = bridge.getNodePtr(exitId)!
        expect(entryNode.nextPtr).toBe(exitPtr)

        // Read the exit node
        const exitNode = readNodeFromSAB(bridge, exitPtr)!
        expect(exitNode.pitch).toBe(64)
        expect(exitNode.velocity).toBe(110)
        expect(exitNode.sourceId).toBe(exitId)
    })

    test('addNote chains multiple notes in order', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)

        node.addNote(60, 100, 480, 0)     // Note 1
        node.addNote(64, 110, 480, 480)   // Note 2
        node.addNote(67, 120, 480, 960)   // Note 3

        const entryId = node.getEntryId()
        const exitId = node.getExitId()

        // Walk the linked list
        const entryPtr = bridge.getNodePtr(entryId)!
        const node1 = readNodeFromSAB(bridge, entryPtr)!

        expect(node1.pitch).toBe(60)
        expect(node1.nextPtr).not.toBe(NULL_PTR)

        const node2 = readNodeFromSAB(bridge, node1.nextPtr)!
        expect(node2.pitch).toBe(64)
        expect(node2.nextPtr).not.toBe(NULL_PTR)

        const node3 = readNodeFromSAB(bridge, node2.nextPtr)!
        expect(node3.pitch).toBe(67)
        expect(node3.sourceId).toBe(exitId)
    })

    test('addNote handles muted parameter', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)

        node.addNote(60, 100, 480, 0, true)

        const entryId = node.getEntryId()

        // Verify muted state via bridge.readNote
        let muted = false
        bridge.readNote(entryId, (_p: number, _v: number, _d: number, _bt: number, m: boolean): void => {
            muted = m
        })

        expect(muted).toBe(true)
    })
})

describe('SynapticNode - Linking Nodes', () => {
    test('linkTo creates synapse connection', () => {
        const bridge = createTestBridge()

        const nodeA = new TestNode(bridge)
        nodeA.addNote(60, 100, 480, 0)
        nodeA.addNote(64, 110, 480, 480)

        const nodeB = new TestNode(bridge)
        nodeB.addNote(67, 120, 480, 960)
        nodeB.addNote(72, 130, 480, 1440)

        // Link A to B
        nodeA.linkTo(nodeB)

        // Verify synapse exists between A's exit and B's entry
        const exitIdA = nodeA.getExitId()
        const entryIdB = nodeB.getEntryId()

        expect(synapseExists(bridge, exitIdA, entryIdB)).toBe(true)
    })

    test('linkTo with weight and jitter parameters', () => {
        const bridge = createTestBridge()

        const nodeA = new TestNode(bridge)
        nodeA.addNote(60, 100, 480, 0)

        const nodeB = new TestNode(bridge)
        nodeB.addNote(64, 110, 480, 480)

        // Link with custom weight and jitter
        nodeA.linkTo(nodeB, 750, 100)

        expect(synapseExists(bridge, nodeA.getExitId(), nodeB.getEntryId())).toBe(true)
    })

    test('linkTo throws when source has no exit ID', () => {
        const bridge = createTestBridge()

        const nodeA = new TestNode(bridge)
        const nodeB = new TestNode(bridge)
        nodeB.addNote(60, 100, 480, 0)

        expect(() => nodeA.linkTo(nodeB)).toThrow('source node has no exit ID')
    })

    test('linkTo throws when target has no entry ID', () => {
        const bridge = createTestBridge()

        const nodeA = new TestNode(bridge)
        nodeA.addNote(60, 100, 480, 0)

        const nodeB = new TestNode(bridge)

        expect(() => nodeA.linkTo(nodeB)).toThrow('Node has no entry ID')
    })
})

describe('SynapticNode - Complete Scenario', () => {
    test('nodeA adds 2 notes, nodeB adds 2 notes, link A to B', () => {
        const bridge = createTestBridge()

        const nodeA = new TestNode(bridge)
        nodeA.addNote(60, 100, 480, 0, false)
        nodeA.addNote(64, 110, 480, 480, false)

        const nodeB = new TestNode(bridge)
        nodeB.addNote(67, 120, 480, 960, false)
        nodeB.addNote(72, 130, 480, 1440, false)

        nodeA.linkTo(nodeB)

        const entryA = nodeA.getEntryId()
        const exitA = nodeA.getExitId()
        const entryB = nodeB.getEntryId()
        const exitB = nodeB.getExitId()

        // Verify nodeA's chain
        const ptrA1 = bridge.getNodePtr(entryA)!
        const nodeA1 = readNodeFromSAB(bridge, ptrA1)!
        expect(nodeA1.pitch).toBe(60)
        expect(nodeA1.baseTick).toBe(0)
        expect(nodeA1.nextPtr).not.toBe(NULL_PTR)

        const nodeA2 = readNodeFromSAB(bridge, nodeA1.nextPtr)!
        expect(nodeA2.pitch).toBe(64)
        expect(nodeA2.baseTick).toBe(480)
        expect(nodeA2.sourceId).toBe(exitA)

        // Verify nodeB's chain
        const ptrB1 = bridge.getNodePtr(entryB)!
        const nodeB1 = readNodeFromSAB(bridge, ptrB1)!
        expect(nodeB1.pitch).toBe(67)
        expect(nodeB1.baseTick).toBe(960)
        expect(nodeB1.nextPtr).not.toBe(NULL_PTR)

        const nodeB2 = readNodeFromSAB(bridge, nodeB1.nextPtr)!
        expect(nodeB2.pitch).toBe(72)
        expect(nodeB2.baseTick).toBe(1440)
        expect(nodeB2.sourceId).toBe(exitB)

        // Verify synapse connection exists
        expect(synapseExists(bridge, exitA, entryB)).toBe(true)

        // Additional verification via streamSnapshot
        let foundSynapse = false
        let synapseWeight = 0
        let synapseJitter = 0

        bridge.snapshotStream(
            (sourceId: number, targetId: number, weight: number, jitter: number): void => {
                if (sourceId === exitA && targetId === entryB) {
                    foundSynapse = true
                    synapseWeight = weight
                    synapseJitter = jitter
                }
            },
            (_count: number): void => { }
        )

        expect(foundSynapse).toBe(true)
        expect(synapseWeight).toBe(500) // Default weight
        expect(synapseJitter).toBe(0)
    })
})

// =============================================================================
// Error Handling Tests (Audit Remediation)
// =============================================================================

describe('SynapticNode Error Handling', () => {
    // [KERNEL-001] linkTo() error checking
    test('linkTo() throws when bridge.connect() returns error', () => {
        const bridge = createTestBridge()
        
        const nodeA = new TestNode(bridge)
        nodeA.addNote(60, 100, 480, 0)
        
        const nodeB = new TestNode(bridge)
        nodeB.addNote(64, 110, 480, 480)
        
        // Mock bridge.connect to return error code
        jest.spyOn(bridge, 'connect').mockReturnValue(-2) // TABLE_FULL
        
        expect(() => nodeA.linkTo(nodeB)).toThrow(/Failed to create synapse.*error -2/)
    })

    // [STATE-001] setCycle() guard on empty node
    test('setCycle() throws on empty node', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)
        // No notes added
        
        expect(() => node.setCycle(480)).toThrow(/no content.*entryId undefined/)
    })

    // [KERNEL-003] patchDirect() error checking
    test('setCycle() throws when patchDirect() fails', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)
        node.addNote(60, 100, 480, 0)
        
        // Create initial barrier (without queueMicrotask blocking test)
        node.setCycle(480)
        
        // Mock patchDirect to return error
        jest.spyOn(bridge, 'patchDirect').mockReturnValue(-1) // NOT_FOUND
        
        // Try to update barrier duration
        expect(() => node.setCycle(960)).toThrow(/Failed to update barrier duration.*error -1/)
    })

    // setCycle(0) removes barrier gracefully
    test('setCycle(0) removes cycle without error', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)
        node.addNote(60, 100, 480, 0)
        
        // Create and remove cycle
        node.setCycle(480)
        expect(() => node.setCycle(0)).not.toThrow()
    })

    // setCycle(0) on non-cycled node is a no-op
    test('setCycle(0) on non-cycled node is no-op', () => {
        const bridge = createTestBridge()
        const node = new TestNode(bridge)
        node.addNote(60, 100, 480, 0)
        
        expect(() => node.setCycle(0)).not.toThrow()
    })
})

describe('Cursor Integration', () => {
    test('addNote uses bridge internally', () => {
        const linker = SiliconSynapse.create({ nodeCapacity: 64, safeZoneTicks: 0 })
        const bridge = new SiliconBridge(linker)
        const node = new TestNode(bridge)

        node.addNote(60, 100, 480, 0, false)

        expect(node).toBeDefined()
        expect(node.getEntryId()).toBeGreaterThan(0)
    })

    test('Multiple notes maintain chain integrity', () => {
        const linker = SiliconSynapse.create({ nodeCapacity: 64, safeZoneTicks: 0 })
        const bridge = new SiliconBridge(linker)
        const node = new TestNode(bridge)

        node.addNote(60, 100, 480, 0)
        node.addNote(64, 110, 240, 480)
        node.addNote(67, 120, 480, 720)

        expect(node.getEntryId()).toBeGreaterThan(0)
        expect(node.getExitId()).toBeGreaterThan(0)
        expect(node.getEntryId()).not.toBe(node.getExitId())
    })
})
