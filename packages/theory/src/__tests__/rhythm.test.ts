/**
 * Tests for Rhythm Module
 * RFC-047: Bitwise Music Theory System
 */

import {
    // Euclidean
    euclidean,
    euclideanMask,
    euclideanForEach,
    rotatePattern,
    rotateMask,
    patternToString,
    // Quantize
    parseQuantizeTimeSignature,
    getNextBeat,
    getNextBarBeat,
    getCurrentBar,
    getBeatInBar,
    getQuantizeTargetBeat,
    quantizeBeatsToSeconds,
    quantizeSecondsToBeats,
    getBeatDuration,
    getBarDuration,
    isWithinLookahead,
    isAtQuantizeBoundary,
    getQuantizeTargetWithLookahead,
    getBeatGridInfo,
    // Grooves
    createSwing,
    GROOVE,
    applyGroove,
    getGrooveTiming,
    getGrooveVelocity,
    getGrooveDuration,
    // Articulation
    ARTICULATION_MULTIPLIER,
    ARTICULATION_VELOCITY,
    getArticulationMultiplier,
    getArticulationVelocity,
    isArticulation,
    // Duration
    DURATION,
    beatsToSeconds,
    secondsToBeats,
    parseTimeSignature,
    parseDuration,
    getDurationBeats,
    durationToMs,
    isValidDuration,
} from '../rhythm';
import { asHarmonyMask } from '../types';

// ============================================================================
// Euclidean Rhythm Tests
// ============================================================================

describe('Euclidean Rhythms', () => {
    describe('euclidean()', () => {
        test('generates tresillo pattern (3, 8)', () => {
            const pattern = euclidean(3, 8);
            expect(pattern).not.toBeNull();
            expect(pattern).toHaveLength(8);
            expect(patternToString(pattern!)).toBe('x--x--x-');
        });

        test('generates cinquillo pattern (5, 8)', () => {
            const pattern = euclidean(5, 8);
            expect(pattern).not.toBeNull();
            expect(pattern).toHaveLength(8);
            expect(patternToString(pattern!)).toBe('x-xx-xx-');
        });

        test('generates son clave (5, 16)', () => {
            const pattern = euclidean(5, 16);
            expect(pattern).not.toBeNull();
            expect(pattern).toHaveLength(16);
            // Count hits
            const hits = pattern!.filter(Boolean).length;
            expect(hits).toBe(5);
        });

        test('handles edge case: hits >= steps', () => {
            const pattern = euclidean(8, 8);
            expect(pattern).not.toBeNull();
            expect(pattern!.every(Boolean)).toBe(true);
        });

        test('handles edge case: hits = 0', () => {
            const pattern = euclidean(0, 8);
            expect(pattern).not.toBeNull();
            expect(pattern!.every(v => !v)).toBe(true);
        });

        test('returns null for invalid inputs', () => {
            expect(euclidean(-1, 8)).toBeNull();
            expect(euclidean(3, 0)).toBeNull();
            expect(euclidean(3, -1)).toBeNull();
            expect(euclidean(NaN, 8)).toBeNull();
            expect(euclidean(3, Infinity)).toBeNull();
        });
    });

    describe('euclideanMask()', () => {
        test('generates bitmask for tresillo', () => {
            const mask = euclideanMask(3, 8);
            expect(mask).not.toBeNull();
            // Pattern: x--x--x- = bits 0, 3, 6
            expect(mask).toBe(asHarmonyMask(0b01001001));
        });

        test('returns null for steps > 24', () => {
            expect(euclideanMask(3, 25)).toBeNull();
        });

        test('returns null for invalid inputs', () => {
            expect(euclideanMask(-1, 8)).toBeNull();
            expect(euclideanMask(3, 0)).toBeNull();
        });
    });

    describe('euclideanForEach()', () => {
        test('iterates over hit positions', () => {
            const hits: number[] = [];
            euclideanForEach(3, 8, step => hits.push(step));
            expect(hits).toEqual([0, 3, 6]);
        });

        test('handles longer patterns with wrapping', () => {
            const hits: number[] = [];
            euclideanForEach(2, 32, step => hits.push(step));
            // Should wrap around the 24-bit mask
            expect(hits.length).toBeGreaterThan(2);
        });

        test('does nothing for invalid inputs', () => {
            const hits: number[] = [];
            euclideanForEach(-1, 8, step => hits.push(step));
            expect(hits).toHaveLength(0);
        });
    });

    describe('rotatePattern()', () => {
        test('rotates pattern right', () => {
            const pattern = [true, false, false, true];
            const rotated = rotatePattern(pattern, 1);
            expect(rotated).toEqual([true, true, false, false]);
        });

        test('rotates pattern left (negative)', () => {
            const pattern = [true, false, false, true];
            const rotated = rotatePattern(pattern, -1);
            expect(rotated).toEqual([false, false, true, true]);
        });

        test('handles empty pattern', () => {
            expect(rotatePattern([], 5)).toEqual([]);
        });

        test('handles offset larger than length', () => {
            const pattern = [true, false, false, false];
            const rotated = rotatePattern(pattern, 5);
            expect(rotated).toEqual(rotatePattern(pattern, 1));
        });
    });

    describe('rotateMask()', () => {
        test('rotates bitmask right', () => {
            const mask = asHarmonyMask(0b0001); // bit 0 set
            const rotated = rotateMask(mask, 1, 4);
            expect(rotated).toBe(asHarmonyMask(0b1000)); // bit 3 set
        });

        test('rotates bitmask left (negative)', () => {
            const mask = asHarmonyMask(0b1000); // bit 3 set
            const rotated = rotateMask(mask, -1, 4);
            expect(rotated).toBe(asHarmonyMask(0b0001)); // bit 0 set
        });

        test('handles zero offset', () => {
            const mask = asHarmonyMask(0b1010);
            expect(rotateMask(mask, 0, 4)).toBe(mask);
        });
    });

    describe('patternToString()', () => {
        test('converts pattern with default chars', () => {
            expect(patternToString([true, false, true, false])).toBe('x-x-');
        });

        test('uses custom characters', () => {
            expect(patternToString([true, false], '1', '0')).toBe('10');
        });
    });
});

