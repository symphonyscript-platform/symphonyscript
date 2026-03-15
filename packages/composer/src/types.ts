import type { LiteralNoteName } from '@symphonyscript/theory'

/**
 * Pitch input — accepts literal note names (e.g., 'C4', 'F#3')
 * for IDE autocompletion, or raw MIDI numbers.
 */
export type NotePitch = LiteralNoteName | number
