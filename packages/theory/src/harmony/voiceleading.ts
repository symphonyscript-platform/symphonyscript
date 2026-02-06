/**
 * RFC-047: Voice Leading (24-EDO Native)
 *
 * Voice leading algorithms to minimize voice movement between chords.
 * Uses 24-EDO intervals instead of MIDI note names.
 */

import type { HarmonyMask, Interval24EDO } from '../types';
import { asInterval24EDO } from '../types';
import { unpackToArray, countBits } from '../packer';
import { OCTAVE_SIZE } from '../constants';

// ============================================================================
// SECTION 1: Types
// ============================================================================

/**
 * Voice leading options.
 */
export interface VoiceLeadOptions {
    /** Number of voices (default: 4) */
    readonly voices?: number;
    /** Voicing style */
    readonly style?: 'close' | 'open' | 'drop2';
    /** Center octave for voicing (default: 4, i.e., middle C octave) */
    readonly centerOctave?: number;
}

/**
 * Voice movement from one pitch to another.
 */
export interface VoiceMovement {
    /** Starting pitch (24-EDO interval + octave offset) */
    readonly from: number;
    /** Target pitch (24-EDO interval + octave offset) */
    readonly to: number;
    /** Movement distance in 24-EDO steps */
    readonly distance: number;
}

// ============================================================================
// SECTION 2: Voice Movement Cost
// ============================================================================

/**
 * Calculate total voice movement distance between two chords.
 * KERNEL-SAFE: Zero allocation, pure bitwise arithmetic.
 *
 * Lower values indicate smoother voice leading.
 * Uses greedy matching to pair voices.
 *
 * @param fromMask - Starting chord mask
 * @param toMask - Target chord mask
 * @returns Total movement in 24-EDO steps
 */
export function voiceMovementCost(fromMask: HarmonyMask, toMask: HarmonyMask): number {
    if (fromMask === 0 || toMask === 0) return 0;

    let totalCost = 0;
    let usedMask = 0;  // Track which toMask bits have been paired
    let remaining = fromMask & 0xFFFFFF;

    // Iterate over each set bit in fromMask
    while (remaining !== 0) {
        // Extract lowest set bit position
        const lowestBit = remaining & -remaining;
        const fromInt = Math.clz32(lowestBit) ^ 31;  // bit position (0-23)
        remaining &= remaining - 1;  // Clear lowest bit

        // Find closest unmatched interval in toMask
        let minDist = 25;  // Max possible is 12 (half octave)
        let bestBit = 0;
        let toRemaining = (toMask & ~usedMask) & 0xFFFFFF;

        while (toRemaining !== 0) {
            const toBit = toRemaining & -toRemaining;
            const toInt = Math.clz32(toBit) ^ 31;
            toRemaining &= toRemaining - 1;

            // Calculate distance considering octave equivalence
            const directDist = fromInt > toInt ? fromInt - toInt : toInt - fromInt;
            const dist = directDist <= 12 ? directDist : OCTAVE_SIZE - directDist;

            if (dist < minDist) {
                minDist = dist;
                bestBit = toBit;
            }
        }

        if (bestBit !== 0) {
            usedMask |= bestBit;
            totalCost += minDist;
        }
    }

    return totalCost;
}

// ============================================================================
// SECTION 3: Voicing Generation
// ============================================================================

/**
 * Create a close voicing for a chord mask.
 * COMPOSER-ONLY: Allocates array.
 *
 * @param mask - Chord mask
 * @param voices - Number of voices
 * @param centerOctave - Center octave (default: 4)
 * @returns Array of absolute pitches (24-EDO interval + octave × OCTAVE_SIZE)
 */
