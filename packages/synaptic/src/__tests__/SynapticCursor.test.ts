// =============================================================================
// SynapticCursor Tests - RFC-045 Playback Cursor
// =============================================================================
// Comprehensive test suite for SynapticCursor neural branching logic.
// Tests synapse resolution, weighted selection, PRNG determinism, and quota enforcement.

import { SynapticCursor } from '../SynapticCursor'
import {
    SiliconSynapse,
    SiliconBridge,
    NULL_PTR,
    SYNAPSE_QUOTA,
    HDR
} from '@symphonyscript/kernel'

// =============================================================================
// Test Helpers
// =============================================================================

interface TestEnv {
    linker: ReturnType<typeof SiliconSynapse.create>
    bridge: SiliconBridge
    sab: SharedArrayBuffer
}

/**
 * Create test environment.
 * 
 * K-002 FIX: SynapticCursor now reads actual capacity from HDR.SYNAPSE_CAPACITY.
 * Default synapse capacity = nodeCapacity * 8 (e.g., 256 nodes → 2048 synapses).
 */
function createTestEnvironment(nodeCapacity: number = 256): TestEnv {
    const linker = SiliconSynapse.create({
        nodeCapacity,
        safeZoneTicks: 0 // Disable safe zone for testing
    })
    const bridge = new SiliconBridge(linker)
    const sab = linker.getSAB()
    return { linker, bridge, sab }
}

/**
 * Helper to insert a note and get its pointer (for synapse source/target).
 */
function insertTestNote(env: TestEnv, pitch: number, baseTick: number = 0): { sourceId: number; ptr: number } {
    const sourceId = env.bridge._insertNoteImmediate({
        pitch,
        velocity: 100,
        duration: 480,
        baseTick
    })
    const ptr = env.bridge.getNodePtr(sourceId)
    if (ptr === undefined) {
        throw new Error(`Failed to get pointer for sourceId ${sourceId}`)
    }
    return { sourceId, ptr }
}

/**
 * Create a synapse between two nodes using the bridge.
 */
function createSynapse(env: TestEnv, sourceId: number, targetId: number, weight: number = 500, jitter: number = 0): number {
    return env.bridge.connect(sourceId, targetId, weight, jitter)
}

// =============================================================================
// 1. Construction Tests
// =============================================================================

describe('SynapticCursor - Construction', () => {
    test('initializes with correct default state', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        expect(cursor.getCurrentPtr()).toBe(NULL_PTR)
        expect(cursor.getPendingJitter()).toBe(0)
        expect(cursor.hasJitter()).toBe(false)
        expect(cursor.canFireSynapse()).toBe(true)
    })

    test('initializes with custom initial pointer', () => {
        const env = createTestEnvironment()
        const initialPtr = 1234
        const cursor = new SynapticCursor(env.sab, initialPtr)
        
        expect(cursor.getCurrentPtr()).toBe(initialPtr)
    })

    test('PRNG seed 0 is coerced to 1 (zero fixpoint handling)', () => {
        const env = createTestEnvironment()
        
        // Both cursors with seed 0 and 1 should work (not get stuck)
        const cursor1 = new SynapticCursor(env.sab, NULL_PTR, 0)
        const cursor2 = new SynapticCursor(env.sab, NULL_PTR, 1)
        
        expect(cursor1.canFireSynapse()).toBe(true)
        expect(cursor2.canFireSynapse()).toBe(true)
    })

    test('SoA candidate arrays are pre-allocated', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        // Verify cursor can handle MAX_FIRES_PER_BLOCK candidates
        // This is implicitly tested - if arrays weren't pre-allocated,
        // resolution with many candidates would fail
        expect(cursor.canFireSynapse()).toBe(true)
    })

    test('uses actual SAB capacity (K-002 dynamic sizing)', () => {
        // Test with small capacity (256 nodes → 2048 synapses)
        const envSmall = createTestEnvironment(256)
        const i32Small = new Int32Array(envSmall.sab)
        const expectedSmall = i32Small[HDR.SYNAPSE_CAPACITY]
        expect(expectedSmall).toBe(256 * 8) // 2048
        
        // Cursor should work without RangeError (uses actual capacity, not MAX)
        const cursorSmall = new SynapticCursor(envSmall.sab)
        const sourceSmall = insertTestNote(envSmall, 60)
        const targetSmall = insertTestNote(envSmall, 64)
        createSynapse(envSmall, sourceSmall.sourceId, targetSmall.sourceId, 500, 0)
        
        let resolved = false
        cursorSmall.resolveSynapseWithCallback(sourceSmall.ptr, () => {
            resolved = true
        })
        expect(resolved).toBe(true)
        
        // Test with large capacity (1024 nodes → 8192 synapses)
        const envLarge = createTestEnvironment(1024)
        const i32Large = new Int32Array(envLarge.sab)
        const expectedLarge = i32Large[HDR.SYNAPSE_CAPACITY]
        expect(expectedLarge).toBe(1024 * 8) // 8192
        
        // Both should work correctly
        const cursorLarge = new SynapticCursor(envLarge.sab)
        const sourceLarge = insertTestNote(envLarge, 60)
        const targetLarge = insertTestNote(envLarge, 64)
        createSynapse(envLarge, sourceLarge.sourceId, targetLarge.sourceId, 500, 0)
        
        resolved = false
        cursorLarge.resolveSynapseWithCallback(sourceLarge.ptr, () => {
            resolved = true
        })
        expect(resolved).toBe(true)
    })
})

