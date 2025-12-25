import { SiliconBridge } from '@symphonyscript/kernel';
import { SynapticClip } from './SynapticClip';
import { SynapticMelody } from './SynapticMelody';
import { GrooveBuilder } from './GrooveBuilder';
/**
 * Initialize the Music OS session with a bridge.
 * Must be called before using Clip factory methods.
 */
export declare function initSession(bridge: SiliconBridge): void;
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
 * const verse = Clip.melody('Verse')
 *   .chord([1, 4, 6])
 *
 * intro.play(verse)
 * ```
 */
export declare const Clip: {
    /**
     * Create a melody clip builder.
     * Returns SynapticMelody with fluent DSL (degree, chord, key, scale, etc.).
     * @param name - Clip name (for identification)
     */
    melody(name: string): SynapticMelody;
    /**
     * Create a generic clip builder.
     * Returns SynapticClip with fluent DSL (note, rest, play).
     * @param name - Clip name (for identification)
     */
    clip(name: string): SynapticClip;
    /**
     * Create a groove template builder.
     * Returns GrooveBuilder for fluent DSL.
     */
    groove(): GrooveBuilder;
};
//# sourceMappingURL=Clip.d.ts.map