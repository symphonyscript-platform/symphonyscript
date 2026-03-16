import { GM_DRUM } from '@symphonyscript/theory'
import { DrumHitBuilder } from '../builders/DrumHitBuilder'
import { DrumPatternBuilder } from '../builders/DrumPatternBuilder'
import { DrumEuclideanBuilder } from '../builders/DrumEuclideanBuilder'
import { DrumStepsBuilder } from '../builders/DrumStepsBuilder'
import { RollBuilder } from '../builders/RollBuilder'
import { resolveDuration, type NoteDuration } from '../utils/duration'

/**
 * Bass drum (GM_DRUM.BASS_DRUM_1).
 *
 * @param duration - Hit duration in ticks or string (e.g. `'8n'`). `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function kick(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.BASS_DRUM_1, duration: resolveDuration(duration) })
}

/**
 * Acoustic snare (GM_DRUM.ACOUSTIC_SNARE).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function snare(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.ACOUSTIC_SNARE, duration: resolveDuration(duration) })
}

/**
 * Closed hi-hat (GM_DRUM.CLOSED_HI_HAT).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function hihat(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.CLOSED_HI_HAT, duration: resolveDuration(duration) })
}

/**
 * Open hi-hat (GM_DRUM.OPEN_HI_HAT).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function openHat(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.OPEN_HI_HAT, duration: resolveDuration(duration) })
}

/**
 * Hand clap (GM_DRUM.HAND_CLAP).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function clap(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.HAND_CLAP, duration: resolveDuration(duration) })
}

/**
 * Tom by index (1–6). Maps to high tom, hi-mid, low-mid, low, high floor, low floor.
 *
 * @param index - Tom index (1–6). Values > 6 clamp to low floor tom.
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function tom(index: number, duration?: NoteDuration): DrumHitBuilder {
  const toms = [
    GM_DRUM.HIGH_TOM,
    GM_DRUM.HI_MID_TOM,
    GM_DRUM.LOW_MID_TOM,
    GM_DRUM.LOW_TOM,
    GM_DRUM.HIGH_FLOOR_TOM,
    GM_DRUM.LOW_FLOOR_TOM,
  ]
  const pitch = toms[Math.min(index - 1, toms.length - 1)] ?? GM_DRUM.HIGH_TOM

  return new DrumHitBuilder({ pitch, duration: resolveDuration(duration) })
}

/**
 * Crash cymbal 1 (GM_DRUM.CRASH_CYMBAL_1).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function crash(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.CRASH_CYMBAL_1, duration: resolveDuration(duration) })
}

/**
 * Ride cymbal 1 (GM_DRUM.RIDE_CYMBAL_1).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function ride(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.RIDE_CYMBAL_1, duration: resolveDuration(duration) })
}

/**
 * Side stick / rim shot (GM_DRUM.SIDE_STICK).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function rim(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.SIDE_STICK, duration: resolveDuration(duration) })
}

/**
 * Cowbell (GM_DRUM.COWBELL).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function cowbell(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.COWBELL, duration: resolveDuration(duration) })
}

/**
 * Cabasa / shaker (GM_DRUM.CABASA).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function shaker(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.CABASA, duration: resolveDuration(duration) })
}

/**
 * Any percussion hit by MIDI pitch.
 *
 * @param pitch - GM drum MIDI number (0–127). Omit for bass drum (36).
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function hit(pitch?: number, duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch, duration: resolveDuration(duration) })
}

/**
 * Text-based drum pattern from notation string.
 *
 * `x` = hit, `.` = rest (advance tick), `-` = sustain (advance tick, no new hit).
 * Creates a {@link DrumPatternBuilder} that parses and applies the pattern.
 *
 * @param notation - Pattern string (e.g. `'x.x.x.x.'`).
 * @param pitch - GM drum MIDI number. Omit to use bridge/snare default.
 * @param stepDuration - Duration per step in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumPatternBuilder}
 *
 * @example
 * ```ts
 * drumPattern('x.x.x.x.', 38)           // Snare backbeat
 * drumPattern('x.x.', 36, 240)          // Kick pattern, quarter-note steps
 * ```
 */
