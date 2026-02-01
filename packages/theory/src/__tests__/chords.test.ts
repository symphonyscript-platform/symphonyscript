/**
 * Tests for 24-EDO Chord Definitions
 * RFC-047: Bitwise Music Theory System
 */

import { CHORD, CHORD_MAP, getChordMask } from '../chords/definitions';
import { unpackToArray, countBits } from '../packer';
import { INTERVAL } from '../constants';

describe('24-EDO Chord Definitions', () => {
    // =========================================================================
    // Major Family
    // =========================================================================
    describe('Major Chords', () => {
        test('CHORD.MAJ contains correct intervals (1-3-5)', () => {
            const intervals = unpackToArray(CHORD.MAJ).map(Number);
            expect(intervals).toEqual([
                INTERVAL.UNISON,        // 0
                INTERVAL.MAJOR_THIRD,   // 8
                INTERVAL.PERFECT_FIFTH, // 14
            ]);
        });

        test('CHORD.MAJ has 3 notes', () => {
            expect(countBits(CHORD.MAJ)).toBe(3);
        });

        test('CHORD.MAJ7 contains major seventh', () => {
            const intervals = unpackToArray(CHORD.MAJ7).map(Number);
            expect(intervals).toContain(INTERVAL.MAJOR_SEVENTH);
            expect(intervals).not.toContain(INTERVAL.MINOR_SEVENTH);
        });

        test('CHORD.MAJ7 has 4 notes', () => {
            expect(countBits(CHORD.MAJ7)).toBe(4);
        });

        test('CHORD.MAJ9 has 5 notes (1-3-5-7-9)', () => {
            expect(countBits(CHORD.MAJ9)).toBe(5);
            const intervals = unpackToArray(CHORD.MAJ9).map(Number);
            expect(intervals).toContain(INTERVAL.MAJOR_SECOND); // 9th = 2nd
        });
    });

    // =========================================================================
    // Minor Family
    // =========================================================================
    describe('Minor Chords', () => {
        test('CHORD.MIN contains minor third, not major third', () => {
            const intervals = unpackToArray(CHORD.MIN).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_THIRD);
            expect(intervals).not.toContain(INTERVAL.MAJOR_THIRD);
        });

        test('CHORD.MIN has 3 notes', () => {
            expect(countBits(CHORD.MIN)).toBe(3);
        });

        test('CHORD.MIN7 contains minor seventh', () => {
            const intervals = unpackToArray(CHORD.MIN7).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_SEVENTH);
            expect(intervals).not.toContain(INTERVAL.MAJOR_SEVENTH);
        });

        test('CHORD.MIN_MAJ7 contains minor third AND major seventh', () => {
            const intervals = unpackToArray(CHORD.MIN_MAJ7).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_THIRD);
            expect(intervals).toContain(INTERVAL.MAJOR_SEVENTH);
        });
    });

    // =========================================================================
    // Dominant Family
    // =========================================================================
    describe('Dominant Chords', () => {
        test('CHORD.DOM7 contains major third and minor seventh', () => {
            const intervals = unpackToArray(CHORD.DOM7).map(Number);
            expect(intervals).toContain(INTERVAL.MAJOR_THIRD);
            expect(intervals).toContain(INTERVAL.MINOR_SEVENTH);
            expect(intervals).not.toContain(INTERVAL.MAJOR_SEVENTH);
        });

        test('CHORD.DOM7 has 4 notes', () => {
            expect(countBits(CHORD.DOM7)).toBe(4);
        });

        test('CHORD.DOM9 has 5 notes', () => {
            expect(countBits(CHORD.DOM9)).toBe(5);
        });

        test('CHORD.DOM7_SUS4 has perfect fourth instead of third', () => {
            const intervals = unpackToArray(CHORD.DOM7_SUS4).map(Number);
            expect(intervals).toContain(INTERVAL.PERFECT_FOURTH);
            expect(intervals).not.toContain(INTERVAL.MAJOR_THIRD);
            expect(intervals).not.toContain(INTERVAL.MINOR_THIRD);
        });
    });

    // =========================================================================
    // Suspended Chords
    // =========================================================================
    describe('Suspended Chords', () => {
        test('CHORD.SUS4 contains 1-4-5', () => {
            const intervals = unpackToArray(CHORD.SUS4).map(Number);
            expect(intervals).toEqual([
                INTERVAL.UNISON,
                INTERVAL.PERFECT_FOURTH,
                INTERVAL.PERFECT_FIFTH,
            ]);
        });

        test('CHORD.SUS2 contains 1-2-5', () => {
            const intervals = unpackToArray(CHORD.SUS2).map(Number);
            expect(intervals).toEqual([
                INTERVAL.UNISON,
                INTERVAL.MAJOR_SECOND,
                INTERVAL.PERFECT_FIFTH,
            ]);
        });
    });

    // =========================================================================
    // Power Chord
    // =========================================================================
    describe('Power Chord', () => {
        test('CHORD.POWER contains only 1-5', () => {
            const intervals = unpackToArray(CHORD.POWER).map(Number);
            expect(intervals).toEqual([
                INTERVAL.UNISON,
                INTERVAL.PERFECT_FIFTH,
            ]);
        });

        test('CHORD.POWER has 2 notes', () => {
            expect(countBits(CHORD.POWER)).toBe(2);
        });
    });

    // =========================================================================
    // Diminished Family
    // =========================================================================
    describe('Diminished Chords', () => {
        test('CHORD.DIM contains 1-b3-b5', () => {
            const intervals = unpackToArray(CHORD.DIM).map(Number);
            expect(intervals).toEqual([
                INTERVAL.UNISON,
                INTERVAL.MINOR_THIRD,
                INTERVAL.TRITONE,
            ]);
        });

        test('CHORD.DIM7 contains bb7 (enharmonic to M6)', () => {
            const intervals = unpackToArray(CHORD.DIM7).map(Number);
            expect(intervals).toContain(INTERVAL.MAJOR_SIXTH); // bb7 = M6
        });

        test('CHORD.HALF_DIM contains b7 (not bb7)', () => {
            const intervals = unpackToArray(CHORD.HALF_DIM).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_SEVENTH);
            expect(intervals).not.toContain(INTERVAL.MAJOR_SIXTH);
        });
    });

    // =========================================================================
    // Augmented Family
    // =========================================================================
    describe('Augmented Chords', () => {
        test('CHORD.AUG contains 1-3-#5', () => {
            const intervals = unpackToArray(CHORD.AUG).map(Number);
            expect(intervals).toEqual([
                INTERVAL.UNISON,
                INTERVAL.MAJOR_THIRD,
                INTERVAL.MINOR_SIXTH, // #5 = m6 enharmonic
            ]);
        });

        test('CHORD.AUG7 contains minor seventh', () => {
            const intervals = unpackToArray(CHORD.AUG7).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_SEVENTH);
        });

        test('CHORD.AUG_MAJ7 contains major seventh', () => {
            const intervals = unpackToArray(CHORD.AUG_MAJ7).map(Number);
            expect(intervals).toContain(INTERVAL.MAJOR_SEVENTH);
        });
    });

    // =========================================================================
    // Altered Dominants
    // =========================================================================
    describe('Altered Dominants', () => {
        test('CHORD.DOM7_B9 contains b9 (minor second)', () => {
            const intervals = unpackToArray(CHORD.DOM7_B9).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_SECOND);
        });

        test('CHORD.DOM7_SHARP9 contains #9 (minor third)', () => {
            const intervals = unpackToArray(CHORD.DOM7_SHARP9).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_THIRD);
        });

        test('CHORD.DOM7_B5 contains b5 (tritone)', () => {
            const intervals = unpackToArray(CHORD.DOM7_B5).map(Number);
            expect(intervals).toContain(INTERVAL.TRITONE);
            expect(intervals).not.toContain(INTERVAL.PERFECT_FIFTH);
        });
    });
});

