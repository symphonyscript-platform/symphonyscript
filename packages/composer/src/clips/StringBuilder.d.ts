import { SynapticMelody } from './SynapticMelody';
import { SiliconBridge } from '@symphonyscript/kernel';
import { PitchBendOperation } from '../types';
/**
 * StringBuilder - String instrument builder with pitch bend and slide support.
 *
 * Extends SynapticMelody with pitch bend control and legato slide capabilities.
 *
 * Usage:
 * ```typescript
 * const violin = Clip.string('Violin')
 *   .note('C4').commit()
 *   .bend(2)              // Bend up 2 semitones
 *   .slide('E4', 0.5)     // Slide to E4 over half a beat
 *   .bendReset()
 * ```
 */
export declare class StringBuilder extends SynapticMelody {
    private pitchBendOperations;
    /**
     * MIDI pitch bend range constants.
     * Standard pitch bend range is ±2 semitones (8192 units per semitone).
     */
    private static readonly PITCH_BEND_CENTER;
    private static readonly PITCH_BEND_MAX;
    private static readonly PITCH_BEND_MIN;
    private static readonly SEMITONES_PER_RANGE;
    constructor(bridge: SiliconBridge);
    /**
     * Apply pitch bend in semitones.
     * Standard MIDI pitch bend has a range of ±2 semitones.
     * @param semitones - Bend amount in semitones (-12 to +12)
     * @throws Error if semitones exceeds ±12
     */
    bend(semitones: number): this;
    /**
     * Slide to a target pitch with legato articulation.
     * Creates a note with legato flag set for smooth transition.
     * @param targetPitch - Target pitch (e.g., 'E4', 60)
     * @param duration - Duration of the slide
     */
    slide(targetPitch: string | number, duration: number): this;
    /**
     * Reset pitch bend to center position.
     */
    bendReset(): this;
    /**
     * Build and return the ClipNode AST structure.
     * Includes both note operations and pitch bend operations.
     */
    build(): {
        operations: (import("..").NoteOperation | import("..").LoopOp | import("..").ClipOp | import("..").CCOperation | PitchBendOperation)[];
        _version: number;
        kind: "clip";
        name: string;
        tempo?: number;
        timeSignature?: [number, number];
        swing?: number;
        groove?: string | null;
    };
}
//# sourceMappingURL=StringBuilder.d.ts.map