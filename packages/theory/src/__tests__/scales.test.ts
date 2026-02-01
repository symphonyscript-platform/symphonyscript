/**
 * Tests for 24-EDO Scale Definitions
 * RFC-047: Bitwise Music Theory System
 */

import {
    SCALE,
    isInScale,
    quantizeToScale,
    getScaleIntervals,
    getScaleSize,
} from '../scales/scales';
import { INTERVAL } from '../constants';
import { countBits } from '../packer';

describe('24-EDO Scale Definitions', () => {
    // =========================================================================
    // Scale Cardinality
    // =========================================================================
    describe('Scale Cardinality', () => {
        test('SCALE.MAJOR has 7 notes', () => {
            expect(countBits(SCALE.MAJOR)).toBe(7);
            expect(getScaleSize(SCALE.MAJOR)).toBe(7);
        });

        test('SCALE.MINOR has 7 notes', () => {
            expect(countBits(SCALE.MINOR)).toBe(7);
        });

        test('SCALE.PENTATONIC_MAJOR has 5 notes', () => {
            expect(countBits(SCALE.PENTATONIC_MAJOR)).toBe(5);
        });

        test('SCALE.PENTATONIC_MINOR has 5 notes', () => {
            expect(countBits(SCALE.PENTATONIC_MINOR)).toBe(5);
        });

        test('SCALE.BLUES has 6 notes', () => {
            expect(countBits(SCALE.BLUES)).toBe(6);
        });

        test('SCALE.CHROMATIC has 12 notes', () => {
            expect(countBits(SCALE.CHROMATIC)).toBe(12);
        });

        test('SCALE.WHOLE_TONE has 6 notes', () => {
            expect(countBits(SCALE.WHOLE_TONE)).toBe(6);
        });

        test('SCALE.DIMINISHED_HW has 8 notes', () => {
            expect(countBits(SCALE.DIMINISHED_HW)).toBe(8);
        });

        test('SCALE.DIMINISHED_WH has 8 notes', () => {
            expect(countBits(SCALE.DIMINISHED_WH)).toBe(8);
        });

        test('SCALE.BEBOP_DOMINANT has 8 notes', () => {
            expect(countBits(SCALE.BEBOP_DOMINANT)).toBe(8);
        });
    });

    // =========================================================================
    // Diatonic Modes
    // =========================================================================
    describe('Diatonic Modes', () => {
        test('SCALE.MAJOR contains all diatonic intervals', () => {
            const intervals = getScaleIntervals(SCALE.MAJOR).map(Number);
            expect(intervals).toContain(INTERVAL.UNISON);
            expect(intervals).toContain(INTERVAL.MAJOR_SECOND);
            expect(intervals).toContain(INTERVAL.MAJOR_THIRD);
            expect(intervals).toContain(INTERVAL.PERFECT_FOURTH);
            expect(intervals).toContain(INTERVAL.PERFECT_FIFTH);
            expect(intervals).toContain(INTERVAL.MAJOR_SIXTH);
            expect(intervals).toContain(INTERVAL.MAJOR_SEVENTH);
        });

        test('SCALE.MINOR contains minor third, sixth, seventh', () => {
            const intervals = getScaleIntervals(SCALE.MINOR).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_THIRD);
            expect(intervals).toContain(INTERVAL.MINOR_SIXTH);
            expect(intervals).toContain(INTERVAL.MINOR_SEVENTH);
        });

        test('SCALE.DORIAN has minor third but major sixth', () => {
            const intervals = getScaleIntervals(SCALE.DORIAN).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_THIRD);
            expect(intervals).toContain(INTERVAL.MAJOR_SIXTH);
        });

        test('SCALE.LYDIAN has raised fourth (tritone)', () => {
            const intervals = getScaleIntervals(SCALE.LYDIAN).map(Number);
            expect(intervals).toContain(INTERVAL.TRITONE);
            expect(intervals).not.toContain(INTERVAL.PERFECT_FOURTH);
        });

        test('SCALE.MIXOLYDIAN has minor seventh', () => {
            const intervals = getScaleIntervals(SCALE.MIXOLYDIAN).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_SEVENTH);
            expect(intervals).not.toContain(INTERVAL.MAJOR_SEVENTH);
        });

        test('SCALE.LOCRIAN has flat second and flat fifth', () => {
            const intervals = getScaleIntervals(SCALE.LOCRIAN).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_SECOND);
            expect(intervals).toContain(INTERVAL.TRITONE);
        });
    });

    // =========================================================================
    // Harmonic & Melodic Minor
    // =========================================================================
    describe('Harmonic & Melodic Minor', () => {
        test('SCALE.HARMONIC_MINOR has minor third and major seventh', () => {
            const intervals = getScaleIntervals(SCALE.HARMONIC_MINOR).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_THIRD);
            expect(intervals).toContain(INTERVAL.MAJOR_SEVENTH);
            expect(intervals).toContain(INTERVAL.MINOR_SIXTH);
        });

        test('SCALE.MELODIC_MINOR has minor third, major sixth, major seventh', () => {
            const intervals = getScaleIntervals(SCALE.MELODIC_MINOR).map(Number);
            expect(intervals).toContain(INTERVAL.MINOR_THIRD);
            expect(intervals).toContain(INTERVAL.MAJOR_SIXTH);
            expect(intervals).toContain(INTERVAL.MAJOR_SEVENTH);
        });
    });

    // =========================================================================
    // Pentatonic & Blues
    // =========================================================================
    describe('Pentatonic & Blues', () => {
        test('SCALE.PENTATONIC_MAJOR has no fourth or seventh', () => {
            const intervals = getScaleIntervals(SCALE.PENTATONIC_MAJOR).map(Number);
            expect(intervals).not.toContain(INTERVAL.PERFECT_FOURTH);
            expect(intervals).not.toContain(INTERVAL.MAJOR_SEVENTH);
            expect(intervals).not.toContain(INTERVAL.MINOR_SEVENTH);
        });

        test('SCALE.BLUES contains tritone (blue note)', () => {
            const intervals = getScaleIntervals(SCALE.BLUES).map(Number);
            expect(intervals).toContain(INTERVAL.TRITONE);
        });
    });

    // =========================================================================
    // Symmetric Scales
    // =========================================================================
    describe('Symmetric Scales', () => {
        test('SCALE.WHOLE_TONE has only whole steps', () => {
            const intervals = getScaleIntervals(SCALE.WHOLE_TONE).map(Number);
            // All intervals should be even (0, 4, 8, 12, 16, 20)
            expect(intervals.every(i => i % 4 === 0)).toBe(true);
        });

        test('SCALE.CHROMATIC contains all 12 semitones', () => {
            const intervals = getScaleIntervals(SCALE.CHROMATIC).map(Number);
            // All even intervals from 0 to 22
            for (let i = 0; i < 24; i += 2) {
                expect(intervals).toContain(i);
            }
        });
    });
});