export function closeVoicing(
    mask: HarmonyMask,
    voices: number = 4,
    centerOctave: number = 4
): number[] {
    const intervals = unpackToArray(mask).map(Number);
    if (intervals.length === 0) return [];

    const centerPitch = centerOctave * OCTAVE_SIZE;

    // Place intervals close to center
    const voiced = intervals.map(interval => {
        let pitch = centerPitch + interval;
        // Adjust to be within one octave of center
        while (pitch < centerPitch - OCTAVE_SIZE / 2) pitch += OCTAVE_SIZE;
        while (pitch > centerPitch + OCTAVE_SIZE) pitch -= OCTAVE_SIZE;
        return pitch;
    });

    // Sort by pitch
    voiced.sort((a, b) => a - b);

    // Pad to requested voice count by doubling bass
    while (voiced.length < voices && voiced.length > 0) {
        voiced.unshift(voiced[0] - OCTAVE_SIZE);
    }

    // Trim to voice count
    while (voiced.length > voices) {
        voiced.pop();
    }

    return voiced;
}

/**
 * Create an open voicing for a chord mask.
 * COMPOSER-ONLY: Allocates array.
 *
 * @param mask - Chord mask
 * @param voices - Number of voices
 * @param centerOctave - Center octave (default: 4)
 * @returns Array of absolute pitches
 */
export function openVoicing(
    mask: HarmonyMask,
    voices: number = 4,
    centerOctave: number = 4
): number[] {
    const close = closeVoicing(mask, voices, centerOctave);
    if (close.length < 2) return close;

    // Move every other voice up an octave
    const open = close.map((pitch, i) =>
        i % 2 === 1 ? pitch + OCTAVE_SIZE : pitch
    );

    open.sort((a, b) => a - b);
    return open;
}

/**
 * Create a drop-2 voicing for a chord mask.
 * COMPOSER-ONLY: Allocates array.
 *
 * Drop-2: Take the second-highest note and drop it an octave.
 *
 * @param mask - Chord mask
 * @param voices - Number of voices
 * @param centerOctave - Center octave (default: 4)
 * @returns Array of absolute pitches
 */
export function drop2Voicing(
    mask: HarmonyMask,
    voices: number = 4,
    centerOctave: number = 4
): number[] {
    const close = closeVoicing(mask, voices, centerOctave);
    if (close.length < 2) return close;

    // Sort descending to find second-highest
    const sorted = [...close].sort((a, b) => b - a);

    // Drop the second-highest by an octave
    const secondHighest = sorted[1];
    const drop2 = close.map(pitch =>
        pitch === secondHighest ? pitch - OCTAVE_SIZE : pitch
    );

    drop2.sort((a, b) => a - b);
    return drop2;
}

// ============================================================================
// SECTION 4: Voice Leading
// ============================================================================

/**
 * Voice lead from one chord to another.
 * COMPOSER-ONLY: Allocates arrays.
 *
 * @param fromMask - Starting chord mask
 * @param toMask - Target chord mask
 * @param options - Voice leading options
 * @returns Array of voice movements
 */
export function voiceLead(
    fromMask: HarmonyMask,
    toMask: HarmonyMask,
    options: VoiceLeadOptions = {}
): VoiceMovement[] {
    const { voices = 4, style = 'close', centerOctave = 4 } = options;

    // Get voicings
    const voicingFn = style === 'drop2' ? drop2Voicing :
        style === 'open' ? openVoicing : closeVoicing;

    const fromVoicing = voicingFn(fromMask, voices, centerOctave);
    const toVoicing = voicingFn(toMask, voices, centerOctave);

    if (fromVoicing.length === 0 || toVoicing.length === 0) return [];

    // Match voices by minimal movement
    const movements: VoiceMovement[] = [];
    const usedTo = new Set<number>();

    for (const fromPitch of fromVoicing) {
        let minDist = Infinity;
        let bestTo = -1;
        let bestToIdx = -1;

        // Find closest available target
        for (let i = 0; i < toVoicing.length; i++) {
            if (usedTo.has(i)) continue;

            const toPitch = toVoicing[i];
            const dist = Math.abs(toPitch - fromPitch);

            if (dist < minDist) {
                minDist = dist;
                bestTo = toPitch;
                bestToIdx = i;
            }
        }

        if (bestToIdx !== -1) {
            usedTo.add(bestToIdx);
            movements.push({
                from: fromPitch,
                to: bestTo,
                distance: minDist
            });
        }
    }

    return movements;
}

