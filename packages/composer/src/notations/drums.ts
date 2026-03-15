import { GM_DRUM } from '@symphonyscript/theory'
import { DrumHitBuilder } from '../builders/DrumHitBuilder'
import { DrumPatternBuilder } from '../builders/DrumPatternBuilder'
import { DrumEuclideanBuilder } from '../builders/DrumEuclideanBuilder'
import { DrumStepsBuilder } from '../builders/DrumStepsBuilder'
import { RollBuilder } from '../builders/RollBuilder'

// ============================================================================
// Named Drum Hits
// ============================================================================

export function kick(duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.BASS_DRUM_1, duration })
}

export function snare(duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.ACOUSTIC_SNARE, duration })
}

export function hihat(duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.CLOSED_HI_HAT, duration })
}

export function openHat(duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.OPEN_HI_HAT, duration })
}

export function clap(duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.HAND_CLAP, duration })
}

export function tom(n: number, duration?: number): DrumHitBuilder {
  const toms = [
    GM_DRUM.HIGH_TOM,
    GM_DRUM.HI_MID_TOM,
    GM_DRUM.LOW_MID_TOM,
    GM_DRUM.LOW_TOM,
    GM_DRUM.HIGH_FLOOR_TOM,
    GM_DRUM.LOW_FLOOR_TOM,
  ]
  const pitch = toms[Math.min(n - 1, toms.length - 1)] ?? GM_DRUM.HIGH_TOM
  return new DrumHitBuilder({ pitch, duration })
}

export function crash(duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.CRASH_CYMBAL_1, duration })
}

export function ride(duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.RIDE_CYMBAL_1, duration })
}

export function rim(duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.SIDE_STICK, duration })
}

export function cowbell(duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.COWBELL, duration })
}

export function shaker(duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch: GM_DRUM.CABASA, duration })
}

/** Any percussion hit by MIDI pitch. */
export function hit(pitch?: number, duration?: number): DrumHitBuilder {
  return new DrumHitBuilder({ pitch, duration })
}

// ============================================================================
// Drum Patterns
// ============================================================================

/**
 * Text-based drum pattern.
 * 'x' = hit, '.' = rest (advance tick), '-' = sustain (advance tick, no new hit).
 */
export function drumPattern(
  notation?: string,
  pitch?: number,
  stepDuration?: number,
): DrumPatternBuilder {
  return new DrumPatternBuilder({ notation, pitch, stepDuration })
}

/**
 * Euclidean drum rhythm.
 * Distributes hits evenly across steps using Bjorklund's algorithm.
 */
export function drumEuclidean(
  hits?: number,
  steps?: number,
  pitch?: number,
  stepDuration?: number,
  rotation?: number,
): DrumEuclideanBuilder {
  return new DrumEuclideanBuilder({ hits, steps, pitch, stepDuration, rotation })
}

/**
 * Binary drum step pattern.
 * 1 = hit, 0 = rest.
 */
export function drumSteps(
  pattern?: number[],
  pitch?: number,
  stepDuration?: number,
): DrumStepsBuilder {
  return new DrumStepsBuilder({ pattern, pitch, stepDuration })
}

/**
 * Buzz roll — rapid repeated hits over a duration.
 */
export function roll(
  pitch?: number,
  duration?: number,
  rate?: number,
): RollBuilder {
  return new RollBuilder({ pitch, duration, rate })
}
