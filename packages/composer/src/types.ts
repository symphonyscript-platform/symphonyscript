/**
 * Pitch input for note and chord builders. Accepts either a string note name
 * (e.g. `'C4'`, `'F#3'`, `'Bb5'`) or absolute cents from C0.
 *
 * String pitches are resolved via `notation.noteToCents()` at apply-time.
 * Numeric pitches are passed through as-is (already in cents).
 */
export type NotePitch = string | number