// ============================================================================
// Beat-Grid Quantization Tests
// ============================================================================

describe('Beat-Grid Quantization', () => {
    describe('parseQuantizeTimeSignature()', () => {
        test('parses 4/4', () => {
            const ts = parseQuantizeTimeSignature('4/4');
            expect(ts).toEqual({ beatsPerMeasure: 4, beatUnit: 4 });
        });

        test('parses 3/4', () => {
            const ts = parseQuantizeTimeSignature('3/4');
            expect(ts).toEqual({ beatsPerMeasure: 3, beatUnit: 4 });
        });

        test('parses 6/8', () => {
            const ts = parseQuantizeTimeSignature('6/8');
            expect(ts).toEqual({ beatsPerMeasure: 6, beatUnit: 8 });
        });

        test('returns null for invalid input', () => {
            expect(parseQuantizeTimeSignature('invalid')).toBeNull();
            expect(parseQuantizeTimeSignature('4')).toBeNull();
            expect(parseQuantizeTimeSignature('4/0')).toBeNull();
        });
    });

    describe('beat calculations', () => {
        test('getNextBeat() rounds up', () => {
            expect(getNextBeat(0)).toBe(0);
            expect(getNextBeat(0.1)).toBe(1);
            expect(getNextBeat(3.5)).toBe(4);
        });

        test('getNextBarBeat() finds next bar', () => {
            expect(getNextBarBeat(0, 4)).toBe(4);
            expect(getNextBarBeat(3.5, 4)).toBe(4);
            expect(getNextBarBeat(4, 4)).toBe(8);
        });

        test('getCurrentBar() returns bar number', () => {
            expect(getCurrentBar(0, 4)).toBe(0);
            expect(getCurrentBar(3, 4)).toBe(0);
            expect(getCurrentBar(4, 4)).toBe(1);
            expect(getCurrentBar(7.9, 4)).toBe(1);
        });

        test('getBeatInBar() returns position in bar', () => {
            expect(getBeatInBar(0, 4)).toBe(0);
            expect(getBeatInBar(2, 4)).toBe(2);
            expect(getBeatInBar(5, 4)).toBe(1);
        });
    });

    describe('quantize target', () => {
        test('getQuantizeTargetBeat() with bar mode', () => {
            expect(getQuantizeTargetBeat(2.5, 'bar', 4)).toBe(4);
        });

        test('getQuantizeTargetBeat() with beat mode', () => {
            expect(getQuantizeTargetBeat(2.5, 'beat', 4)).toBe(3);
        });

        test('getQuantizeTargetBeat() with off mode', () => {
            expect(getQuantizeTargetBeat(2.5, 'off', 4)).toBe(2.5);
        });
    });

    describe('time conversions', () => {
        test('beatsToSeconds at 120 BPM', () => {
            expect(quantizeBeatsToSeconds(1, 120)).toBe(0.5);
            expect(quantizeBeatsToSeconds(4, 120)).toBe(2);
        });

        test('secondsToBeats at 120 BPM', () => {
            expect(quantizeSecondsToBeats(0.5, 120)).toBe(1);
            expect(quantizeSecondsToBeats(2, 120)).toBe(4);
        });

        test('getBeatDuration at various tempos', () => {
            expect(getBeatDuration(60)).toBe(1);
            expect(getBeatDuration(120)).toBe(0.5);
        });

        test('getBarDuration at 120 BPM, 4/4', () => {
            expect(getBarDuration(120, 4)).toBe(2);
        });
    });

    describe('lookahead calculations', () => {
        test('isWithinLookahead()', () => {
            expect(isWithinLookahead(5, 4, 2)).toBe(true);
            expect(isWithinLookahead(6, 4, 2)).toBe(false);
            expect(isWithinLookahead(3, 4, 2)).toBe(false);
        });
    });

    describe('boundary checks', () => {
        test('isAtQuantizeBoundary() bar mode', () => {
            expect(isAtQuantizeBoundary(0, 'bar', 4)).toBe(true);
            expect(isAtQuantizeBoundary(4, 'bar', 4)).toBe(true);
            expect(isAtQuantizeBoundary(2, 'bar', 4)).toBe(false);
        });

        test('isAtQuantizeBoundary() beat mode', () => {
            expect(isAtQuantizeBoundary(2, 'beat', 4)).toBe(true);
            expect(isAtQuantizeBoundary(2.5, 'beat', 4)).toBe(false);
        });

        test('isAtQuantizeBoundary() off mode always true', () => {
            expect(isAtQuantizeBoundary(2.5, 'off', 4)).toBe(true);
        });
    });

    describe('getQuantizeTargetWithLookahead()', () => {
        test('skips boundary within lookahead', () => {
            // Current beat 3.5, lookahead 1, next bar at 4
            // Should skip to beat 8 (next bar after lookahead)
            expect(getQuantizeTargetWithLookahead(3.5, 'bar', 4, 1)).toBe(8);
        });
    });

    describe('getBeatGridInfo()', () => {
        test('returns complete grid info', () => {
            const info = getBeatGridInfo(5.5, 4);
            expect(info.bar).toBe(1);
            expect(info.beatInBar).toBe(1);
            expect(info.fractionalBeat).toBeCloseTo(0.5);
            expect(info.isOnBeat).toBe(false);
            expect(info.isOnBar).toBe(false);
        });
    });
});