describe('CHORD_MAP Lookup', () => {
    // =========================================================================
    // Primary Symbols
    // =========================================================================
    describe('Primary Symbols', () => {
        test('empty string maps to MAJ', () => {
            expect(CHORD_MAP.get('')).toBe(CHORD.MAJ);
        });

        test('m maps to MIN', () => {
            expect(CHORD_MAP.get('m')).toBe(CHORD.MIN);
        });

        test('7 maps to DOM7', () => {
            expect(CHORD_MAP.get('7')).toBe(CHORD.DOM7);
        });

        test('dim maps to DIM', () => {
            expect(CHORD_MAP.get('dim')).toBe(CHORD.DIM);
        });

        test('aug maps to AUG', () => {
            expect(CHORD_MAP.get('aug')).toBe(CHORD.AUG);
        });
    });

    // =========================================================================
    // Alternate Symbols
    // =========================================================================
    describe('Alternate Symbols', () => {
        test('- maps to MIN', () => {
            expect(CHORD_MAP.get('-')).toBe(CHORD.MIN);
        });

        test('° maps to DIM', () => {
            expect(CHORD_MAP.get('°')).toBe(CHORD.DIM);
        });

        test('+ maps to AUG', () => {
            expect(CHORD_MAP.get('+')).toBe(CHORD.AUG);
        });

        test('Δ7 maps to MAJ7', () => {
            expect(CHORD_MAP.get('Δ7')).toBe(CHORD.MAJ7);
        });

        test('ø maps to HALF_DIM', () => {
            expect(CHORD_MAP.get('ø')).toBe(CHORD.HALF_DIM);
        });

        test('m7b5 maps to HALF_DIM', () => {
            expect(CHORD_MAP.get('m7b5')).toBe(CHORD.HALF_DIM);
        });
    });

    // =========================================================================
    // Extended Chords
    // =========================================================================
    describe('Extended Chords', () => {
        test('maj9 maps to MAJ9', () => {
            expect(CHORD_MAP.get('maj9')).toBe(CHORD.MAJ9);
        });

        test('m9 maps to MIN9', () => {
            expect(CHORD_MAP.get('m9')).toBe(CHORD.MIN9);
        });

        test('9 maps to DOM9', () => {
            expect(CHORD_MAP.get('9')).toBe(CHORD.DOM9);
        });

        test('13 maps to DOM13', () => {
            expect(CHORD_MAP.get('13')).toBe(CHORD.DOM13);
        });
    });

    // =========================================================================
    // getChordMask Utility
    // =========================================================================
    describe('getChordMask', () => {
        test('returns mask for valid symbol', () => {
            expect(getChordMask('m7')).toBe(CHORD.MIN7);
        });

        test('returns undefined for invalid symbol', () => {
            expect(getChordMask('invalid')).toBeUndefined();
        });
    });
});

describe('Chord Mask Uniqueness', () => {
    test('MAJ and MIN have different masks', () => {
        expect(CHORD.MAJ).not.toBe(CHORD.MIN);
    });

    test('DOM7 and MAJ7 have different masks', () => {
        expect(CHORD.DOM7).not.toBe(CHORD.MAJ7);
    });

    test('DIM and HALF_DIM have different masks', () => {
        expect(CHORD.DIM).not.toBe(CHORD.HALF_DIM);
    });
});
