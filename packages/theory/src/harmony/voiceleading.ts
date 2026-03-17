/**
 * @symphonyscript/theory — Voice Leading (Cent-Based)
 *
 * Voice leading algorithms to minimize voice movement between chords.
 * Operates on cent-based interval arrays (e.g. [0, 400, 700] for major triad).
 */

/** One octave in cents. */
const OCTAVE = 1200

// ============================================================================
// SECTION 1: Types
// ============================================================================

/**
 * Voice leading style.
 */
export type VoiceLeadingStyle = 'close' | 'open' | 'drop2'

/**
 * Voice leading options.
 */
export interface VoiceLeadOptions {
    /** Number of voices (default: 4) */
    readonly voices?: number
    /** Voicing style */
    readonly style?: VoiceLeadingStyle
    /** Center octave for voicing (default: 4, i.e., middle C octave) */
    readonly centerOctave?: number
}

/**
 * Voice movement from one pitch to another.
 */
export interface VoiceMovement {
    /** Starting pitch in cents */
    readonly from: number
    /** Target pitch in cents */
    readonly to: number
    /** Movement distance in cents */
    readonly distance: number
}

// ============================================================================
// SECTION 2: Voice Movement Cost
// ============================================================================

/**
 * Calculate total voice movement distance between two interval sets.
 *
 * Lower values indicate smoother voice leading.
 * Uses greedy matching to pair voices.
 *
 * @param fromIntervals - Starting chord intervals (cents from root)
 * @param toIntervals - Target chord intervals (cents from root)
 *
 * @returns Total movement in cents
 */
