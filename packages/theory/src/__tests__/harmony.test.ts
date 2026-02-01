/**
 * Tests for Harmony Module
 * RFC-047: Bitwise Music Theory System
 */

import {
    // Progressions
    type KeyContext,
    parseRomanNumeral,
    getDegreeInterval,
    degreeToMask,
    romanToMask,
    progressionToMasks,
    PROGRESSION,
    createKey,
    KEY_ROOT,
    // Voice leading
    voiceMovementCost,
    closeVoicing,
    openVoicing,
    drop2Voicing,
    voiceLead,
    voiceLeadProgression,
    pitchToInterval,
    pitchToOctave,
    createPitch,
    // Keys
    getKeySharps,
    getKeyFlats,
    getKeyAccidentals,
    isValidKey,
    countSharps,
    countFlats,
    getRelativeMinor,
    getRelativeMajor,
    getParallelMinor,
    getParallelMajor,
    ALL_KEYS,
    MAJOR_KEYS_CIRCLE,
    applyKeySignature,
} from '../harmony';
import { CHORD } from '../chords';
import { unpackToArray, countBits } from '../packer';
import { asInterval24EDO, asHarmonyMask } from '../types';
import { INTERVAL, OCTAVE_SIZE } from '../constants';

// ============================================================================
// Chord Progressions Tests
// ============================================================================

