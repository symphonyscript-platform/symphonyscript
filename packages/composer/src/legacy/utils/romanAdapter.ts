/**
 * RFC-023: Roman Numeral Adapter
 *
 * Converts string-based KeyContext to theory's Interval24EDO-based KeyContext.
 */

import { createKey, KEY_ROOT, romanToChord as theoryRomanToChord } from '@symphonyscript/theory'
import { scaleModeToKeyString } from './key'
import type { KeyContext } from '../types'

/**
 * Map note names to KEY_ROOT keys.
 * Handles both sharp and flat cue.
 */
const NOTE_TO_KEY_ROOT: Record<string, keyof typeof KEY_ROOT> = {
    'C': 'C',
    'C#': 'Cs',
    'Db': 'Db',
    'D': 'D',
    'D#': 'Ds',
    'Eb': 'Eb',
    'E': 'E',
    'F': 'F',
    'F#': 'Fs',
    'Gb': 'Gb',
    'G': 'G',
    'G#': 'Gs',
    'Ab': 'Ab',
    'A': 'A',
    'A#': 'As',
    'Bb': 'Bb',
    'B': 'B',
};

/**
 * Convert a composer KeyContext (string root) to a theory KeyContext (Interval24EDO root).
 *
 * @param keyContext - Composer's string-based key context

 * @returns Theory's Interval24EDO-based key context, or null if invalid root
 */
export function toTheoryKeyContext(keyContext: KeyContext): ReturnType<typeof createKey> | null {
    const keyRootKey = NOTE_TO_KEY_ROOT[keyContext.root];
    if (!keyRootKey) return null;

    const root = KEY_ROOT[keyRootKey];
    return createKey(root, keyContext.mode);
}

/**
 * Convert a roman numeral to a chord symbol string using composer's string-based KeyContext.
 *
 * @param numeral - Roman numeral (e.g., 'V7', 'bVII', 'ii')
 * @param keyContext - Composer's string-based key context

 * @returns Chord symbol string (e.g., 'G7', 'Bb', 'Dm') or null if invalid
 */
export function romanToChord(numeral: string, keyContext: KeyContext): string | null {
    const theoryKey = toTheoryKeyContext(keyContext);
    if (!theoryKey) return null;

    return theoryRomanToChord(numeral, theoryKey);
}