// ============================================================================
// Groove Templates Tests
// ============================================================================

describe('Groove Templates', () => {
    describe('createSwing()', () => {
        test('creates 50% swing (straight)', () => {
            const groove = createSwing(0.5, 4);
            expect(groove.name).toContain('50%');
            // At 50%, delay should be 0
            expect(groove.steps[1]?.timing).toBe(0);
        });

        test('creates 66% swing (triplet)', () => {
            const groove = createSwing(0.66, 4);
            expect(groove.name).toContain('66%');
            // At 66%, delay should be ~0.32
            expect(groove.steps[1]?.timing).toBeCloseTo(0.32, 1);
        });

        test('creates 75% swing (dotted)', () => {
            const groove = createSwing(0.75, 4);
            expect(groove.name).toContain('75%');
            // At 75%, delay should be 0.5
            expect(groove.steps[1]?.timing).toBe(0.5);
        });
    });

    describe('GROOVE constants', () => {
        test('STRAIGHT has no steps', () => {
            expect(GROOVE.STRAIGHT.steps).toHaveLength(0);
        });

        test('MPC presets exist', () => {
            expect(GROOVE.MPC_16_55).toBeDefined();
            expect(GROOVE.MPC_16_57).toBeDefined();
            expect(GROOVE.MPC_16_60).toBeDefined();
            expect(GROOVE.MPC_16_66).toBeDefined();
            expect(GROOVE.MPC_16_75).toBeDefined();
        });

        test('SWING has 2 steps', () => {
            expect(GROOVE.SWING.stepsPerBeat).toBe(2);
            expect(GROOVE.SWING.steps).toHaveLength(2);
        });

        test('LAID_BACK has velocity variations', () => {
            expect(GROOVE.LAID_BACK.steps.some(s => s.velocity !== 1.0)).toBe(true);
        });

        test('RUSHING has negative timing', () => {
            expect(GROOVE.RUSHING.steps.some(s => (s.timing ?? 0) < 0)).toBe(true);
        });
    });

    describe('applyGroove()', () => {
        test('returns timing and velocity', () => {
            const result = applyGroove(1, GROOVE.MPC_16_66);
            expect(result).toHaveProperty('timing');
            expect(result).toHaveProperty('velocity');
        });

        test('applies base velocity', () => {
            const result = applyGroove(0, GROOVE.LAID_BACK, 0.8);
            expect(result.velocity).toBeCloseTo(0.8);
        });

        test('handles STRAIGHT groove', () => {
            const result = applyGroove(0, GROOVE.STRAIGHT);
            expect(result.timing).toBe(0);
            expect(result.velocity).toBe(1.0);
        });
    });

    describe('kernel-safe accessors', () => {
        test('getGrooveTiming() returns primitive', () => {
            const timing = getGrooveTiming(1, GROOVE.MPC_16_66);
            expect(typeof timing).toBe('number');
            expect(timing).toBeGreaterThan(0);
        });

        test('getGrooveVelocity() returns primitive', () => {
            const velocity = getGrooveVelocity(0, GROOVE.LAID_BACK, 0.9);
            expect(typeof velocity).toBe('number');
        });

        test('getGrooveDuration() returns primitive', () => {
            const duration = getGrooveDuration(0, GROOVE.STRAIGHT);
            expect(typeof duration).toBe('number');
            expect(duration).toBe(1.0);
        });

        test('STRAIGHT returns defaults', () => {
            expect(getGrooveTiming(0, GROOVE.STRAIGHT)).toBe(0);
            expect(getGrooveVelocity(0, GROOVE.STRAIGHT)).toBe(1.0);
        });
    });
});