/**
 * Voice lead through a chord progression.
 * COMPOSER-ONLY: Allocates arrays.
 *
 * @param progression - Array of chord masks
 * @param options - Voice leading options
 * @returns Array of voicings (one per chord)
 */
export function voiceLeadProgression(
    progression: readonly HarmonyMask[],
    options: VoiceLeadOptions = {}
): number[][] {
    if (progression.length === 0) return [];

    const { voices = 4, style = 'close', centerOctave = 4 } = options;
    const voicingFn = style === 'drop2' ? drop2Voicing :
        style === 'open' ? openVoicing : closeVoicing;

    const result: number[][] = [];

    // First chord establishes voicing
    let previousVoicing = voicingFn(progression[0], voices, centerOctave);
    result.push(previousVoicing);

    // Voice lead subsequent chords
    for (let i = 1; i < progression.length; i++) {
        const nextVoicing = leadToNextChord(previousVoicing, progression[i], options);
        result.push(nextVoicing);
        previousVoicing = nextVoicing;
    }

    return result;
}

/**
 * Lead voices from previous voicing to next chord.
 * COMPOSER-ONLY: Allocates array.
 */
function leadToNextChord(
    previousVoicing: number[],
    nextMask: HarmonyMask,
    options: VoiceLeadOptions
): number[] {
    const { centerOctave = 4 } = options;

    const targetIntervals = unpackToArray(nextMask).map(Number);
    if (targetIntervals.length === 0) return [];

    // Generate all octave variants for targets
    const targetVariants: number[] = [];
    for (const interval of targetIntervals) {
        for (let octave = centerOctave - 2; octave <= centerOctave + 2; octave++) {
            targetVariants.push(octave * OCTAVE_SIZE + interval);
        }
    }

    // For each previous voice, find closest target
    const result: number[] = [];
    const usedTargets = new Set<number>();

    for (const prevPitch of previousVoicing) {
        let closest: number | null = null;
        let minDistance = Infinity;

        for (const target of targetVariants) {
            // Check pitch class matches one of the target intervals
            const pitchClass = ((target % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;
            const isValidTarget = targetIntervals.includes(pitchClass);
            if (!isValidTarget) continue;

            // Check not already used
            if (usedTargets.has(target)) continue;

            const distance = Math.abs(target - prevPitch);
            if (distance < minDistance) {
                minDistance = distance;
                closest = target;
            }
        }

        if (closest !== null) {
            result.push(closest);
            usedTargets.add(closest);
        }
    }

    // Fill in any remaining voices
    while (result.length < previousVoicing.length) {
        for (const target of targetVariants) {
            if (!usedTargets.has(target)) {
                result.push(target);
                usedTargets.add(target);
                break;
            }
        }
    }

    result.sort((a, b) => a - b);
    return result;
}

// ============================================================================
// SECTION 5: Utility Functions
// ============================================================================

/**
 * Convert absolute pitch to 24-EDO interval.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param pitch - Absolute pitch (interval + octave × OCTAVE_SIZE)
 * @returns 24-EDO interval (0-23)
 */
export function pitchToInterval(pitch: number): Interval24EDO {
    return asInterval24EDO(((pitch % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE);
}

/**
 * Get octave number from absolute pitch.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param pitch - Absolute pitch
 * @returns Octave number
 */
export function pitchToOctave(pitch: number): number {
    return Math.floor(pitch / OCTAVE_SIZE);
}

/**
 * Create absolute pitch from interval and octave.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param interval - 24-EDO interval
 * @param octave - Octave number
 * @returns Absolute pitch
 */
export function createPitch(interval: Interval24EDO, octave: number): number {
    return octave * OCTAVE_SIZE + Number(interval);
}
