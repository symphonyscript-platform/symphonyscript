/**
 * RFC-047: Rhythm Helper Types (24-EDO Native)
 *
 * Type definitions for rhythm, velocity, and patterns.
 */

// ============================================================================
// SECTION 1: Velocity Types
// ============================================================================

/**
 * Velocity value (0-127 for MIDI, or normalized 0-1).
 */
export type Velocity = number;

// ============================================================================
// SECTION 2: Pattern Types
// ============================================================================

/**
 * Arpeggiator pattern directions.
 */
export type ArpPattern =
    | 'up'        // Low to high
    | 'down'      // High to low
    | 'upDown'    // Low to high to low
    | 'downUp'    // High to low to high
    | 'random'    // Random order
    | 'converge'  // Outside to inside
    | 'diverge';  // Inside to outside

// ============================================================================
// SECTION 3: Time Signature Types
// ============================================================================

/**
 * Time signature as string (e.g., "4/4", "3/4", "6/8").
 */
export type TimeSignatureString = `${number}/${number}`;

// ============================================================================
// SECTION 4: Validation
// ============================================================================

/**
 * All valid arp patterns.
 * KERNEL-SAFE: Frozen array.
 */
export const ARP_PATTERNS: readonly ArpPattern[] = Object.freeze([
    'up', 'down', 'upDown', 'downUp', 'random', 'converge', 'diverge'
]);

/**
 * Check if a string is a valid arp pattern.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid ArpPattern
 */
export function isArpPattern(value: string): value is ArpPattern {
    return ARP_PATTERNS.includes(value as ArpPattern);
}

/**
 * Check if a string is a valid time signature.
 * KERNEL-SAFE: Pure regex check.
 *
 * @param value - String to check
 * @returns True if valid TimeSignatureString format
 */
export function isTimeSignatureString(value: string): value is TimeSignatureString {
    return /^\d+\/\d+$/.test(value);
}

/**
 * Check if a velocity value is valid (0-127).
 * KERNEL-SAFE: Pure check.
 *
 * @param value - Value to check
 * @returns True if valid MIDI velocity
 */
export function isValidVelocity(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 127;
}
