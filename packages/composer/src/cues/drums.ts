import * as Drums from '@symphonyscript/theory'
import { DrumHitBuilder } from '../builders/DrumHitBuilder'
import { DrumPatternBuilder } from '../builders/DrumPatternBuilder'
import { DrumEuclideanBuilder } from '../builders/DrumEuclideanBuilder'
import { DrumStepsBuilder } from '../builders/DrumStepsBuilder'
import { RollBuilder } from '../builders/RollBuilder'

import { NoteDuration, DrumPitch } from '@symphonyscript/core'

/**
 * Bass drum (Drums.BASS_DRUM_1).
 *
 * @param duration - Hit duration in ticks or string (e.g. `'8n'`). `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function kick(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: Drums.BASS_DRUM_1, duration })
}

/**
 * Acoustic snare (Drums.ACOUSTIC_SNARE).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function snare(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: Drums.ACOUSTIC_SNARE, duration })
}

/**
 * Closed hi-hat (Drums.CLOSED_HI_HAT).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function hihat(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: Drums.CLOSED_HI_HAT, duration })
}

/**
 * Open hi-hat (Drums.OPEN_HI_HAT).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function openHat(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: Drums.OPEN_HI_HAT, duration })
}

/**
 * Hand clap (Drums.HAND_CLAP).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function clap(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: Drums.HAND_CLAP, duration })
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
    Drums.HIGH_TOM,
    Drums.HI_MID_TOM,
    Drums.LOW_MID_TOM,
    Drums.LOW_TOM,
    Drums.HIGH_FLOOR_TOM,
    Drums.LOW_FLOOR_TOM,
  ]
  const pitch = toms[Math.min(index - 1, toms.length - 1)] ?? Drums.HIGH_TOM

  return new DrumHitBuilder({ pitch, duration })
}

/**
 * Crash cymbal 1 (Drums.CRASH_CYMBAL_1).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function crash(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: Drums.CRASH_CYMBAL_1, duration })
}

/**
 * Ride cymbal 1 (Drums.RIDE_CYMBAL_1).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function ride(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: Drums.RIDE_CYMBAL_1, duration })
}

/**
 * Side stick / rim shot (Drums.SIDE_STICK).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function rim(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: Drums.SIDE_STICK, duration })
}

/**
 * Cowbell (Drums.COWBELL).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function cowbell(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: Drums.COWBELL, duration })
}

/**
 * Cabasa / shaker (Drums.CABASA).
 *
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function shaker(duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: Drums.CABASA, duration })
}

/**
 * Any percussion hit by pitch in cents.
 *
 * @param pitch - Pitch in cents (e.g. 3600 for bass drum). Omit for bass drum default.
 * @param duration - Hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder}
 */
export function hit(pitch?: DrumPitch, duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch, duration })
}

/**
 * Text-based drum pattern from cue string.
 *
 * `x` = hit, `.` = rest (advance tick), `-` = sustain (advance tick, no new hit).
 * Creates a {@link DrumPatternBuilder} that parses and applies the pattern.
 *
 * @param cue - Pattern string (e.g. `'x.x.x.x.'`).
 * @param pitch - Pitch in cents. Omit to use bridge/snare default.
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
  cue?: string,
  pitch?: DrumPitch,
  stepDuration?: NoteDuration,
): DrumPatternBuilder {
  return new DrumPatternBuilder({ cue, pitch, stepDuration })
}

/**
 * Euclidean drum rhythm. Distributes hits evenly across steps via Bjorklund's algorithm.
 *
 * @param hits - Number of pulses to distribute.
 * @param steps - Total steps in the pattern.
 * @param pitch - Pitch in cents. Omit for snare default.
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
  pitch?: DrumPitch,
  stepDuration?: NoteDuration,
  rotation?: number,
): DrumEuclideanBuilder {
  return new DrumEuclideanBuilder({ hits, steps, pitch, stepDuration, rotation })
}

/**
 * Binary drum step pattern. 1 = hit, 0 = rest.
 *
 * @param pattern - Array of 1s and 0s. Missing or empty defaults to `[1]`.
 * @param pitch - Pitch in cents. Omit for snare default.
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
  pitch?: DrumPitch,
  stepDuration?: NoteDuration,
): DrumStepsBuilder {
  return new DrumStepsBuilder({ pattern, pitch, stepDuration })
}

/**
 * Buzz roll — rapid repeated hits over a duration.
 *
 * @param pitch - Pitch in cents. Omit for snare default.
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
  pitch?: DrumPitch,
  duration?: NoteDuration,
  rate?: number,
): RollBuilder {
  return new RollBuilder({ pitch, duration, rate })
}

/**
 * Flam — one grace note immediately before the main hit.
 *
 * @param pitch - Pitch in cents. Omit for snare default.
 * @param duration - Main hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder} with flam articulation.
 */
export function flam(pitch?: DrumPitch, duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: pitch ?? Drums.ACOUSTIC_SNARE, duration }).flam()
}

/**
 * Drag — multiple grace notes before the main hit.
 *
 * @param pitch - Pitch in cents. Omit for snare default.
 * @param duration - Main hit duration in ticks or string. `undefined` = bridge default.

 * @returns {@link DrumHitBuilder} with drag articulation.
 */
export function drag(pitch?: DrumPitch, duration?: NoteDuration): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: pitch ?? Drums.ACOUSTIC_SNARE, duration }).drag()
}