describe('isInScale', () => {
    // =========================================================================
    // Major Scale Membership
    // =========================================================================
    describe('Major Scale Membership', () => {
        test('major third is in major scale', () => {
            expect(isInScale(SCALE.MAJOR, INTERVAL.MAJOR_THIRD)).toBe(true);
        });

        test('minor third is NOT in major scale', () => {
            expect(isInScale(SCALE.MAJOR, INTERVAL.MINOR_THIRD)).toBe(false);
        });

        test('tritone is NOT in major scale', () => {
            expect(isInScale(SCALE.MAJOR, INTERVAL.TRITONE)).toBe(false);
        });

        test('perfect fifth is in major scale', () => {
            expect(isInScale(SCALE.MAJOR, INTERVAL.PERFECT_FIFTH)).toBe(true);
        });

        test('unison is in major scale', () => {
            expect(isInScale(SCALE.MAJOR, INTERVAL.UNISON)).toBe(true);
        });
    });

    // =========================================================================
    // Blues Scale Membership
    // =========================================================================
    describe('Blues Scale Membership', () => {
        test('tritone IS in blues scale', () => {
            expect(isInScale(SCALE.BLUES, INTERVAL.TRITONE)).toBe(true);
        });

        test('major third is NOT in blues scale', () => {
            expect(isInScale(SCALE.BLUES, INTERVAL.MAJOR_THIRD)).toBe(false);
        });

        test('minor third IS in blues scale', () => {
            expect(isInScale(SCALE.BLUES, INTERVAL.MINOR_THIRD)).toBe(true);
        });
    });

    // =========================================================================
    // Quarter Tone Handling
    // =========================================================================
    describe('Quarter Tone Handling', () => {
        test('quarter tones are NOT in standard scales', () => {
            expect(isInScale(SCALE.MAJOR, INTERVAL.QUARTER_SHARP)).toBe(false);
            expect(isInScale(SCALE.MAJOR, INTERVAL.MAJOR_THIRD_QS)).toBe(false);
        });
    });

    // =========================================================================
    // Negative Interval Handling
    // =========================================================================
    describe('Negative Interval Handling', () => {
        test('negative intervals wrap correctly', () => {
            // -2 should wrap to 22 (major seventh)
            expect(isInScale(SCALE.MAJOR, -2)).toBe(true);
            // -4 should wrap to 20 (minor seventh)
            expect(isInScale(SCALE.MAJOR, -4)).toBe(false);
        });
    });

    // =========================================================================
    // Octave Wrapping
    // =========================================================================
    describe('Octave Wrapping', () => {
        test('intervals > 23 wrap correctly', () => {
            // 24 + 8 = 32, should wrap to 8 (major third)
            expect(isInScale(SCALE.MAJOR, 32)).toBe(true);
            // 24 + 6 = 30, should wrap to 6 (minor third)
            expect(isInScale(SCALE.MAJOR, 30)).toBe(false);
        });
    });
});

