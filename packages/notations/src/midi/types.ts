/**
 * RFC-047: Branded MIDI Types & Factory Functions
 *
 * Branded types for type-safe MIDI values, channels, and instruments.
 * Extracted from theory/src/pitch/midi.ts §8-9.
 */

// ============================================================================
// SECTION 1: Branded MIDI Types
// ============================================================================

/**
 * Branded MIDI channel (0-15).
 */
export type MidiChannel = number & { readonly __brand: 'MidiChannel' };

/**
 * Branded MIDI value (0-127).
 */
export type MidiValue = number & { readonly __brand: 'MidiValue' };

/**
 * Branded MIDI CC number (0-127).
 */
export type MidiControlID = number & { readonly __brand: 'MidiControlID' };

/**
 * Branded instrument identifier.
 */
export type InstrumentId = string & { readonly __brand: 'InstrumentId' };

// ============================================================================
// SECTION 2: Branded Type Factory Functions
// ============================================================================

/**
 * Create validated MidiChannel.
 * COMPOSER-ONLY: Validation and branding.
 *
 * @param val - Channel number (0-15)

 * @returns MidiChannel or null if invalid
 */
export function midiChannel(val: number): MidiChannel | null {
    if (!Number.isInteger(val) || val < 0 || val > 15) return null;
    return val as MidiChannel;
}

/**
 * Create validated MidiValue.
 * COMPOSER-ONLY: Validation and branding.
 *
 * @param val - MIDI value (0-127)

 * @returns MidiValue or null if invalid
 */
export function midiValue(val: number): MidiValue | null {
    if (!Number.isInteger(val) || val < 0 || val > 127) return null;
    return val as MidiValue;
}

/**
 * Create validated MidiControlID.
 * COMPOSER-ONLY: Validation and branding.
 *
 * @param val - CC number (0-127)

 * @returns MidiControlID or null if invalid
 */
export function midiControl(val: number): MidiControlID | null {
    if (!Number.isInteger(val) || val < 0 || val > 127) return null;
    return val as MidiControlID;
}

/**
 * Create validated InstrumentId.
 * COMPOSER-ONLY: Validation and branding.
 *
 * @param id - Instrument identifier string

 * @returns InstrumentId or null if invalid
 */
export function instrumentId(id: string): InstrumentId | null {
    if (typeof id !== 'string' || id.length === 0) return null;
    return id as InstrumentId;
}

/**
 * Type guard for InstrumentId.
 * KERNEL-SAFE: Pure type check.
 *
 * @param value - Value to check

 * @returns True if value is a valid InstrumentId
 */
export function isInstrumentId(value: unknown): value is InstrumentId {
    return typeof value === 'string' && value.length > 0;
}

/**
 * Unsafe cast to InstrumentId (for internal use).
 * COMPOSER-ONLY: No validation performed.
 *
 * @param id - String to cast (must be pre-validated)

 * @returns InstrumentId (unchecked)
 */
export function unsafeInstrumentId(id: string): InstrumentId {
    return id as InstrumentId;
}