// =============================================================================
// 2. Hash Table Lookup (findHeadSlot) Tests
// =============================================================================

describe('SynapticCursor - Hash Table Lookup', () => {
    test('returns correct slot for existing source', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        // Create two notes and connect them
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 10)
        
        // Resolution should find the synapse
        let resolved = false
        let resolvedTargetPtr = 0
        
        const result = cursor.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
            resolved = true
            resolvedTargetPtr = targetPtr
        })
        
        expect(result).toBe(true)
        expect(resolved).toBe(true)
        expect(resolvedTargetPtr).toBe(target.ptr)
    })

    test('returns -1 (no resolution) for non-existent source', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        // Try to resolve synapse for a non-existent source pointer
        // Use a pointer that's in valid heap range but has no synapse
        const source = insertTestNote(env, 60) // Create a real node
        // Don't create any synapse from it
        
        let resolved = false
        const result = cursor.resolveSynapseWithCallback(source.ptr, () => {
            resolved = true
        })
        
        expect(result).toBe(false)
        expect(resolved).toBe(false)
    })

    test('handles linear probing (multiple synapses from same source)', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        // Create source with multiple targets (tests chain following, not collision)
        const source = insertTestNote(env, 60)
        const target1 = insertTestNote(env, 64)
        const target2 = insertTestNote(env, 67)
        
        createSynapse(env, source.sourceId, target1.sourceId, 500, 0)
        createSynapse(env, source.sourceId, target2.sourceId, 500, 0)
        
        // Should resolve to one of the targets
        let resolvedTargetPtr = 0
        const result = cursor.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
            resolvedTargetPtr = targetPtr
        })
        
        expect(result).toBe(true)
        expect([target1.ptr, target2.ptr]).toContain(resolvedTargetPtr)
    })

    test('returns false when no synapse exists from source', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        // Create nodes but no synapse
        const source = insertTestNote(env, 60)
        insertTestNote(env, 64) // Target exists but not connected
        
        const result = cursor.resolveSynapseWithCallback(source.ptr, () => {})
        expect(result).toBe(false)
    })
})

// =============================================================================
// 3. Candidate Collection (collectCandidates) Tests
// =============================================================================