describe('quantizeToScale', () => {
    // =========================================================================
    // In-Scale Notes
    // =========================================================================
    describe('In-Scale Notes', () => {
        test('in-scale note returns unchanged', () => {
            expect(quantizeToScale(SCALE.MAJOR, INTERVAL.MAJOR_THIRD)).toBe(INTERVAL.MAJOR_THIRD);
        });

        test('unison returns unchanged', () => {
            expect(quantizeToScale(SCALE.MAJOR, INTERVAL.UNISON)).toBe(INTERVAL.UNISON);
        });
    });

    // =========================================================================
    // Out-of-Scale Notes
    // =========================================================================
    describe('Out-of-Scale Notes', () => {
        test('minor third quantizes to major second or major third', () => {
            const result = quantizeToScale(SCALE.MAJOR, INTERVAL.MINOR_THIRD);
            // m3 (6) should snap to M2 (4) or M3 (8)
            // Prefers lower, so should be M2 (4)
            expect(result).toBe(INTERVAL.MAJOR_SECOND);
        });

        test('tritone quantizes to perfect fourth or perfect fifth', () => {
            const result = quantizeToScale(SCALE.MAJOR, INTERVAL.TRITONE);
            // TT (12) should snap to P4 (10) or P5 (14)
            // Prefers lower, so should be P4 (10)
            expect(result).toBe(INTERVAL.PERFECT_FOURTH);
        });
    });

    // =========================================================================
    // Quarter Tone Quantization
    // =========================================================================
    describe('Quarter Tone Quantization', () => {
        test('quarter sharp quantizes to unison', () => {
            const result = quantizeToScale(SCALE.MAJOR, INTERVAL.QUARTER_SHARP);
            // C+ (1) should snap to C (0)
            expect(result).toBe(INTERVAL.UNISON);
        });

        test('major third quarter sharp quantizes to major third', () => {
            const result = quantizeToScale(SCALE.MAJOR, INTERVAL.MAJOR_THIRD_QS);
            // M3+ (9) should snap to M3 (8) - prefers lower
            expect(result).toBe(INTERVAL.MAJOR_THIRD);
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================
    describe('Edge Cases', () => {
        test('negative intervals quantize correctly', () => {
            // -1 wraps to 23, should quantize to 22 (M7)
            const result = quantizeToScale(SCALE.MAJOR, -1);
            expect(result).toBe(INTERVAL.MAJOR_SEVENTH);
        });
    });
});

describe('getScaleIntervals', () => {
    test('returns array of intervals', () => {
        const intervals = getScaleIntervals(SCALE.MAJOR);
        expect(Array.isArray(intervals)).toBe(true);
        expect(intervals.length).toBe(7);
    });

    test('intervals are sorted ascending', () => {
        const intervals = getScaleIntervals(SCALE.MAJOR).map(Number);
        for (let i = 1; i < intervals.length; i++) {
            expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
        }
    });
});

describe('Scale Uniqueness', () => {
    test('MAJOR and MINOR have different masks', () => {
        expect(SCALE.MAJOR).not.toBe(SCALE.MINOR);
    });

    test('HARMONIC_MINOR and MELODIC_MINOR have different masks', () => {
        expect(SCALE.HARMONIC_MINOR).not.toBe(SCALE.MELODIC_MINOR);
    });

    test('PENTATONIC_MAJOR and PENTATONIC_MINOR have different masks', () => {
        expect(SCALE.PENTATONIC_MAJOR).not.toBe(SCALE.PENTATONIC_MINOR);
    });
});
