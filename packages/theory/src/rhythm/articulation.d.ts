/**
 * RFC-047: Articulation Utilities (24-EDO Native)
 *
 * Note articulation duration multipliers for expressive performance.
 * All functions are KERNEL-SAFE (pure lookup, no allocation).
 */
/**
 * Standard musical articulation types.
 */
export type Articulation = 'staccato' | 'legato' | 'accent' | 'tenuto' | 'marcato';
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
export declare const ARTICULATION_MULTIPLIER: Readonly<Record<Articulation, number>>;
/**
 * Articulation velocity multipliers (for accented articulations).
 * KERNEL-SAFE: Frozen lookup table.
 */
export declare const ARTICULATION_VELOCITY: Readonly<Record<Articulation, number>>;
/**
 * Get duration multiplier for articulation.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param articulation - Articulation type (optional)
 * @returns Duration multiplier (1.0 if no articulation)
 */
export declare function getArticulationMultiplier(articulation?: Articulation): number;
/**
 * Get velocity multiplier for articulation.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param articulation - Articulation type (optional)
 * @returns Velocity multiplier (1.0 if no articulation)
 */
export declare function getArticulationVelocity(articulation?: Articulation): number;
/**
 * Check if articulation type is valid.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - Value to check
 * @returns True if value is a valid Articulation
 */
export declare function isArticulation(value: string): value is Articulation;
//# sourceMappingURL=articulation.d.ts.map