describe('Chord Progressions', () => {
    describe('parseRomanNumeral()', () => {
        test('parses basic major numeral', () => {
            const result = parseRomanNumeral('I', 'major');
            expect(result).not.toBeNull();
            expect(result!.degree).toBe(1);
            expect(result!.quality).toBe('');
        });

        test('parses basic minor numeral', () => {
            const result = parseRomanNumeral('ii', 'major');
            expect(result).not.toBeNull();
            expect(result!.degree).toBe(2);
            expect(result!.quality).toBe('m');
        });

        test('parses seventh chord', () => {
            const result = parseRomanNumeral('V7', 'major');
            expect(result).not.toBeNull();
            expect(result!.degree).toBe(5);
            expect(result!.quality).toBe('7');
        });

        test('parses diminished chord', () => {
            const result = parseRomanNumeral('viidim', 'major');
            expect(result).not.toBeNull();
            expect(result!.degree).toBe(7);
            expect(result!.quality).toBe('dim');
        });

        test('parses modal interchange (flat)', () => {
            const result = parseRomanNumeral('bVII', 'major');
            expect(result).not.toBeNull();
            expect(result!.degree).toBe(7);
            expect(result!.accidental).toBe(-1);
        });

        test('parses modal interchange (sharp)', () => {
            const result = parseRomanNumeral('#IV', 'major');
            expect(result).not.toBeNull();
            expect(result!.degree).toBe(4);
            expect(result!.accidental).toBe(1);
        });

        test('parses secondary dominant', () => {
            const result = parseRomanNumeral('V/V', 'major');
            expect(result).not.toBeNull();
            expect(result!.degree).toBe(5);
            expect(result!.secondary).toBe(5);
        });

        test('parses inversion', () => {
            const result = parseRomanNumeral('I/3', 'major');
            expect(result).not.toBeNull();
            expect(result!.degree).toBe(1);
            expect(result!.bass).toBe(3);
        });

        test('returns null for invalid input', () => {
            expect(parseRomanNumeral('', 'major')).toBeNull();
            expect(parseRomanNumeral('X', 'major')).toBeNull();
            expect(parseRomanNumeral('VIII', 'major')).toBeNull();
        });
    });

    describe('getDegreeInterval()', () => {
        const cMajor = createKey(KEY_ROOT.C, 'major');
        const aMinor = createKey(KEY_ROOT.A, 'minor');

        test('returns correct intervals for major scale', () => {
            expect(getDegreeInterval(1, cMajor)).toBe(asInterval24EDO(0));  // Unison
            expect(getDegreeInterval(2, cMajor)).toBe(asInterval24EDO(4));  // M2
            expect(getDegreeInterval(3, cMajor)).toBe(asInterval24EDO(8));  // M3
            expect(getDegreeInterval(4, cMajor)).toBe(asInterval24EDO(10)); // P4
            expect(getDegreeInterval(5, cMajor)).toBe(asInterval24EDO(14)); // P5
        });

        test('returns correct intervals for minor scale', () => {
            expect(getDegreeInterval(1, aMinor)).toBe(asInterval24EDO(0));  // Unison
            expect(getDegreeInterval(3, aMinor)).toBe(asInterval24EDO(6));  // m3
            expect(getDegreeInterval(6, aMinor)).toBe(asInterval24EDO(16)); // m6
            expect(getDegreeInterval(7, aMinor)).toBe(asInterval24EDO(20)); // m7
        });
    });

    describe('degreeToMask()', () => {
        const cMajor = createKey(KEY_ROOT.C, 'major');

        test('returns major triad for I in C major', () => {
            const mask = degreeToMask(1, cMajor);
            expect(countBits(mask)).toBe(3);
            // Should contain root, major third, perfect fifth
            const intervals = unpackToArray(mask).map(Number);
            expect(intervals).toContain(0);  // Root (C)
            expect(intervals).toContain(8);  // Major third (E)
            expect(intervals).toContain(14); // Perfect fifth (G)
        });

        test('returns minor triad for ii in C major', () => {
            const mask = degreeToMask(2, cMajor);
            expect(countBits(mask)).toBe(3);
            // Should be D minor (D, F, A)
            const intervals = unpackToArray(mask).map(Number);
            // Transposed by M2 (4), so root is at 4
            expect(intervals).toContain(4);  // D
        });

        test('returns diminished triad for vii in C major', () => {
            const mask = degreeToMask(7, cMajor);
            // Should be B diminished
            const intervals = unpackToArray(mask).map(Number);
            expect(intervals).toContain(22); // B (root)
        });
    });

    describe('romanToMask()', () => {
        const cMajor = createKey(KEY_ROOT.C, 'major');

        test('resolves I to C major', () => {
            const mask = romanToMask('I', cMajor);
            expect(mask).not.toBeNull();
            expect(countBits(mask!)).toBe(3);
        });

        test('resolves V7 to G7', () => {
            const mask = romanToMask('V7', cMajor);
            expect(mask).not.toBeNull();
            expect(countBits(mask!)).toBe(4); // 7th chord has 4 notes
        });

        test('resolves ii7 to Dm7', () => {
            const mask = romanToMask('ii7', cMajor);
            expect(mask).not.toBeNull();
            expect(countBits(mask!)).toBe(4);
        });

        test('returns null for invalid numeral', () => {
            expect(romanToMask('invalid', cMajor)).toBeNull();
        });
    });

    describe('progressionToMasks()', () => {
        const cMajor = createKey(KEY_ROOT.C, 'major');

        test('converts pop progression', () => {
            const masks = progressionToMasks(PROGRESSION.POP, cMajor);
            expect(masks).toHaveLength(4);
            expect(masks.every(m => m !== null)).toBe(true);
        });

        test('converts jazz ii-V-I', () => {
            const masks = progressionToMasks(PROGRESSION.JAZZ_II_V_I, cMajor);
            expect(masks).toHaveLength(3);
            // All should be 7th chords (4 notes)
            expect(masks.every(m => m !== null && countBits(m) === 4)).toBe(true);
        });
    });

    describe('PROGRESSION presets', () => {
        test('POP has 4 chords', () => {
            expect(PROGRESSION.POP).toHaveLength(4);
        });

        test('BLUES_12 has 12 chords', () => {
            expect(PROGRESSION.BLUES_12).toHaveLength(12);
        });

        test('JAZZ_II_V_I has 3 chords', () => {
            expect(PROGRESSION.JAZZ_II_V_I).toHaveLength(3);
        });

        test('all presets are frozen', () => {
            expect(Object.isFrozen(PROGRESSION.POP)).toBe(true);
            expect(Object.isFrozen(PROGRESSION.BLUES_12)).toBe(true);
        });
    });

    describe('KEY_ROOT constants', () => {
        test('C is 0', () => {
            expect(KEY_ROOT.C).toBe(asInterval24EDO(0));
        });

        test('G is 14 (perfect fifth)', () => {
            expect(KEY_ROOT.G).toBe(asInterval24EDO(14));
        });

        test('enharmonic equivalents are equal', () => {
            expect(KEY_ROOT.Cs).toBe(KEY_ROOT.Db);
            expect(KEY_ROOT.Fs).toBe(KEY_ROOT.Gb);
        });
    });
});

