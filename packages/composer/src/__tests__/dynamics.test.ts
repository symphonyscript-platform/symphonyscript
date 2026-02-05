import { SynapticMelody } from '../clips/SynapticMelody';
import { SiliconBridge } from '@symphonyscript/kernel';

describe('Dynamics methods', () => {
    let melody: SynapticMelody;
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
        melody = new SynapticMelody(mockBridge);
    });

    describe('crescendo()', () => {
        it('increases velocity over specified ticks', () => {
            melody.crescendo(4);

            // Play 4 notes at ticks 0, 1, 2, 3
            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.note('D4', 1).commit();
            melody.advanceTick(1);
            melody.note('E4', 1).commit();
            melody.advanceTick(1);
            melody.note('F4', 1).commit();

            const result = melody.build();
            const velocities = result.operations.map(op => op.velocity);

            // Velocities should increase from default 0.4 toward 1.0
            // First note at tick 0: from=0.4
            // Second note at tick 1: ~25% progress
            // Third note at tick 2: ~50% progress
            // Fourth note at tick 3: ~75% progress
            expect(velocities[0]).toBeLessThan(velocities[1]);
            expect(velocities[1]).toBeLessThan(velocities[2]);
            expect(velocities[2]).toBeLessThan(velocities[3]);
        });

        it('respects custom from/to values', () => {
            melody.crescendo(2, { from: 0.2, to: 0.6 });

            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.note('D4', 1).commit();

            const result = melody.build();
            const velocities = result.operations.map(op => op.velocity);

            // First note at tick 0: ~0.2 * 127 ≈ 25
            // Second note at tick 1: ~0.4 * 127 ≈ 51
            expect(velocities[0]).toBeGreaterThanOrEqual(20);
            expect(velocities[0]).toBeLessThanOrEqual(35);
            expect(velocities[1]).toBeGreaterThan(velocities[0]);
        });
    });

    describe('decrescendo()', () => {
        it('decreases velocity over specified ticks', () => {
            melody.decrescendo(4, { from: 1, to: 0.2 });

            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.note('D4', 1).commit();
            melody.advanceTick(1);
            melody.note('E4', 1).commit();
            melody.advanceTick(1);
            melody.note('F4', 1).commit();

            const result = melody.build();
            const velocities = result.operations.map(op => op.velocity);

            // Velocities should decrease from 1.0 toward 0.2
            expect(velocities[0]).toBeGreaterThan(velocities[1]);
            expect(velocities[1]).toBeGreaterThan(velocities[2]);
            expect(velocities[2]).toBeGreaterThan(velocities[3]);
        });

        it('respects custom curve option', () => {
            // Ease-out curve: fast start, slow end
            melody.decrescendo(4, { from: 1, to: 0.2, curve: 'ease-out' });

            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.note('D4', 1).commit();
            melody.advanceTick(1);
            melody.note('E4', 1).commit();

            const result = melody.build();
            const velocities = result.operations.map(op => op.velocity);

            // With ease-out, early notes drop faster
            expect(velocities[0]).toBeGreaterThan(velocities[1]);
        });
    });

    describe('velocityRamp()', () => {
        it('ramps velocity to target over duration', () => {
            melody.velocityRamp(0.8, 2);

            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.note('D4', 1).commit();

            const result = melody.build();
            const velocities = result.operations.map(op => op.velocity);

            // Ramps from default 0.8 to 0.8 (no change in this case)
            // Test with explicit from
            expect(velocities.length).toBe(2);
        });

        it('respects custom from option', () => {
            melody.velocityRamp(0.8, 2, { from: 0.4 });

            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.note('D4', 1).commit();

            const result = melody.build();
            const velocities = result.operations.map(op => op.velocity);

            // From 0.4 to 0.8 over 2 ticks
            // First note at tick 0: ~0.4 * 127 ≈ 51
            // Second note at tick 1: ~0.6 * 127 ≈ 76
            expect(velocities[0]).toBeLessThan(velocities[1]);
        });
    });

    describe('velocityCurve()', () => {
        it('interpolates custom velocity curve', () => {
            melody.velocityCurve([
                { tick: 0, velocity: 0.3 },
                { tick: 2, velocity: 0.9 },
                { tick: 4, velocity: 0.5 }
            ], 4);

            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.note('D4', 1).commit();
            melody.advanceTick(1);
            melody.note('E4', 1).commit();
            melody.advanceTick(1);
            melody.note('F4', 1).commit();

            const result = melody.build();
            const velocities = result.operations.map(op => op.velocity);

            // tick 0: 0.3
            // tick 1: interpolated between 0.3 and 0.9
            // tick 2: 0.9
            // tick 3: interpolated between 0.9 and 0.5
            expect(velocities[0]).toBeLessThan(velocities[2]); // 0.3 < 0.9
            expect(velocities[2]).toBeGreaterThan(velocities[3]); // 0.9 > towards 0.5
        });

        it('throws error if fewer than 2 points', () => {
            expect(() => {
                melody.velocityCurve([{ tick: 0, velocity: 0.5 }], 4);
            }).toThrow('velocityCurve requires at least 2 points');
        });

        it('handles unsorted points', () => {
            melody.velocityCurve([
                { tick: 2, velocity: 0.9 },
                { tick: 0, velocity: 0.3 },
                { tick: 4, velocity: 0.5 }
            ], 4);

            melody.note('C4', 1).commit();
            melody.advanceTick(2);
            melody.note('E4', 1).commit();

            const result = melody.build();
            const velocities = result.operations.map(op => op.velocity);

            // Points should be sorted internally
            // tick 0: 0.3, tick 2: 0.9
            expect(velocities[0]).toBeLessThan(velocities[1]);
        });
    });

    describe('dynamics auto-clear', () => {
        it('dynamics expire after duration', () => {
            melody.crescendo(2, { from: 0.3, to: 0.9 });

            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.note('D4', 1).commit();
            melody.advanceTick(1);
            // Now at tick 2, duration expired
            melody.note('E4', 1).velocity(0.5).commit();
            melody.advanceTick(1);
            melody.note('F4', 1).velocity(0.5).commit();

            const result = melody.build();
            const velocities = result.operations.map(op => op.velocity);

            // First two notes affected by crescendo
            expect(velocities[0]).toBeLessThan(velocities[1]);

            // Last two notes should use base velocity (0.5)
            // After humanization, should be around 0.5 * 127 ≈ 63
            const expectedBase = Math.floor(0.5 * 127);
            expect(velocities[2]).toBeGreaterThanOrEqual(expectedBase - 10);
            expect(velocities[2]).toBeLessThanOrEqual(expectedBase + 10);
        });
    });

    describe('dynamics integration', () => {
        it('dynamics work with transpose', () => {
            melody.transpose(12); // Up one octave
            melody.crescendo(2, { from: 0.4, to: 0.8 });

            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.note('D4', 1).commit();

            const result = melody.build();

            // Pitch should be transposed
            expect(result.operations[0].pitch).toBe(72); // C4 (60) + 12 = C5 (72)

            // Velocity should still follow crescendo
            expect(result.operations[0].velocity).toBeLessThan(result.operations[1].velocity);
        });

        it('dynamics can be chained fluently', () => {
            const result = melody
                .crescendo(4)
                .note('C4', 1).rest(1)   // rest() is an escape: commits note, advances tick, returns clip
                .note('D4', 1).build();  // build() is an escape: commits note and builds clip

            expect(result.operations.length).toBe(2);
            expect(result.operations[0].velocity).toBeLessThan(result.operations[1].velocity);
        });
    });
});
