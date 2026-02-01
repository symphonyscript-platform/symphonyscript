/**
 * Tests for 24-EDO Pitch Utilities
 * RFC-047: Bitwise Music Theory System
 */

import {
    midiToPitchClass24,
    pitchClass24ToMidi,
    intervalToFrequencyRatio,
    frequencyRatioToInterval,
    isQuarterTone,
    roundToSemitone,
    getIntervalName,
    parseIntervalName,
    getPitchClassName,
} from '../pitch/pitch';
import { INTERVAL } from '../constants';
import { asInterval24EDO } from '../types';

describe('MIDI Conversion', () => {
    // =========================================================================
    // midiToPitchClass24
    // =========================================================================
    describe('midiToPitchClass24', () => {
        test('C (MIDI 60) → 0', () => {
            expect(midiToPitchClass24(60)).toBe(0);
        });

        test('C (MIDI 0) → 0', () => {
            expect(midiToPitchClass24(0)).toBe(0);
        });

        test('C# (MIDI 61) → 2', () => {
            expect(midiToPitchClass24(61)).toBe(2);
        });

        test('D (MIDI 62) → 4', () => {
            expect(midiToPitchClass24(62)).toBe(4);
        });

        test('E (MIDI 64) → 8 (MAJOR_THIRD)', () => {
            expect(midiToPitchClass24(64)).toBe(INTERVAL.MAJOR_THIRD);
        });

        test('G (MIDI 67) → 14 (PERFECT_FIFTH)', () => {
            expect(midiToPitchClass24(67)).toBe(INTERVAL.PERFECT_FIFTH);
        });

        test('B (MIDI 71) → 22 (MAJOR_SEVENTH)', () => {
            expect(midiToPitchClass24(71)).toBe(INTERVAL.MAJOR_SEVENTH);
        });

        test('octave wrapping: MIDI 72 (C5) → 0', () => {
            expect(midiToPitchClass24(72)).toBe(0);
        });

        test('high MIDI: 127 → G (14)', () => {
            // 127 % 12 = 7 (G), 7 * 2 = 14
            expect(midiToPitchClass24(127)).toBe(14);
        });
    });

    // =========================================================================
    // pitchClass24ToMidi
    // =========================================================================
    describe('pitchClass24ToMidi', () => {
        test('0 → 0 (C)', () => {
            expect(pitchClass24ToMidi(asInterval24EDO(0))).toBe(0);
        });

        test('8 (M3) → 4 (E)', () => {
            expect(pitchClass24ToMidi(INTERVAL.MAJOR_THIRD)).toBe(4);
        });

        test('14 (P5) → 7 (G)', () => {
            expect(pitchClass24ToMidi(INTERVAL.PERFECT_FIFTH)).toBe(7);
        });

        test('quarter tone rounds down: 1 → 0', () => {
            expect(pitchClass24ToMidi(asInterval24EDO(1))).toBe(0);
        });

        test('quarter tone rounds down: 9 (M3+) → 4', () => {
            expect(pitchClass24ToMidi(INTERVAL.MAJOR_THIRD_QS)).toBe(4);
        });
    });

    // =========================================================================
    // Round Trip
    // =========================================================================
    describe('Round Trip', () => {
        test('MIDI → 24-EDO → MIDI preserves pitch class', () => {
            for (let midi = 0; midi < 12; midi++) {
                const edo = midiToPitchClass24(midi);
                const back = pitchClass24ToMidi(edo);
                expect(back).toBe(midi);
            }
        });
    });
});

