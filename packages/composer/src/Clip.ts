// =============================================================================
// SymphonyScript - Clip Factory (Music OS Entry Point)
// =============================================================================
// High-level DSL factory for composing music.

import { SiliconSynapse, SiliconBridge } from '@symphonyscript/kernel'
import { SynapticMelody } from './clips/SynapticMelody'
import { SynapticDrums } from './clips/SynapticDrums'
import { KeyboardBuilder } from './clips/KeyboardBuilder'
import { SynapticGrooveBuilder } from './groove/SynapticGrooveBuilder'


// =============================================================================
// Session Singleton
// =============================================================================

let activeBridge: SiliconBridge | null = null

/**
 * Initialize the Music OS session with a bridge.
 * Must be called before using Clip factory methods.
 */
export function initSession(bridge: SiliconBridge): void {
    activeBridge = bridge
}

/**
 * Create a default session if none exists.
 * For testing and quick prototyping.
 */
function getOrCreateBridge(): SiliconBridge {
    if (!activeBridge) {
        const linker = SiliconSynapse.create({
            nodeCapacity: 1024,
            safeZoneTicks: 0
        })
        if (!linker) {
            throw new Error('Failed to create SiliconSynapse: invalid configuration')
        }
        activeBridge = new SiliconBridge(linker)
    }
    return activeBridge
}

// =============================================================================
// Clip Factory
// =============================================================================

/**
 * Clip factory for Music OS.
 * 
 * High-level DSL entry point for musical composition.
 * 
 * Usage:
 * ```typescript
 * const intro = Clip.melody('Intro')
 *   .key('C')
 *   .degree(1).degree(3).degree(5)
 * 
 * const drums = Clip.drums('Beat')
 *   .kick().snare().hat()
 * 
 * intro.play(drums)
 * ```
 */
export const Clip = {
    /**
     * Create a melody clip builder.
     * Returns SynapticMelody with fluent DSL (degree, chord, key, scale, etc.).
     * @param name - Clip name (for identification)
     */
    melody(name: string): SynapticMelody {
        const bridge = getOrCreateBridge()
        return new SynapticMelody(bridge)
    },

    /**
     * Create a drums clip builder.
     * Returns SynapticDrums with fluent DSL (kick, snare, hat, etc.).
     * @param name - Clip name (for identification)
     */
    drums(name: string): SynapticDrums {
        const bridge = getOrCreateBridge()
        return new SynapticDrums(bridge)
    },

    /**
     * Create a keyboard clip builder.
     * Returns KeyboardBuilder with fluent DSL (sustain, release, plus all melody methods).
     * @param name - Clip name (for identification)
     */
    keyboard(name: string): KeyboardBuilder {
        const bridge = getOrCreateBridge()
        return new KeyboardBuilder(bridge)
    },

    /**
     * Create a groove template builder.
     * Returns SynapticGrooveBuilder for fluent DSL.
     */
    groove(): SynapticGrooveBuilder {
        return new SynapticGrooveBuilder()
    }
}