export function voiceMovementCost(
    fromIntervals: readonly number[],
    toIntervals: readonly number[],
): number {
    if (fromIntervals.length === 0 || toIntervals.length === 0) return 0

    let totalCost = 0
    const used = new Set<number>()

    for (const fromInt of fromIntervals) {
        let minDist = Infinity
        let bestIdx = -1

        for (let i = 0; i < toIntervals.length; ++i) {
            if (used.has(i)) continue

            const directDist = Math.abs(fromInt - toIntervals[i])
            const dist = Math.min(directDist, OCTAVE - directDist)

            if (dist < minDist) {
                minDist = dist
                bestIdx = i
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
// SECTION 3: Voicing Generation
// ============================================================================

/**
 * Create a close voicing from chord intervals (cents).
 *
 * @param intervals - Chord intervals in cents from root (e.g. [0, 400, 700])
 * @param voices - Number of voices (default: 4)
 * @param centerOctave - Center octave (default: 4)
 *
 * @returns Array of absolute pitches in cents
 */
export function closeVoicing(
    intervals: readonly number[],
    voices: number = 4,
    centerOctave: number = 4,
): number[] {
    if (intervals.length === 0) return []

    const centerPitch = centerOctave * OCTAVE

    // Place intervals close to center
    const voiced = intervals.map(interval => {
        let pitch = centerPitch + interval
        // Adjust to be within one octave of center
        while (pitch < centerPitch - OCTAVE / 2) pitch += OCTAVE
        while (pitch > centerPitch + OCTAVE) pitch -= OCTAVE
        return pitch
    })

    // Sort by pitch
    voiced.sort((a, b) => a - b)

    // Pad to requested voice count by doubling bass
    while (voiced.length < voices && voiced.length > 0) {
        voiced.unshift(voiced[0] - OCTAVE)
    }

    // Trim to voice count
    while (voiced.length > voices) {
        voiced.pop()
    }

    return voiced
}

/**
 * Create an open voicing from chord intervals (cents).
 *
 * @param intervals - Chord intervals in cents from root
 * @param voices - Number of voices (default: 4)
 * @param centerOctave - Center octave (default: 4)
 *
 * @returns Array of absolute pitches in cents
 */
export function openVoicing(
    intervals: readonly number[],
    voices: number = 4,
    centerOctave: number = 4,
): number[] {
    const close = closeVoicing(intervals, voices, centerOctave)
    if (close.length < 2) return close

    // Move every other voice up an octave
    const open = close.map((pitch, i) =>
        i % 2 === 1 ? pitch + OCTAVE : pitch,
    )

    open.sort((a, b) => a - b)
    return open
}

/**
 * Create a drop-2 voicing from chord intervals (cents).
 *
 * Drop-2: Take the second-highest note and drop it an octave.
 *
 * @param intervals - Chord intervals in cents from root
 * @param voices - Number of voices (default: 4)
 * @param centerOctave - Center octave (default: 4)
 *
 * @returns Array of absolute pitches in cents
 */
export function drop2Voicing(
    intervals: readonly number[],
    voices: number = 4,
    centerOctave: number = 4,
): number[] {
    const close = closeVoicing(intervals, voices, centerOctave)
    if (close.length < 2) return close

    // Sort descending to find second-highest
    const sorted = [...close].sort((a, b) => b - a)

    // Drop the second-highest by an octave
    const secondHighest = sorted[1]
    const drop2 = close.map(pitch =>
        pitch === secondHighest ? pitch - OCTAVE : pitch,
    )

    drop2.sort((a, b) => a - b)
    return drop2
}

// ============================================================================
// SECTION 4: Voice Leading
// ============================================================================

/**
 * Voice lead from one chord to another.
 *
 * @param fromIntervals - Starting chord intervals (cents)
 * @param toIntervals - Target chord intervals (cents)
 * @param options - Voice leading options
 *
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

    const movements: VoiceMovement[] = []
    const usedTo = new Set<number>()

    for (const fromPitch of fromVoicing) {
        let minDist = Infinity
        let bestTo = -1
        let bestToIdx = -1

        for (let i = 0; i < toVoicing.length; i++) {
            if (usedTo.has(i)) continue

            const dist = Math.abs(toVoicing[i] - fromPitch)
            if (dist < minDist) {
                minDist = dist
                bestTo = toVoicing[i]
                bestToIdx = i
            }
        }

        if (bestToIdx !== -1) {
            usedTo.add(bestToIdx)
            movements.push({ from: fromPitch, to: bestTo, distance: minDist })
        }
    }

    return movements
}

/**
 * Voice lead through a chord progression.
 *
 * @param progression - Array of chord interval arrays (each in cents)
 * @param options - Voice leading options
 *
 * @returns Array of voicings (one per chord), each an array of absolute cents
 */
export function voiceLeadProgression(
    progression: readonly (readonly number[])[],
    options: VoiceLeadOptions = {},
): number[][] {
    if (progression.length === 0) return []

    const { voices = 4, style = 'close', centerOctave = 4 } = options
    const voicingFn = style === 'drop2' ? drop2Voicing
        : style === 'open' ? openVoicing : closeVoicing

    const result: number[][] = []

    let previousVoicing = voicingFn(progression[0], voices, centerOctave)
    result.push(previousVoicing)

    for (let i = 1; i < progression.length; i++) {
        const nextVoicing = leadToNextChord(previousVoicing, progression[i], options)
        result.push(nextVoicing)
        previousVoicing = nextVoicing
    }

    return result
}

/**
 * Lead voices from previous voicing to next chord.
 */
function leadToNextChord(
    previousVoicing: number[],
    nextIntervals: readonly number[],
    options: VoiceLeadOptions,
): number[] {
    const { centerOctave = 4 } = options

    if (nextIntervals.length === 0) return []

    // Generate all octave variants for targets
    const targetVariants: number[] = []
    for (const interval of nextIntervals) {
        for (let octave = centerOctave - 2; octave <= centerOctave + 2; octave++) {
            targetVariants.push(octave * OCTAVE + interval)
        }
    }

    // For each previous voice, find closest target
    const result: number[] = []
    const usedTargets = new Set<number>()

    for (const prevPitch of previousVoicing) {
        let closest: number | null = null
        let minDistance = Infinity

        for (const target of targetVariants) {
            const pitchClass = ((target % OCTAVE) + OCTAVE) % OCTAVE
            const isValidTarget = nextIntervals.includes(pitchClass)
            if (!isValidTarget) continue
            if (usedTargets.has(target)) continue

            const distance = Math.abs(target - prevPitch)
            if (distance < minDistance) {
                minDistance = distance
                closest = target
            }
        }

        if (closest !== null) {
            result.push(closest)
            usedTargets.add(closest)
        }
    }

    // Fill in any remaining voices
    while (result.length < previousVoicing.length) {
        for (const target of targetVariants) {
            if (!usedTargets.has(target)) {
                result.push(target)
                usedTargets.add(target)
                break
            }
        }
    }

    result.sort((a, b) => a - b)
    return result
}

// ============================================================================
// SECTION 5: Utility Functions
// ============================================================================

/**
 * Extract pitch class (interval within octave) from absolute cent pitch.
 *
 * @param pitch - Absolute pitch in cents
 *
 * @returns Interval within octave (0–1199)
 */
export function pitchToInterval(pitch: number): number {
    return ((pitch % OCTAVE) + OCTAVE) % OCTAVE
}

/**
 * Get octave number from absolute cent pitch.
 *
 * @param pitch - Absolute pitch in cents
 *
 * @returns Octave number
 */
export function pitchToOctave(pitch: number): number {
    return Math.floor(pitch / OCTAVE)
}

/**
 * Create absolute pitch from interval (cents) and octave.
 *
 * @param interval - Interval in cents within octave (0–1199)
 * @param octave - Octave number
 *
 * @returns Absolute pitch in cents
 */
export function createPitch(interval: number, octave: number): number {
    return octave * OCTAVE + interval
}
