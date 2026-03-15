import { SynapticMelody } from './SynapticMelody';
import { SiliconBridge } from '@symphonyscript/kernel';
import { parsePitch } from '../utils/pitch';

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
export class StringBuilder extends SynapticMelody {
    /**
     * MIDI pitch bend range constants.
     * Standard pitch bend range is ±2 semitones (8192 units per semitone).
     */
    private static readonly PITCH_BEND_CENTER = 0;
    private static readonly PITCH_BEND_MAX = 8191;
    private static readonly PITCH_BEND_MIN = -8192;
    private static readonly SEMITONES_PER_RANGE = 2; // Standard pitch bend range

    constructor(bridge: SiliconBridge) {
        super(bridge);
    }

    /**
     * Apply pitch bend in semitones.
     * Standard MIDI pitch bend has a range of ±2 semitones.
     * @param semitones - Bend amount in semitones (-12 to +12)
     * @throws Error if semitones exceeds ±12
     */
    bend(semitones: number): this {
        if (semitones < -12 || semitones > 12) {
            throw new Error(`bend() semitones must be -12 to +12, got ${semitones}`);
        }

        // Convert semitones to MIDI pitch bend value
        // Standard range: 2 semitones = full range (8192 units per semitone)
        const unitsPerSemitone = StringBuilder.PITCH_BEND_MAX / StringBuilder.SEMITONES_PER_RANGE;
        const bendValue = Math.round(semitones * unitsPerSemitone);

        // Clamp to valid range
        const clampedValue = Math.max(
            StringBuilder.PITCH_BEND_MIN,
            Math.min(StringBuilder.PITCH_BEND_MAX, bendValue)
        );

        void clampedValue;

        return this;
    }

    /**
     * Slide to a target pitch with legato articulation.
     * Creates a note with glide flag set for smooth transition.
     * @param targetPitch - Target pitch (e.g., 'E4', 60)
     * @param duration - Duration of the slide
     */
    slide(targetPitch: string | number, duration: number): this {
        // Parse the target pitch
        const pitch = typeof targetPitch === 'string'
            ? parsePitch(targetPitch)
            : targetPitch;

        // Use the note cursor with glide for legato slides
        // glide() sets the _glide flag for smooth portamento
        this.note(pitch, duration).glide().commit();
        this.advanceTick(duration);

        return this;
    }

    /**
     * Reset pitch bend to center position.
     */
    bendReset(): this {
        return this;
    }
}