// ============================================================================
// Articulation Tests
// ============================================================================

describe('Articulation', () => {
    describe('ARTICULATION_MULTIPLIER', () => {
        test('staccato is 0.5', () => {
            expect(ARTICULATION_MULTIPLIER.staccato).toBe(0.5);
        });

        test('legato is 1.05', () => {
            expect(ARTICULATION_MULTIPLIER.legato).toBe(1.05);
        });

        test('marcato is 0.75', () => {
            expect(ARTICULATION_MULTIPLIER.marcato).toBe(0.75);
        });

        test('accent and tenuto are 1.0', () => {
            expect(ARTICULATION_MULTIPLIER.accent).toBe(1.0);
            expect(ARTICULATION_MULTIPLIER.tenuto).toBe(1.0);
        });
    });

    describe('ARTICULATION_VELOCITY', () => {
        test('accent increases velocity', () => {
            expect(ARTICULATION_VELOCITY.accent).toBeGreaterThan(1.0);
        });

        test('marcato increases velocity more', () => {
            expect(ARTICULATION_VELOCITY.marcato).toBeGreaterThan(ARTICULATION_VELOCITY.accent);
        });

        test('legato decreases velocity slightly', () => {
            expect(ARTICULATION_VELOCITY.legato).toBeLessThan(1.0);
        });
    });

    describe('getArticulationMultiplier()', () => {
        test('returns multiplier for valid articulation', () => {
            expect(getArticulationMultiplier('staccato')).toBe(0.5);
        });

        test('returns 1.0 for undefined', () => {
            expect(getArticulationMultiplier(undefined)).toBe(1.0);
        });
    });

    describe('getArticulationVelocity()', () => {
        test('returns velocity for valid articulation', () => {
            expect(getArticulationVelocity('accent')).toBe(1.3);
        });

        test('returns 1.0 for undefined', () => {
            expect(getArticulationVelocity(undefined)).toBe(1.0);
        });
    });

    describe('isArticulation()', () => {
        test('returns true for valid articulations', () => {
            expect(isArticulation('staccato')).toBe(true);
            expect(isArticulation('legato')).toBe(true);
            expect(isArticulation('accent')).toBe(true);
            expect(isArticulation('tenuto')).toBe(true);
            expect(isArticulation('marcato')).toBe(true);
        });

        test('returns false for invalid strings', () => {
            expect(isArticulation('invalid')).toBe(false);
            expect(isArticulation('')).toBe(false);
        });
    });
});

