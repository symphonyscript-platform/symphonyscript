/**
 * Tests for scales/helpers.ts - Scale Note Helpers
 */

import {
    parseRoot,
    degreeToNote,
    getScaleNotes,
    createScaleContext,
    isValidScaleMode,
    getSupportedScaleModes,
    getScaleModeSize,
    type ScaleMode,
    type ScaleContext,
} from '../scales/helpers';

describe('scales/helpers', () => {
    // =========================================================================
    // parseRoot()
    // =========================================================================
    describe('parseRoot()', () => {
        it('parses natural notes', () => {
            expect(parseRoot('C')).toBe(0);
            expect(parseRoot('D')).toBe(2);
            expect(parseRoot('E')).toBe(4);
            expect(parseRoot('F')).toBe(5);
            expect(parseRoot('G')).toBe(7);
            expect(parseRoot('A')).toBe(9);
            expect(parseRoot('B')).toBe(11);
        });

        it('parses sharps', () => {
            expect(parseRoot('C#')).toBe(1);
            expect(parseRoot('D#')).toBe(3);
            expect(parseRoot('F#')).toBe(6);
            expect(parseRoot('G#')).toBe(8);
            expect(parseRoot('A#')).toBe(10);
        });

        it('parses flats', () => {
            expect(parseRoot('Db')).toBe(1);
            expect(parseRoot('Eb')).toBe(3);
            expect(parseRoot('Gb')).toBe(6);
            expect(parseRoot('Ab')).toBe(8);
            expect(parseRoot('Bb')).toBe(10);
        });

        it('handles lowercase', () => {
            expect(parseRoot('c')).toBe(0);
            expect(parseRoot('f#')).toBe(6);
            expect(parseRoot('bb')).toBe(10);
        });

        it('returns null for invalid input', () => {
            expect(parseRoot('')).toBeNull();
            expect(parseRoot('H')).toBeNull();
            expect(parseRoot('C4')).toBeNull();
            expect(parseRoot('C##')).toBeNull();
        });
    });

    // =========================================================================
    // degreeToNote()
    // =========================================================================
    describe('degreeToNote()', () => {
        it('converts C major scale degrees', () => {
            expect(degreeToNote(1, 'C', 'major', 4)).toBe('C4');
            expect(degreeToNote(2, 'C', 'major', 4)).toBe('D4');
            expect(degreeToNote(3, 'C', 'major', 4)).toBe('E4');
            expect(degreeToNote(4, 'C', 'major', 4)).toBe('F4');
            expect(degreeToNote(5, 'C', 'major', 4)).toBe('G4');
            expect(degreeToNote(6, 'C', 'major', 4)).toBe('A4');
            expect(degreeToNote(7, 'C', 'major', 4)).toBe('B4');
        });

        it('converts G major scale degrees', () => {
            expect(degreeToNote(1, 'G', 'major', 4)).toBe('G4');
            expect(degreeToNote(7, 'G', 'major', 4)).toBe('F#5');
        });

        it('converts A minor scale degrees', () => {
            expect(degreeToNote(1, 'A', 'minor', 4)).toBe('A4');
            expect(degreeToNote(3, 'A', 'minor', 4)).toBe('C5');
            expect(degreeToNote(7, 'A', 'minor', 4)).toBe('G5');
        });

        it('handles flat keys with flats', () => {
            expect(degreeToNote(1, 'F', 'major', 4)).toBe('F4');
            expect(degreeToNote(4, 'F', 'major', 4)).toBe('Bb4');
        });

        it('handles octave wrapping for high degrees', () => {
            // Degree 8 should be octave higher
            expect(degreeToNote(8, 'C', 'major', 4)).toBe('C5');
            expect(degreeToNote(9, 'C', 'major', 4)).toBe('D5');
        });

        it('handles chromatic alterations', () => {
            // Raised 4th degree
            expect(degreeToNote(4, 'C', 'major', 4, 1)).toBe('F#4');
            // Lowered 7th degree
            expect(degreeToNote(7, 'C', 'major', 4, -1)).toBe('Bb4');
        });

        it('handles octave offset', () => {
            expect(degreeToNote(1, 'C', 'major', 4, 0, 1)).toBe('C5');
            expect(degreeToNote(1, 'C', 'major', 4, 0, -1)).toBe('C3');
        });

        it('converts pentatonic scales', () => {
            // C pentatonic major: C D E G A
            expect(degreeToNote(1, 'C', 'pentatonicMajor', 4)).toBe('C4');
            expect(degreeToNote(3, 'C', 'pentatonicMajor', 4)).toBe('E4');
            expect(degreeToNote(4, 'C', 'pentatonicMajor', 4)).toBe('G4');
        });

        it('converts blues scale', () => {
            // C blues: C Eb F Gb G Bb
            expect(degreeToNote(1, 'C', 'blues', 4)).toBe('C4');
        });

        it('returns null for invalid mode', () => {
            expect(degreeToNote(1, 'C', 'invalid' as ScaleMode, 4)).toBeNull();
        });

        it('returns null for invalid root', () => {
            expect(degreeToNote(1, 'H', 'major', 4)).toBeNull();
        });

        it('returns null for invalid degree/octave', () => {
            expect(degreeToNote(NaN, 'C', 'major', 4)).toBeNull();
            expect(degreeToNote(1, 'C', 'major', NaN)).toBeNull();
        });
    });

    // =========================================================================
    // getScaleNotes()
    // =========================================================================
    describe('getScaleNotes()', () => {
        it('returns C major scale notes', () => {
            const context: ScaleContext = { root: 'C', mode: 'major', octave: 4 };
            const notes = getScaleNotes(context);
            expect(notes).not.toBeNull();
            expect(notes).toHaveLength(7);
            expect(notes).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']);
        });

        it('returns G major scale notes', () => {
            const context: ScaleContext = { root: 'G', mode: 'major', octave: 4 };
            const notes = getScaleNotes(context);
            expect(notes).not.toBeNull();
            expect(notes).toContain('G4');
            expect(notes).toContain('F#5');
        });

        it('returns A minor scale notes', () => {
            const context: ScaleContext = { root: 'A', mode: 'minor', octave: 4 };
            const notes = getScaleNotes(context);
            expect(notes).not.toBeNull();
            expect(notes).toHaveLength(7);
            expect(notes![0]).toBe('A4');
        });

        it('returns pentatonic scale notes', () => {
            const context: ScaleContext = { root: 'C', mode: 'pentatonicMajor', octave: 4 };
            const notes = getScaleNotes(context);
            expect(notes).not.toBeNull();
            expect(notes).toHaveLength(5);
        });

        it('returns blues scale notes', () => {
            const context: ScaleContext = { root: 'C', mode: 'blues', octave: 4 };
            const notes = getScaleNotes(context);
            expect(notes).not.toBeNull();
            expect(notes).toHaveLength(6);
        });

        it('returns chromatic scale notes', () => {
            const context: ScaleContext = { root: 'C', mode: 'chromatic', octave: 4 };
            const notes = getScaleNotes(context);
            expect(notes).not.toBeNull();
            expect(notes).toHaveLength(12);
        });

        it('returns null for invalid context', () => {
            expect(getScaleNotes({ root: 'H', mode: 'major', octave: 4 })).toBeNull();
            expect(getScaleNotes({ root: 'C', mode: 'invalid' as ScaleMode, octave: 4 })).toBeNull();
            expect(getScaleNotes(null as unknown as ScaleContext)).toBeNull();
        });
    });

    // =========================================================================
    // createScaleContext()
    // =========================================================================
    describe('createScaleContext()', () => {
        it('creates valid context', () => {
            const context = createScaleContext('C', 'major', 4);
            expect(context).not.toBeNull();
            expect(context!.root).toBe('C');
            expect(context!.mode).toBe('major');
            expect(context!.octave).toBe(4);
        });

        it('returns null for invalid root', () => {
            expect(createScaleContext('H', 'major', 4)).toBeNull();
        });

        it('returns null for invalid mode', () => {
            expect(createScaleContext('C', 'invalid' as ScaleMode, 4)).toBeNull();
        });

        it('returns null for invalid octave', () => {
            expect(createScaleContext('C', 'major', NaN)).toBeNull();
        });
    });

    // =========================================================================
    // isValidScaleMode()
    // =========================================================================
    describe('isValidScaleMode()', () => {
        it('validates supported modes', () => {
            expect(isValidScaleMode('major')).toBe(true);
            expect(isValidScaleMode('minor')).toBe(true);
            expect(isValidScaleMode('dorian')).toBe(true);
            expect(isValidScaleMode('pentatonicMajor')).toBe(true);
            expect(isValidScaleMode('blues')).toBe(true);
        });

        it('rejects invalid modes', () => {
            expect(isValidScaleMode('invalid')).toBe(false);
            expect(isValidScaleMode('')).toBe(false);
        });
    });

    // =========================================================================
    // getSupportedScaleModes()
    // =========================================================================
    describe('getSupportedScaleModes()', () => {
        it('returns array of modes', () => {
            const modes = getSupportedScaleModes();
            expect(Array.isArray(modes)).toBe(true);
            expect(modes.length).toBeGreaterThan(0);
        });

        it('includes common modes', () => {
            const modes = getSupportedScaleModes();
            expect(modes).toContain('major');
            expect(modes).toContain('minor');
            expect(modes).toContain('dorian');
            expect(modes).toContain('pentatonicMajor');
            expect(modes).toContain('blues');
        });
    });

    // =========================================================================
    // getScaleModeSize()
    // =========================================================================
    describe('getScaleModeSize()', () => {
        it('returns correct sizes for different scales', () => {
            expect(getScaleModeSize('major')).toBe(7);
            expect(getScaleModeSize('minor')).toBe(7);
            expect(getScaleModeSize('pentatonicMajor')).toBe(5);
            expect(getScaleModeSize('pentatonicMinor')).toBe(5);
            expect(getScaleModeSize('blues')).toBe(6);
            expect(getScaleModeSize('chromatic')).toBe(12);
        });

        it('returns null for invalid mode', () => {
            expect(getScaleModeSize('invalid' as ScaleMode)).toBeNull();
        });
    });
});
