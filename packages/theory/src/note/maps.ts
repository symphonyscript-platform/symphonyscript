/**
 * Note-name ↔ semitone lookup maps.
 * Pure 12-TET chromatic math. Notation-independent.
 */

/** Letter name (with optional accidental) → semitone offset from C (0–11). */
export const NoteToSemitone: Readonly<Record<string, number>> = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4, 'E#': 5,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11, 'B#': 0,
}

/** Semitone index (0–11) → sharp note name. */
export const SemitoneToNoteSharp: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]

/** Semitone index (0–11) → flat note name. */
export const SemitoneToNoteFlat: readonly string[] = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
]
