/**
 * RFC-023: Roman Numeral Adapter
 *
 * Converts string-based KeyContext to theory's Interval24EDO-based KeyContext.
 */
import { createKey } from '@symphonyscript/theory';
import type { KeyContext } from '../types';
/**
 * Convert a composer KeyContext (string root) to a theory KeyContext (Interval24EDO root).
 *
 * @param keyContext - Composer's string-based key context
 * @returns Theory's Interval24EDO-based key context, or null if invalid root
 */
export declare function toTheoryKeyContext(keyContext: KeyContext): ReturnType<typeof createKey> | null;
/**
 * Convert a roman numeral to a chord symbol string using composer's string-based KeyContext.
 *
 * @param numeral - Roman numeral (e.g., 'V7', 'bVII', 'ii')
 * @param keyContext - Composer's string-based key context
 * @returns Chord symbol string (e.g., 'G7', 'Bb', 'Dm') or null if invalid
 */
export declare function romanToChord(numeral: string, keyContext: KeyContext): string | null;
//# sourceMappingURL=romanAdapter.d.ts.map