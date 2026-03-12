// =============================================================================
// SymphonyScript - K-002 Synapse Table Scalability Tests
// =============================================================================

import {
    createLinkerSAB,
    getLinkerConfig,
    resetLinkerSAB,
    HDR
} from '../index'

describe('K-002: Synapse Table Scalability', () => {
    it('should default synapse capacity to nodeCapacity * 8', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024 })
        const sabView = new Int32Array(sab)

        const synapseCapacity = sabView[HDR.SYNAPSE_CAPACITY]
        expect(synapseCapacity).toBe(1024 * 8) // 8192
    })

    it('should respect explicit synapseCapacity config', () => {
        // synapseCapacity must be power of 2 for hash mask
        const sab = createLinkerSAB({ nodeCapacity: 1024, synapseCapacity: 16384 })
        const sabView = new Int32Array(sab)

        const synapseCapacity = sabView[HDR.SYNAPSE_CAPACITY]
        expect(synapseCapacity).toBe(16384)
    })

    it('should return synapseCapacity from getLinkerConfig', () => {
        const sab = createLinkerSAB({ nodeCapacity: 512, synapseCapacity: 16384 })
        const config = getLinkerConfig(sab)

        expect(config.nodeCapacity).toBe(512)
        expect(config.synapseCapacity).toBe(16384)
    })

    it('should initialize SYNAPSE_COUNT to 0', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024 })
        const sabView = new Int32Array(sab)

        expect(sabView[HDR.SYNAPSE_COUNT]).toBe(0)
        expect(sabView[HDR.SYNAPSE_USED_SLOTS]).toBe(0)
        expect(sabView[HDR.SYNAPSE_TOMBSTONES]).toBe(0)
    })

    it('R-007: should reset persisted synapse counters to 0 on resetLinkerSAB', () => {
        const sab = createLinkerSAB({ nodeCapacity: 1024 })
        const sabView = new Int32Array(sab)

        Atomics.store(sabView, HDR.SYNAPSE_COUNT, 7)
        Atomics.store(sabView, HDR.SYNAPSE_USED_SLOTS, 11)
        Atomics.store(sabView, HDR.SYNAPSE_TOMBSTONES, 4)

        resetLinkerSAB(sab)

        expect(sabView[HDR.SYNAPSE_COUNT]).toBe(0)
        expect(sabView[HDR.SYNAPSE_USED_SLOTS]).toBe(0)
        expect(sabView[HDR.SYNAPSE_TOMBSTONES]).toBe(0)
    })

    it('should create appropriately sized SAB for small synapse capacity', () => {
        // Small capacity = smaller SAB
        const smallSab = createLinkerSAB({ nodeCapacity: 256, synapseCapacity: 512 })
        const largeSab = createLinkerSAB({ nodeCapacity: 256, synapseCapacity: 65536 })

        // Large synapse table should result in larger buffer
        expect(largeSab.byteLength).toBeGreaterThan(smallSab.byteLength)

        // Difference should be approximately (65536 - 512) * 20 bytes per synapse
        const expectedDiff = (65536 - 512) * 20 // ~1.3MB
        const actualDiff = largeSab.byteLength - smallSab.byteLength
        expect(actualDiff).toBe(expectedDiff)
    })
})
