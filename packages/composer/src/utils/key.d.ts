/**
 * RFC-022: Key Signature Utilities
 *
 * Functions for applying key signature accidentals to notes.
 */
import type { KeyContext, Accidental } from '../types';
/**
 * Apply key signature to a note name.
 *
 * @param noteName - Original note (e.g., 'F4')
 * @param keyContext - Key signature context
 * @param overrideAccidental - Explicit accidental override
 * @returns Modified note name (e.g., 'F#4' in G major)
 */
export declare function applyKeySignature(noteName: string, keyContext: KeyContext | null, overrideAccidental?: Accidental | null): string;
/**
 * Check if a note name has an explicit accidental.
 */
export declare function hasExplicitAccidental(noteName: string): boolean;
//# sourceMappingURL=key.d.ts.map