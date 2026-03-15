import { SynapticMelody } from '../clips/SynapticMelody';
import { SynapticDrums } from '../clips/SynapticDrums';
import { Clip } from '../Clip';
import { createTestBridge } from '../test-bridge';
import { NoteOperation, HumanizeSettings } from '../types';

describe('Default Humanize (Task 031)', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
    });

    describe('SynapticClip.defaultHumanize()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.defaultHumanize({ timing: 10, velocity: 0.1 });
            expect(result).toBe(melody);
        });

        it('stores humanize settings', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultHumanize({ timing: 15, velocity: 0.05, seed: 42 });
            expect(melody.getHumanizeSettings()).toEqual({
                timing: 15,
                velocity: 0.05,
                seed: 42
            });
        });

        it('defaults to null when not set', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(melody.getHumanizeSettings()).toBeNull();
        });
    });

    describe('Velocity humanization', () => {
        it('applies velocity variation to notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultHumanize({ velocity: 0.1, seed: 12345 });

            // Generate multiple notes with same base velocity
            for (let i = 0; i < 5; i++) {
                melody.note('C4', 0.5).velocity(0.8).commit();
                melody.advanceTick(0.5);
            }

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // With velocity variation of 0.1, velocities should vary
            // around the base (0.8 * 127 = ~101)
            const velocities = noteOps.map(n => n.velocity);
            const uniqueVelocities = new Set(velocities);

            // Should have some variation (not all identical)
            expect(uniqueVelocities.size).toBeGreaterThan(1);

            // All velocities should be within valid range
            velocities.forEach(v => {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(127);
            });
        });

        it('no velocity variation when velocity setting is 0', () => {
            const melody1 = new SynapticMelody(mockBridge);
            melody1.defaultHumanize({ velocity: 0, seed: 42 });
            melody1.note('C4', 0.5).velocity(0.8).commit();

            const melody2 = new SynapticMelody(mockBridge);
            melody2.defaultHumanize({ velocity: 0, seed: 99 });
            melody2.note('C4', 0.5).velocity(0.8).commit();

            const result1 = melody1.build();
            const result2 = melody2.build();
            const note1 = (result1.operations[0] as NoteOperation);
            const note2 = (result2.operations[0] as NoteOperation);

            // Without velocity variation, should be the same
            expect(note1.velocity).toBe(note2.velocity);
        });
    });

    describe('Timing humanization', () => {
        it('applies timing variation to notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultHumanize({ timing: 20, seed: 54321 }); // 20ms max offset

            // Generate multiple notes at predictable ticks
            for (let i = 0; i < 5; i++) {
                melody.note('C4', 0.5).commit();
                melody.advanceTick(0.5);
            }

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Expected ticks: 0, 0.5, 1.0, 1.5, 2.0 (before humanization)
            // With timing variation, they should be slightly different
            const ticks = noteOps.map(n => n.tick);

            // At least some ticks should have been modified
            const expectedTicks = [0, 0.5, 1.0, 1.5, 2.0];
            let modified = 0;
            for (let i = 0; i < ticks.length; i++) {
                if (Math.abs(ticks[i] - expectedTicks[i]) > 0.0001) {
                    modified++;
                }
            }
            expect(modified).toBeGreaterThan(0);
        });

        it('no timing variation when timing setting is 0', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultHumanize({ timing: 0, seed: 42 });

            melody.note('C4', 0.5).commit();
            melody.advanceTick(0.5);
            melody.note('D4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Ticks should be exact (only swing applied, which is 0.5 by default)
            expect(noteOps[0].tick).toBeCloseTo(0, 5);
            expect(noteOps[1].tick).toBeCloseTo(0.5, 5);
        });
    });

    describe('Seed reproducibility', () => {
        it('same seed produces same humanization', () => {
            const settings: HumanizeSettings = { timing: 10, velocity: 0.1, seed: 99999 };

            const melody1 = new SynapticMelody(mockBridge);
            melody1.defaultHumanize(settings);
            melody1.note('C4', 0.5).velocity(0.7).commit();
            melody1.advanceTick(0.5);
            melody1.note('D4', 0.5).velocity(0.7).commit();

            const melody2 = new SynapticMelody(mockBridge);
            melody2.defaultHumanize(settings);
            melody2.note('C4', 0.5).velocity(0.7).commit();
            melody2.advanceTick(0.5);
            melody2.note('D4', 0.5).velocity(0.7).commit();

            const result1 = melody1.build();
            const result2 = melody2.build();

            const notes1 = result1.operations.filter(op => op.kind === 'note') as NoteOperation[];
            const notes2 = result2.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Same seed should produce identical results
            expect(notes1[0].velocity).toBe(notes2[0].velocity);
            expect(notes1[0].tick).toBe(notes2[0].tick);
            expect(notes1[1].velocity).toBe(notes2[1].velocity);
            expect(notes1[1].tick).toBe(notes2[1].tick);
        });

        it('different seeds produce different humanization', () => {
            const bridge1 = createTestBridge();
            const melody1 = new SynapticMelody(bridge1);
            melody1.defaultHumanize({ timing: 10, velocity: 0.1, seed: 111 });
            melody1.note('C4', 0.5).velocity(0.7).commit();

            const bridge2 = createTestBridge();
            const melody2 = new SynapticMelody(bridge2);
            melody2.defaultHumanize({ timing: 10, velocity: 0.1, seed: 222 });
            melody2.note('C4', 0.5).velocity(0.7).commit();

            const result1 = melody1.build();
            const result2 = melody2.build();

            const note1 = result1.operations[0] as NoteOperation;
            const note2 = result2.operations[0] as NoteOperation;

            const isDifferent = note1.velocity !== note2.velocity || note1.tick !== note2.tick;
            expect(isDifferent).toBe(true);
        });
    });

    describe('precise() override', () => {
        it('precise() skips humanization for that note', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultHumanize({ timing: 20, velocity: 0.2, seed: 42 });

            // First note: humanized
            melody.note('C4', 0.5).velocity(0.8).commit();
            melody.advanceTick(0.5);

            // Second note: precise (no humanization)
            melody.note('D4', 0.5).velocity(0.8).precise().commit();
            melody.advanceTick(0.5);

            // Third note: humanized again
            melody.note('E4', 0.5).velocity(0.8).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // The precise note should have exact velocity (0.8 * 127 = 101.6 -> 101)
            // and exact tick (0.5)
            expect(noteOps[1].velocity).toBe(101);
            expect(noteOps[1].tick).toBeCloseTo(0.5, 5);
        });

        it('precise() flag resets after commit', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultHumanize({ velocity: 0.2, seed: 42 });

            // First note: precise
            melody.note('C4', 0.5).velocity(0.8).precise().commit();
            melody.advanceTick(0.5);

            // Second note: should be humanized again (precise reset)
            melody.note('D4', 0.5).velocity(0.8).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // First note should be exact
            expect(noteOps[0].velocity).toBe(101);

            // Second note should be different (humanized)
            // With seed 42 and velocity variation, it should not be exactly 101
            expect(noteOps[1].velocity).not.toBe(101);
        });
    });

    describe('SynapticDrums humanization', () => {
        it('applies humanization to drum hits', () => {
            const drums = new SynapticDrums(mockBridge);
            drums.defaultHumanize({ velocity: 0.1, seed: 12345 });

            for (let i = 0; i < 4; i++) {
                drums.kick(0.25).velocity(0.9).commit();
                drums.advanceTick(0.25);
            }

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            const velocities = noteOps.map(n => n.velocity);
            const uniqueVelocities = new Set(velocities);

            expect(uniqueVelocities.size).toBeGreaterThan(1);
        });

        it('precise() works on drum hits', () => {
            const drums = new SynapticDrums(mockBridge);
            drums.defaultHumanize({ velocity: 0.2, seed: 42 });

            drums.kick(0.25).velocity(0.9).precise().commit();

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should be exact: 0.9 * 127 = 114.3 -> 114
            expect(noteOps[0].velocity).toBe(114);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().defaultHumanize() works', () => {
            const result = Clip.melody('test')
                .defaultHumanize({ velocity: 0.1, seed: 42 })
                .note('C4', 0.5).velocity(0.7)
                .rest(0.5)
                .note('D4', 0.5).velocity(0.7)
                .rest(0.5)
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
        });

        it('Clip.drums().defaultHumanize() works', () => {
            const result = Clip.drums('test')
                .defaultHumanize({ timing: 5, velocity: 0.05, seed: 42 })
                .kick(0.25)
                .rest(0.25)
                .snare(0.25)
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
        });
    });

    describe('Edge cases', () => {
        it('handles undefined seed (uses current RNG state)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultHumanize({ velocity: 0.1 }); // No seed
            melody.note('C4', 0.5).velocity(0.8).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(1);
            // Just verify it doesn't crash
        });

        it('handles only timing setting', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultHumanize({ timing: 10, seed: 42 });
            melody.note('C4', 0.5).velocity(0.8).commit();

            const result = melody.build();
            expect(result.operations).toHaveLength(1);
        });

        it('handles only velocity setting', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultHumanize({ velocity: 0.1, seed: 42 });
            melody.note('C4', 0.5).velocity(0.8).commit();

            const result = melody.build();
            expect(result.operations).toHaveLength(1);
        });

        it('empty settings object applies no variation', () => {
            // With empty settings (no timing, no velocity), note should be unchanged
            const melody = new SynapticMelody(mockBridge);
            melody.defaultHumanize({}); // Empty settings
            melody.note('C4', 0.5).velocity(0.8).commit();

            const result = melody.build();
            const note = result.operations[0] as NoteOperation;

            // With empty settings, no variation should be applied
            // 0.8 * 127 = 101.6 -> 101
            expect(note.velocity).toBe(101);
            expect(note.tick).toBeCloseTo(0, 5);
        });
    });
});
