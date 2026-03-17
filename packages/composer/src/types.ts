import type { LiteralNoteName } from '@symphonyscript/notations'

/**
 * Pitch input for note and chord builders. Accepts either a literal note name
 * (e.g. `'C4'`, `'F#3'`, `'Bb5'`) for IDE autocompletion and key-signature-aware
 * resolution, or a raw MIDI note number (0–127).
 *
 * String pitches are resolved via `noteToMidi` with optional key-signature
 * adjustment when a key context is set on the bridge.
 */
export type NotePitch = LiteralNoteName | number
