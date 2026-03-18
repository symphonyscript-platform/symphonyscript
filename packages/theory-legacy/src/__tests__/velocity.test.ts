/**
 * Tests for pitch/midi.ts - Velocity Utilities
 */

import {
    midiVelocityToNormalized,
    normalizedToMidiVelocity,
} from '../pitch/midi';

describe('pitch/midi velocity utilities', () => {
    // =========================================================================
    // midiVelocityToNormalized()
    // =========================================================================
    describe('midiVelocityToNormalized()', () => {
        it('converts 0 to 0', () => {
            expect(midiVelocityToNormalized(0)).toBe(0);
        });

        it('converts 127 to 1', () => {
            expect(midiVelocityToNormalized(127)).toBe(1);
        });

        it('converts middle values correctly', () => {
            expect(midiVelocityToNormalized(64)).toBeCloseTo(64 / 127, 5);
            expect(midiVelocityToNormalized(100)).toBeCloseTo(100 / 127, 5);
        });

        it('clamps values below 0', () => {
            expect(midiVelocityToNormalized(-10)).toBe(0);
            expect(midiVelocityToNormalized(-100)).toBe(0);
        });

        it('clamps values above 127', () => {
            expect(midiVelocityToNormalized(128)).toBe(1);
            expect(midiVelocityToNormalized(200)).toBe(1);
        });

        it('handles NaN', () => {
            expect(midiVelocityToNormalized(NaN)).toBe(0);
        });

        it('handles Infinity', () => {
            expect(midiVelocityToNormalized(Infinity)).toBe(0);
            expect(midiVelocityToNormalized(-Infinity)).toBe(0);
        });
    });

    // =========================================================================
    // normalizedToMidiVelocity()
    // =========================================================================
    describe('normalizedToMidiVelocity()', () => {
        it('converts 0 to 0', () => {
            expect(normalizedToMidiVelocity(0)).toBe(0);
        });

        it('converts 1 to 127', () => {
            expect(normalizedToMidiVelocity(1)).toBe(127);
        });

        it('converts middle values correctly', () => {
            expect(normalizedToMidiVelocity(0.5)).toBe(64); // Math.round(0.5 * 127) = 64
            expect(normalizedToMidiVelocity(0.75)).toBe(95); // Math.round(0.75 * 127) = 95
        });

        it('rounds to nearest integer', () => {
            expect(normalizedToMidiVelocity(0.504)).toBe(64);
            expect(normalizedToMidiVelocity(0.496)).toBe(63);
        });

        it('clamps values below 0', () => {
            expect(normalizedToMidiVelocity(-0.5)).toBe(0);
            expect(normalizedToMidiVelocity(-1)).toBe(0);
        });

        it('clamps values above 1', () => {
            expect(normalizedToMidiVelocity(1.5)).toBe(127);
            expect(normalizedToMidiVelocity(2)).toBe(127);
        });

        it('handles NaN', () => {
            expect(normalizedToMidiVelocity(NaN)).toBe(0);
        });

        it('handles Infinity', () => {
            expect(normalizedToMidiVelocity(Infinity)).toBe(0);
            expect(normalizedToMidiVelocity(-Infinity)).toBe(0);
        });
    });

    // =========================================================================
    // Round-trip conversion
    // =========================================================================
    describe('round-trip conversion', () => {
        it('preserves values through round-trip', () => {
            // Note: Due to rounding, not all values survive round-trip perfectly
            // but boundary values should
            expect(normalizedToMidiVelocity(midiVelocityToNormalized(0))).toBe(0);
            expect(normalizedToMidiVelocity(midiVelocityToNormalized(127))).toBe(127);
            expect(normalizedToMidiVelocity(midiVelocityToNormalized(64))).toBe(64);
        });

        it('normalized round-trip is close', () => {
            const original = 0.5;
            const midi = normalizedToMidiVelocity(original);
            const backToNormalized = midiVelocityToNormalized(midi);
            expect(backToNormalized).toBeCloseTo(original, 2);
        });
    });
});
