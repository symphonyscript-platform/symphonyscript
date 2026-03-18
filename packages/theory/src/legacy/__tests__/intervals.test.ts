/**
 * Tests for interval theory functions.
 * RFC-047: Zero-allocation interval utilities.
 */

import { getIntervalQuality, invertInterval, isEnharmonic } from '../pitch/intervals';

describe('Interval Theory Functions', () => {
    describe('getIntervalQuality', () => {
        describe('Perfect intervals (1, 4, 5, 8)', () => {
            it('returns P for perfect unison (0 semitones, generic 1)', () => {
                expect(getIntervalQuality(0, 1)).toBe('P');
            });

            it('returns P for perfect fourth (5 semitones, generic 4)', () => {
                expect(getIntervalQuality(5, 4)).toBe('P');
            });

            it('returns P for perfect fifth (7 semitones, generic 5)', () => {
                expect(getIntervalQuality(7, 5)).toBe('P');
            });

            it('returns P for perfect octave (12 semitones, generic 8)', () => {
                expect(getIntervalQuality(12, 8)).toBe('P');
            });

            it('returns A for augmented fourth (6 semitones, generic 4)', () => {
                expect(getIntervalQuality(6, 4)).toBe('A');
            });

            it('returns d for diminished fifth (6 semitones, generic 5)', () => {
                expect(getIntervalQuality(6, 5)).toBe('d');
            });

            it('returns A for augmented unison (1 semitone, generic 1)', () => {
                expect(getIntervalQuality(1, 1)).toBe('A');
            });

            it('returns A for augmented fifth (8 semitones, generic 5)', () => {
                expect(getIntervalQuality(8, 5)).toBe('A');
            });

            it('returns d for diminished fourth (4 semitones, generic 4)', () => {
                expect(getIntervalQuality(4, 4)).toBe('d');
            });
        });

        describe('Major/minor intervals (2, 3, 6, 7)', () => {
            it('returns M for major second (2 semitones, generic 2)', () => {
                expect(getIntervalQuality(2, 2)).toBe('M');
            });

            it('returns m for minor second (1 semitone, generic 2)', () => {
                expect(getIntervalQuality(1, 2)).toBe('m');
            });

            it('returns M for major third (4 semitones, generic 3)', () => {
                expect(getIntervalQuality(4, 3)).toBe('M');
            });

            it('returns m for minor third (3 semitones, generic 3)', () => {
                expect(getIntervalQuality(3, 3)).toBe('m');
            });

            it('returns M for major sixth (9 semitones, generic 6)', () => {
                expect(getIntervalQuality(9, 6)).toBe('M');
            });

            it('returns m for minor sixth (8 semitones, generic 6)', () => {
                expect(getIntervalQuality(8, 6)).toBe('m');
            });

            it('returns M for major seventh (11 semitones, generic 7)', () => {
                expect(getIntervalQuality(11, 7)).toBe('M');
            });

            it('returns m for minor seventh (10 semitones, generic 7)', () => {
                expect(getIntervalQuality(10, 7)).toBe('m');
            });

            it('returns A for augmented second (3 semitones, generic 2)', () => {
                expect(getIntervalQuality(3, 2)).toBe('A');
            });

            it('returns d for diminished third (2 semitones, generic 3)', () => {
                expect(getIntervalQuality(2, 3)).toBe('d');
            });

            it('returns d for diminished seventh (9 semitones, generic 7)', () => {
                expect(getIntervalQuality(9, 7)).toBe('d');
            });
        });

        describe('Edge cases', () => {
            it('handles negative semitones', () => {
                // -5 mod 12 = 7, for generic 4th (P4 = 5 semitones), 7 is augmented
                expect(getIntervalQuality(-5, 4)).toBe('A');
                // -7 mod 12 = 5, for generic 4th (P4 = 5 semitones), this is perfect
                expect(getIntervalQuality(-7, 4)).toBe('P');
            });

            it('handles semitones > 12', () => {
                expect(getIntervalQuality(19, 5)).toBe('P'); // 19 mod 12 = 7
            });
        });
    });

    describe('invertInterval', () => {
        it('inverts unison to unison (0 -> 0)', () => {
            expect(invertInterval(0)).toBe(0);
        });

        it('inverts minor second to major seventh (1 -> 11)', () => {
            expect(invertInterval(1)).toBe(11);
        });

        it('inverts major second to minor seventh (2 -> 10)', () => {
            expect(invertInterval(2)).toBe(10);
        });

        it('inverts minor third to major sixth (3 -> 9)', () => {
            expect(invertInterval(3)).toBe(9);
        });

        it('inverts major third to minor sixth (4 -> 8)', () => {
            expect(invertInterval(4)).toBe(8);
        });

        it('inverts perfect fourth to perfect fifth (5 -> 7)', () => {
            expect(invertInterval(5)).toBe(7);
        });

        it('inverts tritone to tritone (6 -> 6)', () => {
            expect(invertInterval(6)).toBe(6);
        });

        it('inverts perfect fifth to perfect fourth (7 -> 5)', () => {
            expect(invertInterval(7)).toBe(5);
        });

        it('inverts minor sixth to major third (8 -> 4)', () => {
            expect(invertInterval(8)).toBe(4);
        });

        it('inverts major sixth to minor third (9 -> 3)', () => {
            expect(invertInterval(9)).toBe(3);
        });

        it('inverts minor seventh to major second (10 -> 2)', () => {
            expect(invertInterval(10)).toBe(2);
        });

        it('inverts major seventh to minor second (11 -> 1)', () => {
            expect(invertInterval(11)).toBe(1);
        });

        it('inverts octave to unison (12 -> 0)', () => {
            expect(invertInterval(12)).toBe(0);
        });

        it('handles negative semitones', () => {
            expect(invertInterval(-5)).toBe(5); // -5 mod 12 = 7, 12 - 7 = 5
        });

        it('handles semitones > 12', () => {
            expect(invertInterval(19)).toBe(5); // 19 mod 12 = 7, 12 - 7 = 5
        });
    });

    describe('isEnharmonic', () => {
        it('returns true for same pitch', () => {
            expect(isEnharmonic(60, 60)).toBe(true);
        });

        it('returns true for octave equivalents', () => {
            expect(isEnharmonic(60, 72)).toBe(true); // C4 and C5
            expect(isEnharmonic(60, 48)).toBe(true); // C4 and C3
        });

        it('returns true for C# and Db (both pitch class 1)', () => {
            expect(isEnharmonic(61, 61)).toBe(true);
        });

        it('returns true for enharmonic equivalents across octaves', () => {
            expect(isEnharmonic(61, 73)).toBe(true); // C#4 and C#5
        });

        it('returns false for different pitch classes', () => {
            expect(isEnharmonic(60, 61)).toBe(false); // C and C#
            expect(isEnharmonic(60, 62)).toBe(false); // C and D
        });

        it('returns false for semitone apart', () => {
            expect(isEnharmonic(64, 65)).toBe(false); // E and F
        });

        it('handles negative pitches', () => {
            expect(isEnharmonic(-12, 0)).toBe(true); // Both pitch class 0
            expect(isEnharmonic(-11, 1)).toBe(true); // Both pitch class 1
        });

        it('handles large pitch values', () => {
            expect(isEnharmonic(120, 0)).toBe(true); // 120 mod 12 = 0
            expect(isEnharmonic(127, 7)).toBe(true); // 127 mod 12 = 7
        });
    });

    describe('Zero-allocation verification', () => {
        it('getIntervalQuality performs no allocations in hot loop', () => {
            // Warm up
            for (let i = 0; i < 100; i++) {
                getIntervalQuality(i % 12, (i % 7) + 1);
            }

            const before = process.memoryUsage().heapUsed;

            // Hot loop - should not allocate
            for (let i = 0; i < 10000; i++) {
                getIntervalQuality(i % 12, (i % 7) + 1);
            }

            const after = process.memoryUsage().heapUsed;
            const delta = after - before;

            // Allow small variance for GC/runtime overhead
            // Zero-alloc functions should have minimal heap growth
            expect(delta).toBeLessThan(100000);
        });

        it('invertInterval performs no allocations in hot loop', () => {
            // Warm up
            for (let i = 0; i < 100; i++) {
                invertInterval(i);
            }

            const before = process.memoryUsage().heapUsed;

            // Hot loop - should not allocate
            for (let i = 0; i < 10000; i++) {
                invertInterval(i);
            }

            const after = process.memoryUsage().heapUsed;
            const delta = after - before;

            expect(delta).toBeLessThan(100000);
        });

        it('isEnharmonic performs no allocations in hot loop', () => {
            // Warm up
            for (let i = 0; i < 100; i++) {
                isEnharmonic(i, i + 12);
            }

            const before = process.memoryUsage().heapUsed;

            // Hot loop - should not allocate
            for (let i = 0; i < 10000; i++) {
                isEnharmonic(i, i + 12);
            }

            const after = process.memoryUsage().heapUsed;
            const delta = after - before;

            expect(delta).toBeLessThan(100000);
        });
    });
});
