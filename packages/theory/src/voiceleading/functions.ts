/**
 * Voice leading algorithms — pure math on cent arrays.
 */

import type { VoiceLeadOptions, VoiceLeadingStyle, VoiceMovement } from './types'

const OCTAVE = 1200

// ============================================================================
// Voice Movement Cost
// ============================================================================

/**
 * Calculate total voice movement distance between two interval sets.
 * Lower values = smoother voice leading.
 *
 * @param fromIntervals - Starting chord intervals (cents from root)
 * @param toIntervals - Target chord intervals (cents from root)
 * @returns Total movement in cents
 */
export function voiceMovementCost(
  fromIntervals: readonly number[],
  toIntervals: readonly number[],
): number {
  if (fromIntervals.length === 0 || toIntervals.length === 0) return 0

  let totalCost = 0
  const used = new Set<number>()

  for (let fi = 0; fi < fromIntervals.length; ++fi) {
    let minDist = Infinity
    let bestIdx = -1

    for (let ti = 0; ti < toIntervals.length; ++ti) {
      if (used.has(ti)) continue

      const directDist = Math.abs(fromIntervals[fi] - toIntervals[ti])
      const dist = Math.min(directDist, OCTAVE - directDist)

      if (dist < minDist) {
        minDist = dist
        bestIdx = ti
      }
    }

    if (bestIdx !== -1) {
      used.add(bestIdx)
      totalCost += minDist
    }
  }

  return totalCost
}

// ============================================================================
// Voicing Generation
// ============================================================================

/**
 * Create a close voicing from chord intervals.
 *
 * @param intervals - Chord intervals in cents from root
 * @param voices - Number of voices (default: 4)
 * @param centerOctave - Center octave (default: 4)
 * @returns Array of absolute pitches in cents
 */
export function closeVoicing(
  intervals: readonly number[],
  voices: number = 4,
  centerOctave: number = 4,
): number[] {
  if (intervals.length === 0) return []

  const centerPitch = centerOctave * OCTAVE
  const voiced = new Array(intervals.length)

  for (let i = 0; i < intervals.length; ++i) {
    let pitch = centerPitch + intervals[i]
    while (pitch < centerPitch - OCTAVE / 2) pitch += OCTAVE
    while (pitch > centerPitch + OCTAVE) pitch -= OCTAVE
    voiced[i] = pitch
  }

  voiced.sort((a: number, b: number) => a - b)

  while (voiced.length < voices && voiced.length > 0) {
    voiced.unshift(voiced[0] - OCTAVE)
  }
  while (voiced.length > voices) {
    voiced.pop()
  }

  return voiced
}

/**
 * Create an open voicing from chord intervals.
 *
 * @param intervals - Chord intervals in cents from root
 * @param voices - Number of voices (default: 4)
 * @param centerOctave - Center octave (default: 4)
 * @returns Array of absolute pitches in cents
 */
export function openVoicing(
  intervals: readonly number[],
  voices: number = 4,
  centerOctave: number = 4,
): number[] {
  const close = closeVoicing(intervals, voices, centerOctave)
  if (close.length < 2) return close

  for (let i = 0; i < close.length; ++i) {
    if (i % 2 === 1) close[i] += OCTAVE
  }

  close.sort((a: number, b: number) => a - b)
  return close
}

/**
 * Create a drop-2 voicing from chord intervals.
 * Drop-2: take second-highest note and drop it an octave.
 *
 * @param intervals - Chord intervals in cents from root
 * @param voices - Number of voices (default: 4)
 * @param centerOctave - Center octave (default: 4)
 * @returns Array of absolute pitches in cents
 */
export function drop2Voicing(
  intervals: readonly number[],
  voices: number = 4,
  centerOctave: number = 4,
): number[] {
  const close = closeVoicing(intervals, voices, centerOctave)
  if (close.length < 2) return close

  // Find second-highest
  let max = -Infinity
  let secondMax = -Infinity
  for (let i = 0; i < close.length; ++i) {
    if (close[i] > max) {
      secondMax = max
      max = close[i]
    } else if (close[i] > secondMax) {
      secondMax = close[i]
    }
  }

  for (let i = 0; i < close.length; ++i) {
    if (close[i] === secondMax) {
      close[i] -= OCTAVE
      break
    }
  }

  close.sort((a: number, b: number) => a - b)
  return close
}

// ============================================================================
// Voice Leading
// ============================================================================

/**
 * Voice lead from one chord to another.
 *
 * @param fromIntervals - Starting chord intervals (cents)
 * @param toIntervals - Target chord intervals (cents)
 * @param options - Voice leading options
 * @returns Array of voice movements
 */
