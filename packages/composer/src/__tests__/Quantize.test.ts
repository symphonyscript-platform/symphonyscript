import { SynapticMelody } from '../clips/SynapticMelody';
import { SynapticDrums } from '../clips/SynapticDrums';
import { Clip } from '../Clip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { NoteOperation, QuantizeSettings } from '../types';

describe('Quantize (Task 032)', () => {
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
    });

    describe('SynapticClip.quantize()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.quantize(0.25);
            expect(result).toBe(melody);
        });

        it('stores quantize settings', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25, { strength: 0.8, duration: true });
            expect(melody.getQuantizeSettings()).toEqual({
                grid: 0.25,
                strength: 0.8,
                duration: true
            });
        });

        it('defaults to null when not set', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(melody.getQuantizeSettings()).toBeNull();
        });

        it('stores grid-only settings', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.5);
            expect(melody.getQuantizeSettings()).toEqual({
                grid: 0.5,
                strength: undefined,
                duration: undefined
            });
        });
    });

    describe('Tick quantization', () => {
        it('snaps tick to grid at full strength', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25); // 16th notes

            // Place note at 0.3 (between 0.25 and 0.5)
            melody.advanceTick(0.3);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should snap to 0.25 (nearest grid point)
            expect(noteOps[0].tick).toBeCloseTo(0.25, 5);
        });

        it('snaps tick to higher grid point when closer', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25); // 16th notes

            // Place note at 0.4 (closer to 0.5)
            melody.advanceTick(0.4);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should snap to 0.5 (nearest grid point)
            expect(noteOps[0].tick).toBeCloseTo(0.5, 5);
        });

        it('leaves note at grid point unchanged', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25);

            // Place note exactly on grid
            melody.advanceTick(0.5);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should remain at 0.5
            expect(noteOps[0].tick).toBeCloseTo(0.5, 5);
        });
    });

    describe('Strength parameter', () => {
        it('strength 0 = no quantization', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25, { strength: 0 });

            melody.advanceTick(0.3);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should stay at 0.3 (no snapping)
            expect(noteOps[0].tick).toBeCloseTo(0.3, 5);
        });

        it('strength 0.5 = halfway to grid', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25, { strength: 0.5 });

            // Note at 0.3, grid at 0.25
            // Distance = 0.3 - 0.25 = 0.05
            // At 50% strength: 0.3 - 0.05 * 0.5 = 0.275
            melody.advanceTick(0.3);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].tick).toBeCloseTo(0.275, 5);
        });

        it('strength 1 = full snap (default)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25); // No strength = default 1

            melody.advanceTick(0.3);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].tick).toBeCloseTo(0.25, 5);
        });
    });

    describe('Duration quantization', () => {
        it('quantizes duration when enabled', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25, { duration: true });

            // Duration 0.3 should snap to 0.25
            melody.note('C4', 0.3).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBeCloseTo(0.25, 5);
        });

        it('does not quantize duration by default', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25); // No duration option

            melody.note('C4', 0.3).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Duration should remain 0.3
            expect(noteOps[0].duration).toBeCloseTo(0.3, 5);
        });

        it('applies strength to duration quantization', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25, { strength: 0.5, duration: true });

            // Duration 0.3, grid 0.25
            // snapped = 0.25, distance = 0.3 - 0.25 = 0.05
            // At 50% strength: 0.3 + (0.25 - 0.3) * 0.5 = 0.275
            melody.note('C4', 0.3).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBeCloseTo(0.275, 5);
        });

        it('enforces minimum duration of one grid unit', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25, { duration: true });

            // Very short duration should snap to at least 0.25
            melody.note('C4', 0.1).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBeCloseTo(0.25, 5);
        });
    });

    describe('Different grid sizes', () => {
        it('works with 8th note grid (0.5)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.5);

            melody.advanceTick(0.6);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // 0.6 rounds to 0.5
            expect(noteOps[0].tick).toBeCloseTo(0.5, 5);
        });

        it('works with quarter note grid (1.0)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(1.0);

            melody.advanceTick(1.3);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // 1.3 rounds to 1.0
            expect(noteOps[0].tick).toBeCloseTo(1.0, 5);
        });

        it('works with 32nd note grid (0.125)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.125);

            melody.advanceTick(0.2);
            melody.note('C4', 0.125).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // 0.2 rounds to 0.25 (nearest 0.125 grid)
            expect(noteOps[0].tick).toBeCloseTo(0.25, 5);
        });
    });

    describe('Pipeline order: Quantize → Groove → Humanize', () => {
        it('quantization happens before humanization', () => {
            // With both quantize and humanize, quantize should happen first
            const melody1 = new SynapticMelody(mockBridge);
            melody1.quantize(0.25);
            melody1.defaultHumanize({ timing: 5, seed: 42 });
            melody1.advanceTick(0.3);
            melody1.note('C4', 0.25).commit();

            const melody2 = new SynapticMelody(mockBridge);
            melody2.quantize(0.25);
            melody2.defaultHumanize({ timing: 5, seed: 42 });
            melody2.advanceTick(0.3);
            melody2.note('C4', 0.25).commit();

            const result1 = melody1.build();
            const result2 = melody2.build();

            const note1 = result1.operations[0] as NoteOperation;
            const note2 = result2.operations[0] as NoteOperation;

            // Same seed should produce same result
            expect(note1.tick).toBe(note2.tick);

            // Tick should be near 0.25 (quantized) but not exactly (humanized)
            expect(note1.tick).toBeCloseTo(0.25, 1);
        });

        it('precise() still skips humanization with quantize enabled', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25);
            melody.defaultHumanize({ timing: 20, seed: 42 });

            melody.advanceTick(0.3);
            melody.note('C4', 0.25).precise().commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should be exactly quantized (no humanization)
            expect(noteOps[0].tick).toBeCloseTo(0.25, 5);
        });
    });

    describe('SynapticDrums quantization', () => {
        it('quantizes drum hits', () => {
            const drums = new SynapticDrums(mockBridge);
            drums.quantize(0.25);

            drums.advanceTick(0.3);
            drums.kick(0.25).commit();

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].tick).toBeCloseTo(0.25, 5);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().quantize() works', () => {
            const melody = Clip.melody('test').quantize(0.25, { strength: 0.8 });
            melody.advanceTick(0.3);
            const result = melody.note('C4', 0.25).build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            // Should be between 0.25 and 0.3 at 80% strength
            expect(noteOps[0].tick).toBeCloseTo(0.26, 2);
        });

        it('Clip.drums().quantize() works', () => {
            const drums = Clip.drums('test').quantize(0.25);
            drums.advanceTick(0.4);
            const result = drums.kick(0.25).build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].tick).toBeCloseTo(0.5, 5);
        });
    });

    describe('Edge cases', () => {
        it('quantize at tick 0', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].tick).toBeCloseTo(0, 5);
        });

        it('no quantization when settings is null', () => {
            const melody = new SynapticMelody(mockBridge);
            // No quantize call

            melody.advanceTick(0.3);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should stay at original tick
            expect(noteOps[0].tick).toBeCloseTo(0.3, 5);
        });

        it('handles very small grid', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.0625); // 64th notes

            melody.advanceTick(0.1);
            melody.note('C4', 0.0625).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // 0.1 rounds to 0.125 (nearest 0.0625 multiple)
            expect(noteOps[0].tick).toBeCloseTo(0.125, 5);
        });

        it('handles large tick values', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.quantize(0.25);

            melody.advanceTick(100.3);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].tick).toBeCloseTo(100.25, 5);
        });
    });
});
