/**
 * Tests for harmony/progressions.ts - String-based Progression Helpers
 */

import {
    romanToChord,
    progressionToChords,
    degreeToRoot,
    createKey,
    KEY_ROOT,
    PROGRESSION,
    type KeyContext,
} from '../harmony/progressions';

describe('harmony/progressions string helpers', () => {
    // Create test key contexts
    const cMajor: KeyContext = createKey(KEY_ROOT.C, 'major');
    const aMinor: KeyContext = createKey(KEY_ROOT.A, 'minor');
    const gMajor: KeyContext = createKey(KEY_ROOT.G, 'major');
    const fMajor: KeyContext = createKey(KEY_ROOT.F, 'major');
    const bbMajor: KeyContext = createKey(KEY_ROOT.Bb, 'major');

    // =========================================================================
    // degreeToRoot()
    // =========================================================================
    describe('degreeToRoot()', () => {
        it('returns correct roots for C major scale degrees', () => {
            expect(degreeToRoot(1, cMajor)).toBe('C');
            expect(degreeToRoot(2, cMajor)).toBe('D');
            expect(degreeToRoot(3, cMajor)).toBe('E');
            expect(degreeToRoot(4, cMajor)).toBe('F');
            expect(degreeToRoot(5, cMajor)).toBe('G');
            expect(degreeToRoot(6, cMajor)).toBe('A');
            expect(degreeToRoot(7, cMajor)).toBe('B');
        });

        it('returns correct roots for G major scale degrees', () => {
            expect(degreeToRoot(1, gMajor)).toBe('G');
            expect(degreeToRoot(5, gMajor)).toBe('D');
        });

        it('returns correct roots for A minor scale degrees', () => {
            expect(degreeToRoot(1, aMinor)).toBe('A');
            expect(degreeToRoot(3, aMinor)).toBe('C');
            expect(degreeToRoot(5, aMinor)).toBe('E');
        });

        it('handles flat key roots', () => {
            expect(degreeToRoot(1, bbMajor)).toBe('Bb');
            expect(degreeToRoot(4, bbMajor)).toBe('Eb');
        });

        it('handles accidental offsets', () => {
            // bVII in C major = Bb
            expect(degreeToRoot(7, cMajor, -1)).toBe('Bb');
            // #IV in C major = F#
            expect(degreeToRoot(4, cMajor, 1)).toBe('F#');
        });

        it('returns null for invalid degrees', () => {
            expect(degreeToRoot(0, cMajor)).toBeNull();
            expect(degreeToRoot(8, cMajor)).toBeNull();
            expect(degreeToRoot(-1, cMajor)).toBeNull();
        });
    });

    // =========================================================================
    // romanToChord()
    // =========================================================================
    describe('romanToChord()', () => {
        it('converts basic major numerals', () => {
            expect(romanToChord('I', cMajor)).toBe('C');
            expect(romanToChord('IV', cMajor)).toBe('F');
            expect(romanToChord('V', cMajor)).toBe('G');
        });

        it('converts basic minor numerals', () => {
            expect(romanToChord('ii', cMajor)).toBe('Dm');
            expect(romanToChord('iii', cMajor)).toBe('Em');
            expect(romanToChord('vi', cMajor)).toBe('Am');
        });

        it('converts diminished numerals', () => {
            expect(romanToChord('viidim', cMajor)).toBe('Bdim');
        });

        it('converts seventh chords', () => {
            expect(romanToChord('V7', cMajor)).toBe('G7');
            expect(romanToChord('ii7', cMajor)).toBe('Dm7');
        });

        it('handles modal interchange (flat numerals)', () => {
            expect(romanToChord('bVII', cMajor)).toBe('Bb');
            expect(romanToChord('bIII', cMajor)).toBe('Eb');
        });

        it('converts in different keys', () => {
            expect(romanToChord('I', gMajor)).toBe('G');
            expect(romanToChord('V', gMajor)).toBe('D');
            expect(romanToChord('IV', fMajor)).toBe('Bb');
        });

        it('handles minor key progressions', () => {
            expect(romanToChord('i', aMinor)).toBe('Am');
            expect(romanToChord('iv', aMinor)).toBe('Dm');
            expect(romanToChord('V', aMinor)).toBe('E'); // Often major in minor keys
        });

        it('returns null for invalid numerals', () => {
            expect(romanToChord('', cMajor)).toBeNull();
            expect(romanToChord('invalid', cMajor)).toBeNull();
            expect(romanToChord('VIII', cMajor)).toBeNull();
        });
    });

    // =========================================================================
    // progressionToChords()
    // =========================================================================
    describe('progressionToChords()', () => {
        it('converts I-V-vi-IV progression', () => {
            const chords = progressionToChords(['I', 'V', 'vi', 'IV'], cMajor);
            expect(chords).toEqual(['C', 'G', 'Am', 'F']);
        });

        it('converts ii-V-I jazz progression', () => {
            const chords = progressionToChords(['ii7', 'V7', 'I'], cMajor);
            expect(chords[0]).toBe('Dm7');
            expect(chords[1]).toBe('G7');
            expect(chords[2]).toBe('C');
        });

        it('converts in G major', () => {
            const chords = progressionToChords(['I', 'IV', 'V'], gMajor);
            expect(chords).toEqual(['G', 'C', 'D']);
        });

        it('handles invalid numerals with null entries', () => {
            const chords = progressionToChords(['I', 'invalid', 'V'], cMajor);
            expect(chords[0]).toBe('C');
            expect(chords[1]).toBeNull();
            expect(chords[2]).toBe('G');
        });

        it('converts preset progressions', () => {
            const pop = progressionToChords(PROGRESSION.POP, cMajor);
            expect(pop).toEqual(['C', 'G', 'Am', 'F']);

            const fifties = progressionToChords(PROGRESSION.FIFTIES, cMajor);
            expect(fifties).toEqual(['C', 'Am', 'F', 'G']);
        });

        it('handles empty array', () => {
            const chords = progressionToChords([], cMajor);
            expect(chords).toEqual([]);
        });
    });

    // =========================================================================
    // Integration with PROGRESSION presets
    // =========================================================================
    describe('PROGRESSION presets', () => {
        it('POP progression resolves correctly', () => {
            const chords = progressionToChords(PROGRESSION.POP, gMajor);
            expect(chords).toEqual(['G', 'D', 'Em', 'C']);
        });

        it('ANDALUSIAN progression resolves in A minor', () => {
            const chords = progressionToChords(PROGRESSION.ANDALUSIAN, aMinor);
            expect(chords[0]).toBe('Am');
            // VII in minor = G
            // VI in minor = F
            // V in minor = E
        });

        it('JAZZ_II_V_I resolves with seventh chords', () => {
            const chords = progressionToChords(PROGRESSION.JAZZ_II_V_I, cMajor);
            expect(chords[0]).toContain('m7'); // ii7 = Dm7
            expect(chords[1]).toContain('7');  // V7 = G7
        });
    });
});
