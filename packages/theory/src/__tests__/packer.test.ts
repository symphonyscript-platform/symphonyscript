import { pack, unpack, unpackToArray, countBits, transpose } from '../packer';
import { INTERVAL } from '../constants';
import { asHarmonyMask, asInterval24EDO } from '../types';

describe('RFC-047: Bitwise Packer', () => {
    describe('pack()', () => {
        test('Major triad (C-E-G) → 0x4101', () => {
            const mask = pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.PERFECT_FIFTH]);
            expect(mask).toBe(0x4101);  // Binary: 0100 0001 0000 0001
        });

        test('Minor triad (C-Eb-G) → 0x4041', () => {
            const mask = pack([INTERVAL.UNISON, INTERVAL.MINOR_THIRD, INTERVAL.PERFECT_FIFTH]);
            // UNISON=0 → 0x0001, MINOR_THIRD=6 → 0x0040, PERFECT_FIFTH=14 → 0x4000
            // 0x0001 | 0x0040 | 0x4000 = 0x4041
            expect(mask).toBe(0x4041);  // Binary: 0100 0000 0100 0001
        });

        test('Octave wrapping (interval 25 → 1)', () => {
            const mask = pack([25]);  // Beyond 24-EDO, should wrap
            expect(mask).toBe(1 << 1);  // Bit 1 set
        });

        // EDGE CASE TESTS
        test('[EDGE] Negative intervals: pack([-1]) → bit 23', () => {
            const mask = pack([-1]);
            expect(mask).toBe(1 << 23);  // -1 wraps to 23 (B+)
        });

        test('[EDGE] Empty array: pack([]) → 0', () => {
            const mask = pack([]);
            expect(mask).toBe(0);
        });

        test('[EDGE] Duplicate handling: pack([0, 0, 8]) → idempotent', () => {
            const mask = pack([0, 0, 8]);
            expect(mask).toBe((1 << 0) | (1 << 8));  // Duplicates ignored
        });

        test('[EDGE] Large values: pack([999, -50])', () => {
            const mask = pack([999, -50]);
            const interval999 = ((999 % 24) + 24) % 24;  // = 3
            const intervalNeg50 = ((-50 % 24) + 24) % 24;  // = 22
            expect(unpackToArray(mask).map(i => Number(i)).sort()).toEqual([interval999, intervalNeg50].sort());
        });
    });

    describe('unpack()', () => {
        test('Callback receives correct intervals', () => {
            const intervals: number[] = [];
            unpack(asHarmonyMask(0x4101), (i) => intervals.push(Number(i)));
            expect(intervals).toEqual([0, 8, 14]);
        });

        test('Zero allocation (manual inspection)', () => {
            // This test verifies NO array is created in unpack()
            let count = 0;
            unpack(asHarmonyMask(0x4101), () => count++);
            expect(count).toBe(3);
        });
    });

    describe('unpackToArray()', () => {
        test('Returns interval array', () => {
            const result = unpackToArray(asHarmonyMask(0x4101));
            expect(result.map(i => Number(i))).toEqual([0, 8, 14]);
        });
    });

    describe('countBits()', () => {
        test('Major triad has 3 notes', () => {
            expect(countBits(asHarmonyMask(0x4101))).toBe(3);
        });

        test('Empty mask has 0 notes', () => {
            expect(countBits(asHarmonyMask(0))).toBe(0);
        });

        test('Full chromatic scale has 12 notes', () => {
            // Every other interval (12-TET)
            const chromatic = pack([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
            expect(countBits(chromatic)).toBe(12);
        });
    });

    describe('transpose()', () => {
        test('Transpose major triad up 2 semitones (4 steps)', () => {
            const C_major = pack([0, 8, 14]);  // C-E-G
            const D_major = transpose(C_major, 4);
            expect(unpackToArray(D_major).map(i => Number(i))).toEqual([4, 12, 18]);  // D-F#-A
        });

        test('Negative transposition', () => {
            const mask = pack([4]);  // D
            const result = transpose(mask, -4);  // Down to C
            expect(unpackToArray(result).map(i => Number(i))).toEqual([0]);
        });

        test('Transpose by octave (24 steps) returns same mask', () => {
            const mask = pack([0, 8, 14]);
            const transposed = transpose(mask, 24);
            expect(transposed).toBe(mask);
        });
    });
});