describe('Frequency Conversion', () => {
    // =========================================================================
    // intervalToFrequencyRatio
    // =========================================================================
    describe('intervalToFrequencyRatio', () => {
        test('unison → 1.0', () => {
            const ratio = intervalToFrequencyRatio(INTERVAL.UNISON);
            expect(ratio).toBeCloseTo(1.0, 5);
        });

        test('octave (24 steps) → 2.0', () => {
            const ratio = intervalToFrequencyRatio(asInterval24EDO(24));
            expect(ratio).toBeCloseTo(2.0, 5);
        });

        test('perfect fifth (14) → ~1.498', () => {
            const ratio = intervalToFrequencyRatio(INTERVAL.PERFECT_FIFTH);
            // 2^(14/24) ≈ 1.498
            expect(ratio).toBeCloseTo(1.498, 2);
        });

        test('tritone (12) → √2 ≈ 1.414', () => {
            const ratio = intervalToFrequencyRatio(INTERVAL.TRITONE);
            expect(ratio).toBeCloseTo(Math.SQRT2, 3);
        });
    });

    // =========================================================================
    // frequencyRatioToInterval
    // =========================================================================
    describe('frequencyRatioToInterval', () => {
        test('1.0 → unison (0)', () => {
            expect(frequencyRatioToInterval(1.0)).toBe(0);
        });

        test('2.0 → octave (wraps to 0)', () => {
            // 2.0 = 1200 cents = 24 steps, wraps to 0
            expect(frequencyRatioToInterval(2.0)).toBe(0);
        });

        test('1.5 → ~perfect fifth (14)', () => {
            // 1.5 = 702 cents ≈ 14.04 steps
            expect(frequencyRatioToInterval(1.5)).toBe(14);
        });

        test('√2 → tritone (12)', () => {
            expect(frequencyRatioToInterval(Math.SQRT2)).toBe(12);
        });
    });
});

describe('Quarter Tone Detection', () => {
    // =========================================================================
    // isQuarterTone
    // =========================================================================
    describe('isQuarterTone', () => {
        test('even intervals are NOT quarter tones', () => {
            expect(isQuarterTone(INTERVAL.UNISON)).toBe(false);
            expect(isQuarterTone(INTERVAL.MAJOR_SECOND)).toBe(false);
            expect(isQuarterTone(INTERVAL.MAJOR_THIRD)).toBe(false);
            expect(isQuarterTone(INTERVAL.PERFECT_FIFTH)).toBe(false);
        });

        test('odd intervals ARE quarter tones', () => {
            expect(isQuarterTone(INTERVAL.QUARTER_SHARP)).toBe(true);
            expect(isQuarterTone(INTERVAL.MAJOR_THIRD_QS)).toBe(true);
            expect(isQuarterTone(INTERVAL.PERFECT_FIFTH_QS)).toBe(true);
            expect(isQuarterTone(INTERVAL.MAJOR_SEVENTH_QS)).toBe(true);
        });
    });

    // =========================================================================
    // roundToSemitone
    // =========================================================================
    describe('roundToSemitone', () => {
        test('even intervals unchanged', () => {
            expect(roundToSemitone(INTERVAL.MAJOR_THIRD)).toBe(INTERVAL.MAJOR_THIRD);
            expect(roundToSemitone(INTERVAL.PERFECT_FIFTH)).toBe(INTERVAL.PERFECT_FIFTH);
        });

        test('odd intervals round down', () => {
            expect(roundToSemitone(INTERVAL.QUARTER_SHARP)).toBe(INTERVAL.UNISON);
            expect(roundToSemitone(INTERVAL.MAJOR_THIRD_QS)).toBe(INTERVAL.MAJOR_THIRD);
            expect(roundToSemitone(INTERVAL.PERFECT_FIFTH_QS)).toBe(INTERVAL.PERFECT_FIFTH);
        });
    });
});