export function voiceLead(
  fromIntervals: readonly number[],
  toIntervals: readonly number[],
  options: VoiceLeadOptions = {},
): VoiceMovement[] {
  const { voices = 4, style = 'close', centerOctave = 4 } = options

  const voicingFn = style === 'drop2' ? drop2Voicing
    : style === 'open' ? openVoicing : closeVoicing

  const fromVoicing = voicingFn(fromIntervals, voices, centerOctave)
  const toVoicing = voicingFn(toIntervals, voices, centerOctave)

  if (fromVoicing.length === 0 || toVoicing.length === 0) return []

  const movements: VoiceMovement[] = new Array(Math.min(fromVoicing.length, toVoicing.length))
  const usedTo = new Set<number>()
  let movIdx = 0

  for (let fi = 0; fi < fromVoicing.length; ++fi) {
    let minDist = Infinity
    let bestTo = -1
    let bestToIdx = -1

    for (let ti = 0; ti < toVoicing.length; ++ti) {
      if (usedTo.has(ti)) continue

      const dist = Math.abs(toVoicing[ti] - fromVoicing[fi])
      if (dist < minDist) {
        minDist = dist
        bestTo = toVoicing[ti]
        bestToIdx = ti
      }
    }

    if (bestToIdx !== -1) {
      usedTo.add(bestToIdx)
      movements[movIdx++] = { from: fromVoicing[fi], to: bestTo, distance: minDist }
    }
  }

  movements.length = movIdx
  return movements
}

/**
 * Voice lead through a chord progression.
 *
 * @param progression - Array of chord interval arrays (each in cents)
 * @param options - Voice leading options
 * @returns Array of voicings (one per chord)
 */
export function voiceLeadProgression(
  progression: readonly (readonly number[])[],
  options: VoiceLeadOptions = {},
): number[][] {
  if (progression.length === 0) return []

  const { voices = 4, style = 'close', centerOctave = 4 } = options
  const voicingFn = style === 'drop2' ? drop2Voicing
    : style === 'open' ? openVoicing : closeVoicing

  const result: number[][] = new Array(progression.length)
  let previousVoicing = voicingFn(progression[0], voices, centerOctave)
  result[0] = previousVoicing

  for (let i = 1; i < progression.length; ++i) {
    const nextVoicing = leadToNextChord(previousVoicing, progression[i], centerOctave)
    result[i] = nextVoicing
    previousVoicing = nextVoicing
  }

  return result
}

function leadToNextChord(
  previousVoicing: number[],
  nextIntervals: readonly number[],
  centerOctave: number,
): number[] {
  if (nextIntervals.length === 0) return []

  // Generate octave variants for targets
  const variantsPerInterval = 5
  const targetVariants = new Array(nextIntervals.length * variantsPerInterval)
  let vi = 0
  for (let ii = 0; ii < nextIntervals.length; ++ii) {
    for (let oct = centerOctave - 2; oct <= centerOctave + 2; ++oct) {
      targetVariants[vi++] = oct * OCTAVE + nextIntervals[ii]
    }
  }

  const result: number[] = new Array(previousVoicing.length)
  const usedTargets = new Set<number>()
  let ri = 0

  for (let pi = 0; pi < previousVoicing.length; ++pi) {
    let closest: number | null = null
    let minDistance = Infinity

    for (let ti = 0; ti < targetVariants.length; ++ti) {
      const target = targetVariants[ti]
      const pitchClass = ((target % OCTAVE) + OCTAVE) % OCTAVE
      let isValid = false
      for (let ni = 0; ni < nextIntervals.length; ++ni) {
        if (nextIntervals[ni] === pitchClass) { isValid = true; break }
      }
      if (!isValid) continue
      if (usedTargets.has(target)) continue

      const distance = Math.abs(target - previousVoicing[pi])
      if (distance < minDistance) {
        minDistance = distance
        closest = target
      }
    }

    if (closest !== null) {
      result[ri++] = closest
      usedTargets.add(closest)
    }
  }

  // Fill remaining voices
  while (ri < previousVoicing.length) {
    for (let ti = 0; ti < targetVariants.length; ++ti) {
      if (!usedTargets.has(targetVariants[ti])) {
        result[ri++] = targetVariants[ti]
        usedTargets.add(targetVariants[ti])
        break
      }
    }
  }

  result.length = ri
  result.sort((a: number, b: number) => a - b)
  return result
}

// ============================================================================
// Pitch Utilities
// ============================================================================

/**
 * Extract pitch class (interval within octave) from absolute cent pitch.
 *
 * @param pitch - Absolute pitch in cents
 * @returns Interval within octave (0–1199)
 */
export function pitchToInterval(pitch: number): number {
  return ((pitch % OCTAVE) + OCTAVE) % OCTAVE
}

/**
 * Get octave number from absolute cent pitch.
 *
 * @param pitch - Absolute pitch in cents
 * @returns Octave number
 */
export function pitchToOctave(pitch: number): number {
  return Math.floor(pitch / OCTAVE)
}

/**
 * Create absolute pitch from interval and octave.
 *
 * @param interval - Interval in cents (0–1199)
 * @param octave - Octave number
 * @returns Absolute pitch in cents
 */
export function createPitch(interval: number, octave: number): number {
  return octave * OCTAVE + interval
}