export function drumPattern(
  notation?: string,
  pitch?: number,
  stepDuration?: NoteDuration,
): DrumPatternBuilder {
  const resolved = stepDuration !== undefined ? resolveDuration(stepDuration) : undefined
  return new DrumPatternBuilder({ notation, pitch, stepDuration: resolved })
}

/**
 * Euclidean drum rhythm. Distributes hits evenly across steps via Bjorklund's algorithm.
 *
 * @param hits - Number of pulses to distribute.
 * @param steps - Total steps in the pattern.
 * @param pitch - GM drum MIDI number. Omit for snare default.
 * @param stepDuration - Duration per step in ticks or string. `undefined` = bridge default.
 * @param rotation - Rotation offset (positive = right, negative = left).

 * @returns {@link DrumEuclideanBuilder}
 *
 * @example
 * ```ts
 * drumEuclidean(3, 8, 38)              // Tresillo on snare
 * drumEuclidean(5, 8, 36, 240, 1)      // Rotated kick pattern
 * ```
 */
export function drumEuclidean(
  hits?: number,
  steps?: number,
  pitch?: number,
  stepDuration?: NoteDuration,
  rotation?: number,
): DrumEuclideanBuilder {
  const resolved = stepDuration !== undefined ? resolveDuration(stepDuration) : undefined
  return new DrumEuclideanBuilder({ hits, steps, pitch, stepDuration: resolved, rotation })
}

/**
 * Binary drum step pattern. 1 = hit, 0 = rest.
 *
 * @param pattern - Array of 1s and 0s. Missing or empty defaults to `[1]`.
 * @param pitch - GM drum MIDI number. Omit for snare default.
 * @param stepDuration - Duration per step in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumStepsBuilder}
 *
 * @example
 * ```ts
 * drumSteps([1, 0, 1, 0], 38)          // Backbeat
 * drumSteps([1, 1, 0, 1, 0, 1, 0, 1]) // Custom pattern
 * ```
 */
export function drumSteps(
  pattern?: number[],
  pitch?: number,
  stepDuration?: NoteDuration,
): DrumStepsBuilder {
  const resolved = stepDuration !== undefined ? resolveDuration(stepDuration) : undefined
  return new DrumStepsBuilder({ pattern, pitch, stepDuration: resolved })
}

/**
 * Buzz roll — rapid repeated hits over a duration.
 *
 * @param pitch - GM drum MIDI number. Omit for snare default.
 * @param duration - Total roll duration in ticks or string.
 * @param rate - Hits per duration (density). Higher = faster buzz.

 * @returns {@link RollBuilder}
 *
 * @example
 * ```ts
 * roll(38, 480)        // Snare roll, half note
 * roll(36, 240, 16)    // Kick roll with higher density
 * ```
 */
export function roll(
  pitch?: number,
  duration?: NoteDuration,
  rate?: number,
): RollBuilder {
  const resolved = resolveDuration(duration)
  return new RollBuilder({ pitch, duration: resolved, rate })
}

/**
 * Flam — one grace note immediately before the main hit.
 *
 * @param pitch - GM drum MIDI number. Omit for snare default.
 * @param duration - Main hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder} with flam articulation.
 */
export function flam(pitch?: number, duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: pitch ?? GM_DRUM.ACOUSTIC_SNARE, duration: resolveDuration(duration) }).flam()
}

/**
 * Drag — multiple grace notes before the main hit.
 *
 * @param pitch - GM drum MIDI number. Omit for snare default.
 * @param duration - Main hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder} with drag articulation.
 */
export function drag(pitch?: number, duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: pitch ?? GM_DRUM.ACOUSTIC_SNARE, duration: resolveDuration(duration) }).drag()
}