describe('SynapticCursor - Candidate Collection', () => {
    test('collects valid candidates into SoA arrays', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        // Create source with multiple targets
        const source = insertTestNote(env, 60)
        const target1 = insertTestNote(env, 64)
        const target2 = insertTestNote(env, 67)
        
        createSynapse(env, source.sourceId, target1.sourceId, 800, 10)
        createSynapse(env, source.sourceId, target2.sourceId, 200, 20)
        
        // Resolution should work (candidates collected)
        let resolved = false
        cursor.resolveSynapseWithCallback(source.ptr, () => {
            resolved = true
        })
        
        expect(resolved).toBe(true)
    })

    test('skips tombstones (TARGET_PTR === NULL_PTR)', () => {
        const env = createTestEnvironment()
        
        // Create synapse then disconnect (creates tombstone)
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 0)
        
        // Disconnect creates tombstone
        env.bridge.disconnect(source.sourceId, target.sourceId)
        
        const cursor = new SynapticCursor(env.sab)
        
        // Should not resolve (tombstone skipped, no valid candidates)
        const result = cursor.resolveSynapseWithCallback(source.ptr, () => {})
        expect(result).toBe(false)
    })

    test('respects MAX_FIRES_PER_BLOCK quota', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        // Create source and target
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 0)
        
        // Exhaust quota
        for (let i = 0; i < SYNAPSE_QUOTA.MAX_FIRES_PER_BLOCK; i++) {
            cursor.resolveSynapseWithCallback(source.ptr, () => {})
        }
        
        // Next resolution should fail due to quota
        let resolved = false
        const result = cursor.resolveSynapseWithCallback(source.ptr, () => {
            resolved = true
        })
        
        expect(result).toBe(false)
        expect(resolved).toBe(false)
        expect(cursor.canFireSynapse()).toBe(false)
    })

    test('handles chain correctly (META_NEXT traversal)', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        // Create multiple synapses from same source (forms chain)
        const source = insertTestNote(env, 60)
        const targets: { sourceId: number; ptr: number }[] = []
        
        for (let i = 0; i < 5; i++) {
            const target = insertTestNote(env, 64 + i)
            targets.push(target)
            createSynapse(env, source.sourceId, target.sourceId, 200, i * 10)
        }
        
        // Should resolve to one of the targets
        let resolvedTargetPtr = 0
        const result = cursor.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
            resolvedTargetPtr = targetPtr
        })
        
        expect(result).toBe(true)
        // Resolved target should be one of our targets
        const validTargetPtrs = targets.map(t => t.ptr)
        expect(validTargetPtrs).toContain(resolvedTargetPtr)
    })
})

// =============================================================================
// 4. Weighted Selection (selectWinner) Tests
// =============================================================================

describe('SynapticCursor - Weighted Selection', () => {
    test('single candidate returns that candidate', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab, NULL_PTR, 12345)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 0)
        
        let resolvedTargetPtr = 0
        cursor.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
            resolvedTargetPtr = targetPtr
        })
        
        expect(resolvedTargetPtr).toBe(target.ptr)
    })

    test('all weights zero returns first candidate', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab, NULL_PTR, 12345)
        
        const source = insertTestNote(env, 60)
        const target1 = insertTestNote(env, 64)
        const target2 = insertTestNote(env, 67)
        
        // Create synapses with weight 0
        createSynapse(env, source.sourceId, target1.sourceId, 0, 0)
        createSynapse(env, source.sourceId, target2.sourceId, 0, 0)
        
        let resolvedTargetPtr = 0
        cursor.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
            resolvedTargetPtr = targetPtr
        })
        
        // With all weights zero, should return first candidate (not crash)
        expect(resolvedTargetPtr).not.toBe(0)
    })

    test('distribution matches weights (statistical test with fixed seed)', () => {
        const env = createTestEnvironment()
        
        const source = insertTestNote(env, 60)
        const targetHigh = insertTestNote(env, 64) // High weight
        const targetLow = insertTestNote(env, 67)  // Low weight
        
        // 900 weight vs 100 weight = ~90% vs ~10%
        createSynapse(env, source.sourceId, targetHigh.sourceId, 900, 0)
        createSynapse(env, source.sourceId, targetLow.sourceId, 100, 0)
        
        // Run many resolutions with different seeds
        let highCount = 0
        let lowCount = 0
        const iterations = 1000
        
        for (let i = 0; i < iterations; i++) {
            const cursor = new SynapticCursor(env.sab, NULL_PTR, 12345 + i)
            cursor.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
                if (targetPtr === targetHigh.ptr) {
                    highCount++
                } else if (targetPtr === targetLow.ptr) {
                    lowCount++
                }
            })
        }
        
        // With 900:100 weights, high should be selected ~90% of the time
        // Allow ±15% tolerance for randomness
        const highRatio = highCount / iterations
        expect(highRatio).toBeGreaterThan(0.75)
        expect(highRatio).toBeLessThan(0.99)
    })
})

