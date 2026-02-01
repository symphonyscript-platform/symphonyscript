/**
 * RFC-047: Articulation Utilities (24-EDO Native)
 *
 * Note articulation duration multipliers for expressive performance.
 * All functions are KERNEL-SAFE (pure lookup, no allocation).
 */

// ============================================================================
// SECTION 1: Types
// ============================================================================

/**
 * Standard musical articulation types.
 */
export type Articulation = 'staccato' | 'legato' | 'accent' | 'tenuto' | 'marcato';

// ============================================================================
// SECTION 2: Articulation Constants
// ============================================================================

/**
 * Articulation duration multipliers.
 * KERNEL-SAFE: Frozen lookup table.
 *
 * - staccato: 0.5 (half duration - short, detached)
 * - legato: 1.05 (slight overlap - smooth, connected)
 * - accent: 1.0 (normal duration - velocity handled separately)
 * - tenuto: 1.0 (full duration - held for full value)
 * - marcato: 0.75 (strong accent, slightly shorter)
 */
export const ARTICULATION_MULTIPLIER: Readonly<Record<Articulation, number>> = Object.freeze({
    staccato: 0.5,
    legato: 1.05,
    accent: 1.0,
    tenuto: 1.0,
    marcato: 0.75,
});

/**
 * Articulation velocity multipliers (for accented articulations).
 * KERNEL-SAFE: Frozen lookup table.
 */
export const ARTICULATION_VELOCITY: Readonly<Record<Articulation, number>> = Object.freeze({
    staccato: 1.0,
    legato: 0.9,
    accent: 1.3,
    tenuto: 1.0,
    marcato: 1.4,
});

// ============================================================================
// SECTION 3: Articulation Functions
// ============================================================================

/**
 * Get duration multiplier for articulation.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param articulation - Articulation type (optional)
 * @returns Duration multiplier (1.0 if no articulation)
 */
export function getArticulationMultiplier(articulation?: Articulation): number {
    if (!articulation) return 1.0;
    return ARTICULATION_MULTIPLIER[articulation] ?? 1.0;
}

/**
 * Get velocity multiplier for articulation.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param articulation - Articulation type (optional)
 * @returns Velocity multiplier (1.0 if no articulation)
 */
export function getArticulationVelocity(articulation?: Articulation): number {
    if (!articulation) return 1.0;
    return ARTICULATION_VELOCITY[articulation] ?? 1.0;
}

/**
 * Check if articulation type is valid.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - Value to check
 * @returns True if value is a valid Articulation
 */
export function isArticulation(value: string): value is Articulation {
    return value in ARTICULATION_MULTIPLIER;
}