// ============================================================================
// Voice Leading Tests
// ============================================================================

describe('Voice Leading', () => {
    describe('voiceMovementCost()', () => {
        test('returns 0 for identical chords', () => {
            expect(voiceMovementCost(CHORD.MAJ, CHORD.MAJ)).toBe(0);
        });

        test('returns low cost for smooth voice leading', () => {
            // C major to A minor share two notes (C, E)
            const cost = voiceMovementCost(CHORD.MAJ, CHORD.MIN);
            expect(cost).toBeLessThan(10);
        });

        test('returns 0 for empty chords', () => {
            expect(voiceMovementCost(asHarmonyMask(0), CHORD.MAJ)).toBe(0);
        });
    });

    describe('closeVoicing()', () => {
        test('creates 4-voice voicing by default', () => {
            const voicing = closeVoicing(CHORD.MAJ);
            expect(voicing).toHaveLength(4);
        });

        test('creates specified number of voices', () => {
            const voicing = closeVoicing(CHORD.MAJ, 3);
            expect(voicing).toHaveLength(3);
        });

        test('returns sorted pitches', () => {
            const voicing = closeVoicing(CHORD.MAJ);
            for (let i = 1; i < voicing.length; i++) {
                expect(voicing[i]).toBeGreaterThanOrEqual(voicing[i - 1]);
            }
        });

        test('returns empty for empty mask', () => {
            expect(closeVoicing(asHarmonyMask(0))).toHaveLength(0);
        });
    });

    describe('openVoicing()', () => {
        test('spreads voices wider than close voicing', () => {
            const close = closeVoicing(CHORD.MAJ7);
            const open = openVoicing(CHORD.MAJ7);

            const closeRange = close[close.length - 1] - close[0];
            const openRange = open[open.length - 1] - open[0];

            expect(openRange).toBeGreaterThan(closeRange);
        });
    });

    describe('drop2Voicing()', () => {
        test('drops second-highest voice', () => {
            const close = closeVoicing(CHORD.MAJ7);
            const drop2 = drop2Voicing(CHORD.MAJ7);

            // Drop2 should have wider range due to dropped voice
            const closeRange = close[close.length - 1] - close[0];
            const drop2Range = drop2[drop2.length - 1] - drop2[0];

            expect(drop2Range).toBeGreaterThan(closeRange);
        });
    });

    describe('voiceLead()', () => {
        test('returns voice movements', () => {
            const movements = voiceLead(CHORD.MAJ, CHORD.MIN);
            expect(movements.length).toBeGreaterThan(0);
            expect(movements[0]).toHaveProperty('from');
            expect(movements[0]).toHaveProperty('to');
            expect(movements[0]).toHaveProperty('distance');
        });

        test('returns empty for empty chords', () => {
            expect(voiceLead(asHarmonyMask(0), CHORD.MAJ)).toHaveLength(0);
        });
    });

    describe('voiceLeadProgression()', () => {
        test('returns voicings for each chord', () => {
            const cMajor = createKey(KEY_ROOT.C, 'major');
            const masks = progressionToMasks(PROGRESSION.POP, cMajor);
            const validMasks = masks.filter((m): m is NonNullable<typeof m> => m !== null);

            const voicings = voiceLeadProgression(validMasks);
            expect(voicings).toHaveLength(validMasks.length);
        });

        test('returns empty for empty progression', () => {
            expect(voiceLeadProgression([])).toHaveLength(0);
        });
    });

    describe('pitch utilities', () => {
        test('pitchToInterval() extracts pitch class', () => {
            expect(pitchToInterval(96)).toBe(asInterval24EDO(0)); // C4
            expect(pitchToInterval(104)).toBe(asInterval24EDO(8)); // E4
        });

        test('pitchToOctave() extracts octave', () => {
            expect(pitchToOctave(96)).toBe(4);
            expect(pitchToOctave(120)).toBe(5);
        });

        test('createPitch() combines interval and octave', () => {
            expect(createPitch(asInterval24EDO(0), 4)).toBe(96);
            expect(createPitch(asInterval24EDO(8), 4)).toBe(104);
        });

        test('round-trip: createPitch -> pitchToInterval/Octave', () => {
            const interval = asInterval24EDO(14);
            const octave = 5;
            const pitch = createPitch(interval, octave);

            expect(pitchToInterval(pitch)).toBe(interval);
            expect(pitchToOctave(pitch)).toBe(octave);
        });
    });
});