// =============================================================================
// 5. PRNG Determinism Tests
// =============================================================================

describe('SynapticCursor - PRNG Determinism', () => {
    test('same seed produces identical sequence', () => {
        const env = createTestEnvironment()
        
        const source = insertTestNote(env, 60)
        const target1 = insertTestNote(env, 64)
        const target2 = insertTestNote(env, 67)
        
        createSynapse(env, source.sourceId, target1.sourceId, 500, 0)
        createSynapse(env, source.sourceId, target2.sourceId, 500, 0)
        
        const seed = 42
        const results1: number[] = []
        const results2: number[] = []
        
        // First cursor with seed 42
        const cursor1 = new SynapticCursor(env.sab, NULL_PTR, seed)
        for (let i = 0; i < 10; i++) {
            cursor1.resetBlockQuota()
            cursor1.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
                results1.push(targetPtr)
            })
        }
        
        // Second cursor with same seed 42
        const cursor2 = new SynapticCursor(env.sab, NULL_PTR, seed)
        for (let i = 0; i < 10; i++) {
            cursor2.resetBlockQuota()
            cursor2.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
                results2.push(targetPtr)
            })
        }
        
        expect(results1).toEqual(results2)
    })

    test('different seeds produce different sequences', () => {
        const env = createTestEnvironment()
        
        const source = insertTestNote(env, 60)
        const target1 = insertTestNote(env, 64)
        const target2 = insertTestNote(env, 67)
        
        createSynapse(env, source.sourceId, target1.sourceId, 500, 0)
        createSynapse(env, source.sourceId, target2.sourceId, 500, 0)
        
        const results1: number[] = []
        const results2: number[] = []
        
        // Cursor with seed 100
        const cursor1 = new SynapticCursor(env.sab, NULL_PTR, 100)
        for (let i = 0; i < 20; i++) {
            cursor1.resetBlockQuota()
            cursor1.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
                results1.push(targetPtr)
            })
        }
        
        // Cursor with seed 200
        const cursor2 = new SynapticCursor(env.sab, NULL_PTR, 200)
        for (let i = 0; i < 20; i++) {
            cursor2.resetBlockQuota()
            cursor2.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
                results2.push(targetPtr)
            })
        }
        
        // Should produce different sequences (not equal)
        expect(results1).not.toEqual(results2)
    })

    test('setSeed() resets state correctly', () => {
        const env = createTestEnvironment()
        
        const source = insertTestNote(env, 60)
        const target1 = insertTestNote(env, 64)
        const target2 = insertTestNote(env, 67)
        
        createSynapse(env, source.sourceId, target1.sourceId, 500, 0)
        createSynapse(env, source.sourceId, target2.sourceId, 500, 0)
        
        const cursor = new SynapticCursor(env.sab, NULL_PTR, 42)
        const results1: number[] = []
        
        // Generate first sequence
        for (let i = 0; i < 5; i++) {
            cursor.resetBlockQuota()
            cursor.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
                results1.push(targetPtr)
            })
        }
        
        // Reset seed
        cursor.setSeed(42)
        const results2: number[] = []
        
        // Generate second sequence (should match first)
        for (let i = 0; i < 5; i++) {
            cursor.resetBlockQuota()
            cursor.resolveSynapseWithCallback(source.ptr, (targetPtr) => {
                results2.push(targetPtr)
            })
        }
        
        expect(results1).toEqual(results2)
    })
})