describe('Interval Naming', () => {
    // =========================================================================
    // getIntervalName
    // =========================================================================
    describe('getIntervalName', () => {
        test('standard intervals', () => {
            expect(getIntervalName(INTERVAL.UNISON)).toBe('P1');
            expect(getIntervalName(INTERVAL.MINOR_SECOND)).toBe('m2');
            expect(getIntervalName(INTERVAL.MAJOR_SECOND)).toBe('M2');
            expect(getIntervalName(INTERVAL.MINOR_THIRD)).toBe('m3');
            expect(getIntervalName(INTERVAL.MAJOR_THIRD)).toBe('M3');
            expect(getIntervalName(INTERVAL.PERFECT_FOURTH)).toBe('P4');
            expect(getIntervalName(INTERVAL.TRITONE)).toBe('TT');
            expect(getIntervalName(INTERVAL.PERFECT_FIFTH)).toBe('P5');
            expect(getIntervalName(INTERVAL.MINOR_SIXTH)).toBe('m6');
            expect(getIntervalName(INTERVAL.MAJOR_SIXTH)).toBe('M6');
            expect(getIntervalName(INTERVAL.MINOR_SEVENTH)).toBe('m7');
            expect(getIntervalName(INTERVAL.MAJOR_SEVENTH)).toBe('M7');
        });

        test('quarter tone intervals', () => {
            expect(getIntervalName(INTERVAL.QUARTER_SHARP)).toBe('P1+');
            expect(getIntervalName(INTERVAL.MAJOR_THIRD_QS)).toBe('M3+');
            expect(getIntervalName(INTERVAL.PERFECT_FIFTH_QS)).toBe('P5+');
        });

        test('wraps intervals > 23', () => {
            expect(getIntervalName(asInterval24EDO(24))).toBe('P1');
            expect(getIntervalName(asInterval24EDO(32))).toBe('M3');
        });
    });

    // =========================================================================
    // parseIntervalName
    // =========================================================================
    describe('parseIntervalName', () => {
        test('parses standard intervals', () => {
            expect(parseIntervalName('P1')).toBe(0);
            expect(parseIntervalName('M3')).toBe(8);
            expect(parseIntervalName('P5')).toBe(14);
            expect(parseIntervalName('M7')).toBe(22);
        });

        test('parses quarter tone intervals', () => {
            expect(parseIntervalName('P1+')).toBe(1);
            expect(parseIntervalName('M3+')).toBe(9);
        });

        test('returns undefined for invalid names', () => {
            expect(parseIntervalName('invalid')).toBeUndefined();
            expect(parseIntervalName('X5')).toBeUndefined();
        });
    });
});

describe('Pitch Class Naming', () => {
    // =========================================================================
    // getPitchClassName
    // =========================================================================
    describe('getPitchClassName', () => {
        test('natural notes', () => {
            expect(getPitchClassName(asInterval24EDO(0))).toBe('C');
            expect(getPitchClassName(asInterval24EDO(4))).toBe('D');
            expect(getPitchClassName(asInterval24EDO(8))).toBe('E');
            expect(getPitchClassName(asInterval24EDO(10))).toBe('F');
            expect(getPitchClassName(asInterval24EDO(14))).toBe('G');
            expect(getPitchClassName(asInterval24EDO(18))).toBe('A');
            expect(getPitchClassName(asInterval24EDO(22))).toBe('B');
        });

        test('sharp notes', () => {
            expect(getPitchClassName(asInterval24EDO(2))).toBe('C#');
            expect(getPitchClassName(asInterval24EDO(6))).toBe('D#');
            expect(getPitchClassName(asInterval24EDO(12))).toBe('F#');
            expect(getPitchClassName(asInterval24EDO(16))).toBe('G#');
            expect(getPitchClassName(asInterval24EDO(20))).toBe('A#');
        });

        test('quarter tone notes', () => {
            expect(getPitchClassName(asInterval24EDO(1))).toBe('C+');
            expect(getPitchClassName(asInterval24EDO(9))).toBe('E+');
            expect(getPitchClassName(asInterval24EDO(15))).toBe('G+');
        });

        test('wraps intervals > 23', () => {
            expect(getPitchClassName(asInterval24EDO(24))).toBe('C');
            expect(getPitchClassName(asInterval24EDO(32))).toBe('E');
        });
    });
});
