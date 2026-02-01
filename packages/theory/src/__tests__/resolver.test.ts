/**
 * Tests for chords/resolver.ts - Chord Resolver
 */

import {
    parseChordCode,
    chordToNotes,
    chordToMidi,
    isChordRoot,
    isValidChordCode,
    getChordSize,
    getSupportedChordSuffixes,
    getChordQualityName,
} from '../chords/resolver';

describe('chords/resolver', () => {
    // =========================================================================
    // isChordRoot()
    // =========================================================================
    describe('isChordRoot()', () => {
        it('validates natural roots', () => {
            expect(isChordRoot('C')).toBe(true);
            expect(isChordRoot('D')).toBe(true);
            expect(isChordRoot('E')).toBe(true);
            expect(isChordRoot('F')).toBe(true);
            expect(isChordRoot('G')).toBe(true);
            expect(isChordRoot('A')).toBe(true);
            expect(isChordRoot('B')).toBe(true);
        });

        it('validates sharp roots', () => {
            expect(isChordRoot('C#')).toBe(true);
            expect(isChordRoot('F#')).toBe(true);
            expect(isChordRoot('G#')).toBe(true);
        });

        it('validates flat roots', () => {
            expect(isChordRoot('Db')).toBe(true);
            expect(isChordRoot('Eb')).toBe(true);
            expect(isChordRoot('Bb')).toBe(true);
        });

        it('rejects invalid roots', () => {
            expect(isChordRoot('H')).toBe(false);
            expect(isChordRoot('c')).toBe(false); // lowercase not in set
            expect(isChordRoot('')).toBe(false);
        });
    });

    // =========================================================================
    // parseChordCode()
    // =========================================================================
    describe('parseChordCode()', () => {
        it('parses major chords', () => {
            const result = parseChordCode('C');
            expect(result).not.toBeNull();
            expect(result!.root).toBe('C');
            expect(result!.quality).toBe('');
            expect(result!.intervals).toContain(0); // root
            expect(result!.intervals).toContain(4); // major third
            expect(result!.intervals).toContain(7); // perfect fifth
        });

        it('parses minor chords', () => {
            const result = parseChordCode('Am');
            expect(result).not.toBeNull();
            expect(result!.root).toBe('A');
            expect(result!.quality).toBe('m');
            expect(result!.intervals).toContain(0); // root
            expect(result!.intervals).toContain(3); // minor third
            expect(result!.intervals).toContain(7); // perfect fifth
        });

        it('parses seventh chords', () => {
            const result = parseChordCode('G7');
            expect(result).not.toBeNull();
            expect(result!.root).toBe('G');
            expect(result!.quality).toBe('7');
            expect(result!.intervals).toContain(0);
            expect(result!.intervals).toContain(4);
            expect(result!.intervals).toContain(7);
            expect(result!.intervals).toContain(10); // minor seventh
        });

        it('parses major seventh chords', () => {
            const result = parseChordCode('Cmaj7');
            expect(result).not.toBeNull();
            expect(result!.root).toBe('C');
            expect(result!.quality).toBe('maj7');
            expect(result!.intervals).toContain(11); // major seventh
        });

        it('parses minor seventh chords', () => {
            const result = parseChordCode('Dm7');
            expect(result).not.toBeNull();
            expect(result!.root).toBe('D');
            expect(result!.quality).toBe('m7');
        });

        it('parses diminished chords', () => {
            const result = parseChordCode('Bdim');
            expect(result).not.toBeNull();
            expect(result!.root).toBe('B');
            expect(result!.quality).toBe('dim');
        });

        it('parses augmented chords', () => {
            const result = parseChordCode('Caug');
            expect(result).not.toBeNull();
            expect(result!.root).toBe('C');
            expect(result!.quality).toBe('aug');
        });

        it('parses suspended chords', () => {
            const sus4 = parseChordCode('Dsus4');
            expect(sus4).not.toBeNull();
            expect(sus4!.quality).toBe('sus4');

            const sus2 = parseChordCode('Asus2');
            expect(sus2).not.toBeNull();
            expect(sus2!.quality).toBe('sus2');
        });

        it('parses sharp roots', () => {
            const result = parseChordCode('F#m');
            expect(result).not.toBeNull();
            expect(result!.root).toBe('F#');
            expect(result!.quality).toBe('m');
        });

        it('parses flat roots', () => {
            const result = parseChordCode('Bb7');
            expect(result).not.toBeNull();
            expect(result!.root).toBe('Bb');
            expect(result!.quality).toBe('7');
        });

        it('normalizes lowercase roots', () => {
            const result = parseChordCode('cm7');
            expect(result).not.toBeNull();
            expect(result!.root).toBe('C');
        });

        it('returns null for invalid input', () => {
            expect(parseChordCode('')).toBeNull();
            expect(parseChordCode('H')).toBeNull();
            expect(parseChordCode('Cxyz')).toBeNull();
        });
    });

    // =========================================================================
    // chordToNotes()
    // =========================================================================
    describe('chordToNotes()', () => {
        it('resolves C major to notes', () => {
            const notes = chordToNotes('C', 4);
            expect(notes).not.toBeNull();
            expect(notes).toContain('C4');
            expect(notes).toContain('E4');
            expect(notes).toContain('G4');
        });

        it('resolves Am to notes', () => {
            const notes = chordToNotes('Am', 4);
            expect(notes).not.toBeNull();
            expect(notes).toContain('A4');
            expect(notes).toContain('C5'); // minor third wraps octave
            expect(notes).toContain('E5');
        });

        it('resolves G7 to notes', () => {
            const notes = chordToNotes('G7', 3);
            expect(notes).not.toBeNull();
            expect(notes).toHaveLength(4);
            expect(notes).toContain('G3');
        });

        it('handles different octaves', () => {
            const low = chordToNotes('C', 2);
            const high = chordToNotes('C', 6);
            expect(low).toContain('C2');
            expect(high).toContain('C6');
        });

        it('returns null for invalid chord', () => {
            expect(chordToNotes('Hm', 4)).toBeNull();
            expect(chordToNotes('', 4)).toBeNull();
        });

        it('returns null for invalid octave', () => {
            expect(chordToNotes('C', NaN)).toBeNull();
        });

        it('returns null for out-of-range MIDI', () => {
            // Very high octave would exceed MIDI range
            expect(chordToNotes('C', 11)).toBeNull();
        });
    });

    // =========================================================================
    // chordToMidi()
    // =========================================================================
    describe('chordToMidi()', () => {
        it('resolves C4 major to MIDI numbers', () => {
            const midi = chordToMidi('C', 4);
            expect(midi).not.toBeNull();
            expect(midi).toContain(60); // C4
            expect(midi).toContain(64); // E4
            expect(midi).toContain(67); // G4
        });

        it('resolves Am4 to MIDI numbers', () => {
            const midi = chordToMidi('Am', 4);
            expect(midi).not.toBeNull();
            expect(midi).toContain(69); // A4
        });

        it('returns null for invalid chord', () => {
            expect(chordToMidi('invalid', 4)).toBeNull();
        });
    });

    // =========================================================================
    // isValidChordCode()
    // =========================================================================
    describe('isValidChordCode()', () => {
        it('returns true for valid chords', () => {
            expect(isValidChordCode('C')).toBe(true);
            expect(isValidChordCode('Am')).toBe(true);
            expect(isValidChordCode('F#m7')).toBe(true);
            expect(isValidChordCode('Bbmaj7')).toBe(true);
        });

        it('returns false for invalid chords', () => {
            expect(isValidChordCode('')).toBe(false);
            expect(isValidChordCode('Hm')).toBe(false);
            expect(isValidChordCode('Cxyz')).toBe(false);
        });
    });

    // =========================================================================
    // getChordSize()
    // =========================================================================
    describe('getChordSize()', () => {
        it('returns 3 for triads', () => {
            expect(getChordSize('C')).toBe(3);
            expect(getChordSize('Am')).toBe(3);
            expect(getChordSize('Bdim')).toBe(3);
        });

        it('returns 4 for seventh chords', () => {
            expect(getChordSize('C7')).toBe(4);
            expect(getChordSize('Cmaj7')).toBe(4);
            expect(getChordSize('Am7')).toBe(4);
        });

        it('returns 2 for power chords', () => {
            expect(getChordSize('C5')).toBe(2);
        });

        it('returns null for invalid chords', () => {
            expect(getChordSize('invalid')).toBeNull();
        });
    });

    // =========================================================================
    // getSupportedChordSuffixes()
    // =========================================================================
    describe('getSupportedChordSuffixes()', () => {
        it('returns array of suffixes', () => {
            const suffixes = getSupportedChordSuffixes();
            expect(Array.isArray(suffixes)).toBe(true);
            expect(suffixes.length).toBeGreaterThan(0);
        });

        it('includes common suffixes', () => {
            const suffixes = getSupportedChordSuffixes();
            expect(suffixes).toContain('');
            expect(suffixes).toContain('m');
            expect(suffixes).toContain('7');
            expect(suffixes).toContain('maj7');
            expect(suffixes).toContain('m7');
        });
    });

    // =========================================================================
    // getChordQualityName()
    // =========================================================================
    describe('getChordQualityName()', () => {
        it('returns quality names', () => {
            expect(getChordQualityName('')).toBe('Major');
            expect(getChordQualityName('m')).toBe('Minor');
            expect(getChordQualityName('7')).toBe('Dominant 7th');
            expect(getChordQualityName('maj7')).toBe('Major 7th');
            expect(getChordQualityName('dim')).toBe('Diminished');
        });

        it('returns null for unknown suffixes', () => {
            expect(getChordQualityName('xyz')).toBeNull();
        });
    });
});