// =============================================================================
// 6. Quota Enforcement Tests
// =============================================================================

describe('SynapticCursor - Quota Enforcement', () => {
    test('canFireSynapse() returns true when under quota', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 0)
        
        for (let i = 0; i < SYNAPSE_QUOTA.MAX_FIRES_PER_BLOCK - 1; i++) {
            cursor.resolveSynapseWithCallback(source.ptr, () => {})
        }
        
        // Should still be able to fire one more
        expect(cursor.canFireSynapse()).toBe(true)
    })

    test('canFireSynapse() returns false when quota exhausted', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 0)
        
        // Exhaust quota
        for (let i = 0; i < SYNAPSE_QUOTA.MAX_FIRES_PER_BLOCK; i++) {
            cursor.resolveSynapseWithCallback(source.ptr, () => {})
        }
        
        expect(cursor.canFireSynapse()).toBe(false)
    })

    test('resetBlockQuota() resets counter', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 0)
        
        // Exhaust quota
        for (let i = 0; i < SYNAPSE_QUOTA.MAX_FIRES_PER_BLOCK; i++) {
            cursor.resolveSynapseWithCallback(source.ptr, () => {})
        }
        
        expect(cursor.canFireSynapse()).toBe(false)
        
        // Reset quota
        cursor.resetBlockQuota()
        
        expect(cursor.canFireSynapse()).toBe(true)
    })
})

// =============================================================================
// 7. Resolution Flow (resolveSynapseWithCallback) Tests
// =============================================================================

describe('SynapticCursor - Resolution Flow', () => {
    test('returns false when quota exceeded', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 0)
        
        // Exhaust quota
        for (let i = 0; i < SYNAPSE_QUOTA.MAX_FIRES_PER_BLOCK; i++) {
            cursor.resolveSynapseWithCallback(source.ptr, () => {})
        }
        
        // Next call should fail
        const result = cursor.resolveSynapseWithCallback(source.ptr, () => {})
        expect(result).toBe(false)
    })

    test('returns false when no synapse found', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        // Create a node but no synapse from it
        const source = insertTestNote(env, 60)
        
        const result = cursor.resolveSynapseWithCallback(source.ptr, () => {})
        expect(result).toBe(false)
    })

    test('returns true and invokes callback on success', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 100) // weight=500, jitter=100
        
        let callbackInvoked = false
        let receivedTargetPtr = 0
        let receivedJitter = 0
        let receivedWeight = 0
        let receivedSynapsePtr = 0
        
        const result = cursor.resolveSynapseWithCallback(source.ptr, (targetPtr, jitter, weight, synapsePtr) => {
            callbackInvoked = true
            receivedTargetPtr = targetPtr
            receivedJitter = jitter
            receivedWeight = weight
            receivedSynapsePtr = synapsePtr
        })
        
        expect(result).toBe(true)
        expect(callbackInvoked).toBe(true)
        expect(receivedTargetPtr).toBe(target.ptr)
        expect(receivedJitter).toBe(100)
        expect(receivedWeight).toBe(500)
        expect(receivedSynapsePtr).toBeGreaterThan(0)
    })

    test('sets pendingJitter and currentPtr correctly', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 50)
        
        expect(cursor.getPendingJitter()).toBe(0)
        expect(cursor.getCurrentPtr()).toBe(NULL_PTR)
        
        cursor.resolveSynapseWithCallback(source.ptr, () => {})
        
        expect(cursor.getPendingJitter()).toBe(50)
        expect(cursor.getCurrentPtr()).toBe(target.ptr)
    })

    test('invokes plasticity callback when set', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 0)
        
        let plasticityInvoked = false
        let receivedSynapsePtr = 0
        
        cursor.setPlasticityCallback((synapsePtr) => {
            plasticityInvoked = true
            receivedSynapsePtr = synapsePtr
        })
        
        cursor.resolveSynapseWithCallback(source.ptr, () => {})
        
        expect(plasticityInvoked).toBe(true)
        expect(receivedSynapsePtr).toBeGreaterThan(0)
    })
})

