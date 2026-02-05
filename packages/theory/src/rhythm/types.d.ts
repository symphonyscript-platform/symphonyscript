/**
 * RFC-047: Rhythm Helper Types (24-EDO Native)
 *
 * Type definitions for rhythm, velocity, and patterns.
 */
/**
 * Velocity value (0-127 for MIDI, or normalized 0-1).
 */
export type Velocity = number;
/**
 * Arpeggiator pattern directions.
 */
export type ArpPattern = 'up' | 'down' | 'upDown' | 'downUp' | 'random' | 'converge' | 'diverge';
/**
 * Time signature as string (e.g., "4/4", "3/4", "6/8").
 */
export type TimeSignatureString = `${number}/${number}`;
/**
 * All valid arp patterns.
 * KERNEL-SAFE: Frozen array.
 */
export declare const ARP_PATTERNS: readonly ArpPattern[];
/**
 * Check if a string is a valid arp pattern.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid ArpPattern
 */
export declare function isArpPattern(value: string): value is ArpPattern;
/**
 * Check if a string is a valid time signature.
 * KERNEL-SAFE: Pure regex check.
 *
 * @param value - String to check
 * @returns True if valid TimeSignatureString format
 */
export declare function isTimeSignatureString(value: string): value is TimeSignatureString;
/**
 * Check if a velocity value is valid (0-127).
 * KERNEL-SAFE: Pure check.
 *
 * @param value - Value to check
 * @returns True if valid MIDI velocity
 */
export declare function isValidVelocity(value: number): boolean;
//# sourceMappingURL=types.d.ts.map