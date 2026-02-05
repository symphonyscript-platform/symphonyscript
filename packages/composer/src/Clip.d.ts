import { SiliconBridge } from '@symphonyscript/kernel';
import { SynapticMelody } from './clips/SynapticMelody';
import { SynapticDrums } from './clips/SynapticDrums';
import { KeyboardBuilder } from './clips/KeyboardBuilder';
import { WindBuilder } from './clips/WindBuilder';
import { SynapticGrooveBuilder } from './groove/SynapticGrooveBuilder';
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
 * const drums = Clip.drums('Beat')
 *   .kick().snare().hat()
 *
 * intro.play(drums)
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
     * Create a drums clip builder.
     * Returns SynapticDrums with fluent DSL (kick, snare, hat, etc.).
     * @param name - Clip name (for identification)
     */
    drums(name: string): SynapticDrums;
    /**
     * Create a keyboard clip builder.
     * Returns KeyboardBuilder with fluent DSL (sustain, release, plus all melody methods).
     * @param name - Clip name (for identification)
     */
    keyboard(name: string): KeyboardBuilder;
    /**
     * Create a wind instrument clip builder.
     * Returns WindBuilder with fluent DSL (breath, expressionCC, plus all melody methods).
     * @param name - Clip name (for identification)
     */
    wind(name: string): WindBuilder;
    /**
     * Create a groove template builder.
     * Returns SynapticGrooveBuilder for fluent DSL.
     */
    groove(): SynapticGrooveBuilder;
};
//# sourceMappingURL=Clip.d.ts.map