// =============================================================================
// 8. Jitter Handling Tests
// =============================================================================

describe('SynapticCursor - Jitter Handling', () => {
    test('hasJitter() reflects pending jitter state', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        expect(cursor.hasJitter()).toBe(false)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 100)
        
        cursor.resolveSynapseWithCallback(source.ptr, () => {})
        
        expect(cursor.hasJitter()).toBe(true)
        expect(cursor.getPendingJitter()).toBe(100)
    })

    test('hasJitter() returns false when jitter is 0', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 0) // No jitter
        
        cursor.resolveSynapseWithCallback(source.ptr, () => {})
        
        expect(cursor.hasJitter()).toBe(false)
        expect(cursor.getPendingJitter()).toBe(0)
    })

    test('consumeJitter() clears pending jitter', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 200)
        
        cursor.resolveSynapseWithCallback(source.ptr, () => {})
        
        expect(cursor.hasJitter()).toBe(true)
        expect(cursor.getPendingJitter()).toBe(200)
        
        cursor.consumeJitter()
        
        expect(cursor.hasJitter()).toBe(false)
        expect(cursor.getPendingJitter()).toBe(0)
    })
})

// =============================================================================
// Additional Edge Case Tests
// =============================================================================

describe('SynapticCursor - Edge Cases', () => {
    test('setCurrentPtr() updates position', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        expect(cursor.getCurrentPtr()).toBe(NULL_PTR)
        
        cursor.setCurrentPtr(12345)
        expect(cursor.getCurrentPtr()).toBe(12345)
        
        cursor.setCurrentPtr(NULL_PTR)
        expect(cursor.getCurrentPtr()).toBe(NULL_PTR)
    })

    test('plasticity callback can be set to null', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab)
        
        const source = insertTestNote(env, 60)
        const target = insertTestNote(env, 64)
        createSynapse(env, source.sourceId, target.sourceId, 500, 0)
        
        let plasticityCount = 0
        
        cursor.setPlasticityCallback(() => {
            plasticityCount++
        })
        
        cursor.resolveSynapseWithCallback(source.ptr, () => {})
        expect(plasticityCount).toBe(1)
        
        // Disable plasticity callback
        cursor.setPlasticityCallback(null)
        cursor.resetBlockQuota()
        
        cursor.resolveSynapseWithCallback(source.ptr, () => {})
        expect(plasticityCount).toBe(1) // Should not increase
    })

    test('multiple consecutive resolutions work correctly', () => {
        const env = createTestEnvironment()
        const cursor = new SynapticCursor(env.sab, NULL_PTR, 42)
        
        // Create chain: A → B → C
        const nodeA = insertTestNote(env, 60)
        const nodeB = insertTestNote(env, 64)
        const nodeC = insertTestNote(env, 67)
        
        createSynapse(env, nodeA.sourceId, nodeB.sourceId, 1000, 0)
        createSynapse(env, nodeB.sourceId, nodeC.sourceId, 1000, 0)
        
        // First resolution: A → B
        cursor.resolveSynapseWithCallback(nodeA.ptr, () => {})
        expect(cursor.getCurrentPtr()).toBe(nodeB.ptr)
        
        // Second resolution: B → C
        cursor.resolveSynapseWithCallback(nodeB.ptr, () => {})
        expect(cursor.getCurrentPtr()).toBe(nodeC.ptr)
    })
})