// ============================================================================
// Duration Tests
// ============================================================================

describe('Duration', () => {
    describe('DURATION constants', () => {
        test('standard durations', () => {
            expect(DURATION.WHOLE).toBe('1n');
            expect(DURATION.HALF).toBe('2n');
            expect(DURATION.QUARTER).toBe('4n');
            expect(DURATION.EIGHTH).toBe('8n');
            expect(DURATION.SIXTEENTH).toBe('16n');
            expect(DURATION.THIRTY_SECOND).toBe('32n');
        });

        test('dotted durations', () => {
            expect(DURATION.DOTTED_QUARTER).toBe('4n.');
        });

        test('triplet durations', () => {
            expect(DURATION.QUARTER_TRIPLET).toBe('4t');
        });
    });

    describe('beatsToSeconds()', () => {
        test('converts at 60 BPM', () => {
            expect(beatsToSeconds(1, 60)).toBe(1);
            expect(beatsToSeconds(4, 60)).toBe(4);
        });

        test('converts at 120 BPM', () => {
            expect(beatsToSeconds(1, 120)).toBe(0.5);
            expect(beatsToSeconds(4, 120)).toBe(2);
        });
    });

    describe('secondsToBeats()', () => {
        test('converts at 60 BPM', () => {
            expect(secondsToBeats(1, 60)).toBe(1);
        });

        test('converts at 120 BPM', () => {
            expect(secondsToBeats(1, 120)).toBe(2);
        });
    });

    describe('parseTimeSignature()', () => {
        test('parses valid signatures', () => {
            expect(parseTimeSignature('4/4')).toEqual({ numerator: 4, denominator: 4 });
            expect(parseTimeSignature('3/4')).toEqual({ numerator: 3, denominator: 4 });
            expect(parseTimeSignature('6/8')).toEqual({ numerator: 6, denominator: 8 });
        });

        test('returns null for invalid input', () => {
            expect(parseTimeSignature('invalid')).toBeNull();
            expect(parseTimeSignature('4')).toBeNull();
            expect(parseTimeSignature('0/4')).toBeNull();
        });
    });

    describe('parseDuration()', () => {
        test('parses standard durations', () => {
            expect(parseDuration('1n')).toBe(4);
            expect(parseDuration('2n')).toBe(2);
            expect(parseDuration('4n')).toBe(1);
            expect(parseDuration('8n')).toBe(0.5);
            expect(parseDuration('16n')).toBe(0.25);
            expect(parseDuration('32n')).toBe(0.125);
        });

        test('parses dotted durations (1.5x)', () => {
            expect(parseDuration('4n.')).toBe(1.5);
            expect(parseDuration('8n.')).toBe(0.75);
        });

        test('parses triplet durations (2/3x)', () => {
            expect(parseDuration('4t')).toBeCloseTo(2 / 3);
            expect(parseDuration('8t')).toBeCloseTo(1 / 3);
        });

        test('passes through numeric values', () => {
            expect(parseDuration(2.5)).toBe(2.5);
        });

        test('returns null for invalid input', () => {
            expect(parseDuration('invalid' as any)).toBeNull();
            expect(parseDuration(-1)).toBeNull();
            expect(parseDuration(NaN)).toBeNull();
        });
    });

    describe('getDurationBeats()', () => {
        test('returns parsed value', () => {
            expect(getDurationBeats('4n')).toBe(1);
        });

        test('returns fallback for invalid', () => {
            expect(getDurationBeats('invalid' as any, 2)).toBe(2);
        });
    });

    describe('durationToMs()', () => {
        test('converts to milliseconds', () => {
            // 1 beat at 60 BPM = 1 second = 1000ms
            expect(durationToMs('4n', 60)).toBe(1000);
            // 1 beat at 120 BPM = 0.5 seconds = 500ms
            expect(durationToMs('4n', 120)).toBe(500);
        });

        test('returns null for invalid duration', () => {
            expect(durationToMs('invalid' as any, 120)).toBeNull();
        });
    });

    describe('isValidDuration()', () => {
        test('returns true for valid durations', () => {
            expect(isValidDuration('4n')).toBe(true);
            expect(isValidDuration('8n.')).toBe(true);
            expect(isValidDuration('4t')).toBe(true);
            expect(isValidDuration(1.5)).toBe(true);
        });

        test('returns false for invalid', () => {
            expect(isValidDuration('invalid' as any)).toBe(false);
        });
    });
});
