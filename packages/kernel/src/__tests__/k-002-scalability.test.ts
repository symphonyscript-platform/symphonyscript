// =============================================================================
// SymphonyScript - K-002 Synapse Table Scalability Tests
// =============================================================================

import {
    createLinkerSAB,
    getLinkerConfig,
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
        const sab = createLinkerSAB({ nodeCapacity: 1024, synapseCapacity: 20000 })
        const sabView = new Int32Array(sab)

        const synapseCapacity = sabView[HDR.SYNAPSE_CAPACITY]
        expect(synapseCapacity).toBe(20000)
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