// ============================================================================
// Key Signatures Tests
// ============================================================================

describe('Key Signatures', () => {
    describe('getKeySharps()', () => {
        test('C major has no sharps', () => {
            const cMajor = createKey(KEY_ROOT.C, 'major');
            expect(getKeySharps(cMajor)).toBe(asHarmonyMask(0));
        });

        test('G major has F#', () => {
            const gMajor = createKey(KEY_ROOT.G, 'major');
            const sharps = getKeySharps(gMajor);
            expect(Number(sharps)).toBeGreaterThan(0);
        });
    });

    describe('getKeyFlats()', () => {
        test('C major has no flats', () => {
            const cMajor = createKey(KEY_ROOT.C, 'major');
            expect(getKeyFlats(cMajor)).toBe(asHarmonyMask(0));
        });

        test('F major has Bb', () => {
            const fMajor = createKey(KEY_ROOT.F, 'major');
            const flats = getKeyFlats(fMajor);
            expect(Number(flats)).toBeGreaterThan(0);
        });
    });

    describe('countSharps() / countFlats()', () => {
        test('C major has 0 sharps and 0 flats', () => {
            const cMajor = createKey(KEY_ROOT.C, 'major');
            expect(countSharps(cMajor)).toBe(0);
            expect(countFlats(cMajor)).toBe(0);
        });

        test('G major has 1 sharp', () => {
            const gMajor = createKey(KEY_ROOT.G, 'major');
            expect(countSharps(gMajor)).toBe(1);
        });

        test('F major has 1 flat', () => {
            const fMajor = createKey(KEY_ROOT.F, 'major');
            expect(countFlats(fMajor)).toBe(1);
        });
    });

    describe('isValidKey()', () => {
        test('returns true for valid keys', () => {
            expect(isValidKey(createKey(KEY_ROOT.C, 'major'))).toBe(true);
            expect(isValidKey(createKey(KEY_ROOT.A, 'minor'))).toBe(true);
            expect(isValidKey(createKey(KEY_ROOT.G, 'major'))).toBe(true);
        });
    });

    describe('relative keys', () => {
        test('getRelativeMinor() of C major is A minor', () => {
            const cMajor = createKey(KEY_ROOT.C, 'major');
            const relative = getRelativeMinor(cMajor);
            expect(relative).not.toBeNull();
            expect(relative!.root).toBe(KEY_ROOT.A);
            expect(relative!.mode).toBe('minor');
        });

        test('getRelativeMajor() of A minor is C major', () => {
            const aMinor = createKey(KEY_ROOT.A, 'minor');
            const relative = getRelativeMajor(aMinor);
            expect(relative).not.toBeNull();
            expect(relative!.root).toBe(KEY_ROOT.C);
            expect(relative!.mode).toBe('major');
        });

        test('getRelativeMinor() returns null for minor key', () => {
            const aMinor = createKey(KEY_ROOT.A, 'minor');
            expect(getRelativeMinor(aMinor)).toBeNull();
        });

        test('getRelativeMajor() returns null for major key', () => {
            const cMajor = createKey(KEY_ROOT.C, 'major');
            expect(getRelativeMajor(cMajor)).toBeNull();
        });
    });

    describe('parallel keys', () => {
        test('getParallelMinor() of C major is C minor', () => {
            const cMajor = createKey(KEY_ROOT.C, 'major');
            const parallel = getParallelMinor(cMajor);
            expect(parallel).not.toBeNull();
            expect(parallel!.root).toBe(KEY_ROOT.C);
            expect(parallel!.mode).toBe('minor');
        });

        test('getParallelMajor() of C minor is C major', () => {
            const cMinor = createKey(KEY_ROOT.C, 'minor');
            const parallel = getParallelMajor(cMinor);
            expect(parallel).not.toBeNull();
            expect(parallel!.root).toBe(KEY_ROOT.C);
            expect(parallel!.mode).toBe('major');
        });
    });

    describe('key constants', () => {
        test('ALL_KEYS contains major and minor keys', () => {
            expect(ALL_KEYS.length).toBeGreaterThan(20);
            expect(ALL_KEYS.some(k => k.includes('major'))).toBe(true);
            expect(ALL_KEYS.some(k => k.includes('minor'))).toBe(true);
        });

        test('MAJOR_KEYS_CIRCLE has 12 keys', () => {
            expect(MAJOR_KEYS_CIRCLE).toHaveLength(12);
        });

        test('MAJOR_KEYS_CIRCLE starts with C', () => {
            expect(MAJOR_KEYS_CIRCLE[0]).toBe('C:major');
        });
    });

    // =========================================================================
    // applyKeySignature()
    // =========================================================================
    describe('applyKeySignature()', () => {
        const gMajor: KeyContext = createKey(KEY_ROOT.G, 'major');
        const fMajor: KeyContext = createKey(KEY_ROOT.F, 'major');
        const cMajor: KeyContext = createKey(KEY_ROOT.C, 'major');
        const dMajor: KeyContext = createKey(KEY_ROOT.D, 'major');

        test('applies sharp in G major (F → F#)', () => {
            expect(applyKeySignature('F4', gMajor)).toBe('F#4');
        });

        test('applies flat in F major (B → Bb)', () => {
            expect(applyKeySignature('B4', fMajor)).toBe('Bb4');
        });

        test('preserves existing accidental', () => {
            expect(applyKeySignature('F#4', cMajor)).toBe('F#4');
            expect(applyKeySignature('Bb4', cMajor)).toBe('Bb4');
        });

        test('returns as-is with no key context', () => {
            expect(applyKeySignature('F4', null)).toBe('F4');
            expect(applyKeySignature('B4', null)).toBe('B4');
        });

        test('override to natural strips accidental', () => {
            expect(applyKeySignature('F4', gMajor, 'natural')).toBe('F4');
            expect(applyKeySignature('F#4', cMajor, 'natural')).toBe('F4');
        });

        test('override to sharp applies sharp', () => {
            expect(applyKeySignature('C4', cMajor, 'sharp')).toBe('C#4');
            expect(applyKeySignature('G4', fMajor, 'sharp')).toBe('G#4');
        });

        test('override to flat applies flat', () => {
            expect(applyKeySignature('E4', cMajor, 'flat')).toBe('Eb4');
            expect(applyKeySignature('A4', gMajor, 'flat')).toBe('Ab4');
        });

        test('applies multiple sharps in D major (F# and C#)', () => {
            expect(applyKeySignature('F4', dMajor)).toBe('F#4');
            expect(applyKeySignature('C4', dMajor)).toBe('C#4');
            expect(applyKeySignature('G4', dMajor)).toBe('G4'); // not sharped
        });

        test('returns null for invalid input', () => {
            expect(applyKeySignature('', gMajor)).toBeNull();
            expect(applyKeySignature('invalid', gMajor)).toBeNull();
            expect(applyKeySignature('X4', gMajor)).toBeNull();
        });

        test('handles different octaves', () => {
            expect(applyKeySignature('F2', gMajor)).toBe('F#2');
            expect(applyKeySignature('F6', gMajor)).toBe('F#6');
            expect(applyKeySignature('B-1', fMajor)).toBe('Bb-1');
        });

        test('handles lowercase note names', () => {
            expect(applyKeySignature('f4', gMajor)).toBe('F#4');
            expect(applyKeySignature('b4', fMajor)).toBe('Bb4');
        });
    });
});
