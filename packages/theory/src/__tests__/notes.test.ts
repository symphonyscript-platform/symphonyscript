/**
 * Tests for pitch/notes.ts - Note Name Utilities
 */

import {
    isNoteName,
    noteName,
    unsafeNoteName,
    Notes,
    parseNoteName,
    createNoteName,
    isPitchClass,
    PITCH_CLASSES,
    type NoteName,
} from '../pitch/notes';

describe('pitch/notes', () => {
    // =========================================================================
    // isNoteName()
    // =========================================================================
    describe('isNoteName()', () => {
        it('validates standard note names', () => {
            expect(isNoteName('C4')).toBe(true);
            expect(isNoteName('D5')).toBe(true);
            expect(isNoteName('E3')).toBe(true);
            expect(isNoteName('F2')).toBe(true);
            expect(isNoteName('G6')).toBe(true);
            expect(isNoteName('A4')).toBe(true);
            expect(isNoteName('B7')).toBe(true);
        });

        it('validates sharps', () => {
            expect(isNoteName('C#4')).toBe(true);
            expect(isNoteName('D#5')).toBe(true);
            expect(isNoteName('F#3')).toBe(true);
            expect(isNoteName('G#2')).toBe(true);
            expect(isNoteName('A#6')).toBe(true);
        });

        it('validates flats', () => {
            expect(isNoteName('Db4')).toBe(true);
            expect(isNoteName('Eb5')).toBe(true);
            expect(isNoteName('Gb3')).toBe(true);
            expect(isNoteName('Ab2')).toBe(true);
            expect(isNoteName('Bb6')).toBe(true);
        });

        it('validates negative octaves', () => {
            expect(isNoteName('C-1')).toBe(true);
            expect(isNoteName('A-2')).toBe(true);
        });

        it('validates lowercase note names', () => {
            expect(isNoteName('c4')).toBe(true);
            expect(isNoteName('f#3')).toBe(true);
            expect(isNoteName('bb5')).toBe(true);
        });

        it('rejects invalid note names', () => {
            expect(isNoteName('')).toBe(false);
            expect(isNoteName('H4')).toBe(false);
            expect(isNoteName('C')).toBe(false);
            expect(isNoteName('4')).toBe(false);
            expect(isNoteName('C##4')).toBe(false);
            expect(isNoteName('Cbb4')).toBe(false);
            expect(isNoteName('C4#')).toBe(false);
            expect(isNoteName('invalid')).toBe(false);
        });
    });

    // =========================================================================
    // noteName()
    // =========================================================================
    describe('noteName()', () => {
        it('returns NoteName for valid input', () => {
            expect(noteName('C4')).toBe('C4');
            expect(noteName('F#3')).toBe('F#3');
            expect(noteName('Bb5')).toBe('Bb5');
        });

        it('returns null for invalid input', () => {
            expect(noteName('')).toBeNull();
            expect(noteName('invalid')).toBeNull();
            expect(noteName('H4')).toBeNull();
        });
    });

    // =========================================================================
    // unsafeNoteName()
    // =========================================================================
    describe('unsafeNoteName()', () => {
        it('casts string to NoteName', () => {
            const note: NoteName = unsafeNoteName('C4');
            expect(note).toBe('C4');
        });
    });

    // =========================================================================
    // Notes factory
    // =========================================================================
    describe('Notes factory', () => {
        it('creates natural notes', () => {
            expect(Notes.C(4)).toBe('C4');
            expect(Notes.D(5)).toBe('D5');
            expect(Notes.E(3)).toBe('E3');
            expect(Notes.F(2)).toBe('F2');
            expect(Notes.G(6)).toBe('G6');
            expect(Notes.A(4)).toBe('A4');
            expect(Notes.B(7)).toBe('B7');
        });

        it('creates sharp notes', () => {
            expect(Notes.Cs(4)).toBe('C#4');
            expect(Notes.Ds(5)).toBe('D#5');
            expect(Notes.Fs(3)).toBe('F#3');
            expect(Notes.Gs(2)).toBe('G#2');
            expect(Notes.As(6)).toBe('A#6');
        });

        it('creates flat notes', () => {
            expect(Notes.Db(4)).toBe('Db4');
            expect(Notes.Eb(5)).toBe('Eb5');
            expect(Notes.Gb(3)).toBe('Gb3');
            expect(Notes.Ab(2)).toBe('Ab2');
            expect(Notes.Bb(6)).toBe('Bb6');
        });

        it('handles negative octaves', () => {
            expect(Notes.C(-1)).toBe('C-1');
            expect(Notes.A(-2)).toBe('A-2');
        });
    });

    // =========================================================================
    // parseNoteName()
    // =========================================================================
    describe('parseNoteName()', () => {
        it('parses standard notes', () => {
            expect(parseNoteName('C4')).toEqual({ pitch: 'C', octave: 4 });
            expect(parseNoteName('G5')).toEqual({ pitch: 'G', octave: 5 });
        });

        it('parses sharps', () => {
            expect(parseNoteName('F#3')).toEqual({ pitch: 'F#', octave: 3 });
            expect(parseNoteName('C#4')).toEqual({ pitch: 'C#', octave: 4 });
        });

        it('parses flats', () => {
            expect(parseNoteName('Bb5')).toEqual({ pitch: 'Bb', octave: 5 });
            expect(parseNoteName('Eb4')).toEqual({ pitch: 'Eb', octave: 4 });
        });

        it('parses negative octaves', () => {
            expect(parseNoteName('C-1')).toEqual({ pitch: 'C', octave: -1 });
        });

        it('normalizes lowercase', () => {
            expect(parseNoteName('c4')).toEqual({ pitch: 'C', octave: 4 });
            expect(parseNoteName('f#3')).toEqual({ pitch: 'F#', octave: 3 });
        });

        it('returns null for invalid input', () => {
            expect(parseNoteName('')).toBeNull();
            expect(parseNoteName('invalid')).toBeNull();
            expect(parseNoteName('C')).toBeNull();
        });
    });

    // =========================================================================
    // createNoteName()
    // =========================================================================
    describe('createNoteName()', () => {
        it('creates note names from pitch and octave', () => {
            expect(createNoteName('C', 4)).toBe('C4');
            expect(createNoteName('F#', 3)).toBe('F#3');
            expect(createNoteName('Bb', 5)).toBe('Bb5');
        });

        it('normalizes pitch case', () => {
            expect(createNoteName('c', 4)).toBe('C4');
            expect(createNoteName('f#', 3)).toBe('F#3');
        });

        it('returns null for invalid pitch', () => {
            expect(createNoteName('H', 4)).toBeNull();
            expect(createNoteName('', 4)).toBeNull();
            expect(createNoteName('C##', 4)).toBeNull();
        });

        it('returns null for invalid octave', () => {
            expect(createNoteName('C', NaN)).toBeNull();
            expect(createNoteName('C', Infinity)).toBeNull();
        });
    });

    // =========================================================================
    // isPitchClass()
    // =========================================================================
    describe('isPitchClass()', () => {
        it('validates pitch classes', () => {
            expect(isPitchClass('C')).toBe(true);
            expect(isPitchClass('C#')).toBe(true);
            expect(isPitchClass('Db')).toBe(true);
            expect(isPitchClass('F#')).toBe(true);
            expect(isPitchClass('Bb')).toBe(true);
        });

        it('rejects invalid pitch classes', () => {
            expect(isPitchClass('H')).toBe(false);
            expect(isPitchClass('C4')).toBe(false);
            expect(isPitchClass('')).toBe(false);
        });
    });

    // =========================================================================
    // PITCH_CLASSES
    // =========================================================================
    describe('PITCH_CLASSES', () => {
        it('contains all 17 pitch classes', () => {
            expect(PITCH_CLASSES).toHaveLength(17);
        });

        it('includes naturals, sharps, and flats', () => {
            expect(PITCH_CLASSES).toContain('C');
            expect(PITCH_CLASSES).toContain('C#');
            expect(PITCH_CLASSES).toContain('Db');
            expect(PITCH_CLASSES).toContain('B');
        });

        it('is frozen', () => {
            expect(Object.isFrozen(PITCH_CLASSES)).toBe(true);
        });
    });
});
