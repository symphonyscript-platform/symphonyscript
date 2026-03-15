import { SynapticMelody } from '../clips/SynapticMelody'
import { SynapticDrums } from '../clips/SynapticDrums'
import { Clip } from '../Clip'
import { NoteOperation, ScaleMode } from '../types'
import { createTestBridge } from '../test-bridge'

describe('Default Duration (Task 030)', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
    });

    describe('SynapticClip.defaultDuration()', () => {
        it('defaults to 1 beat when not set', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(melody.getDefaultDuration()).toBe(1);
        });

        it('sets default duration', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultDuration(0.5);
            expect(melody.getDefaultDuration()).toBe(0.5);
        });

        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.defaultDuration(0.25);
            expect(result).toBe(melody);
        });
    });

    describe('SynapticMelody note()', () => {
        let melody: SynapticMelody;

        beforeEach(() => {
            melody = new SynapticMelody(mockBridge);
        });

        it('uses default duration when not specified', () => {
            melody.defaultDuration(0.5);
            melody.note('C4').commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBe(0.5);
        });

        it('uses 1 beat when default not set and duration not specified', () => {
            melody.note('C4').commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBe(1);
        });

        it('explicit duration overrides default', () => {
            melody.defaultDuration(0.5);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBe(0.25);
        });

        it('applies default to multiple notes', () => {
            melody.defaultDuration(0.125);
            melody.note('C4').commit();
            melody.advanceTick(0.125);
            melody.note('D4').commit();
            melody.advanceTick(0.125);
            melody.note('E4').commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(3);
            expect(noteOps[0].duration).toBe(0.125);
            expect(noteOps[1].duration).toBe(0.125);
            expect(noteOps[2].duration).toBe(0.125);
        });

        it('can change default mid-composition', () => {
            melody.defaultDuration(0.25);
            melody.note('C4').commit();
            melody.advanceTick(0.25);

            melody.defaultDuration(0.5);
            melody.note('D4').commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBe(0.25);
            expect(noteOps[1].duration).toBe(0.5);
        });
    });

    describe('SynapticMelody degree()', () => {
        let melody: SynapticMelody;

        beforeEach(() => {
            melody = new SynapticMelody(mockBridge);
            melody.setScale('C', ScaleMode.MAJOR);
        });

        it('uses default duration when not specified', () => {
            melody.defaultDuration(0.5);
            melody.degree(1).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBe(0.5);
        });

        it('explicit duration overrides default', () => {
            melody.defaultDuration(0.5);
            melody.degree(1, 0.25).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBe(0.25);
        });
    });

    describe('SynapticDrums', () => {
        let drums: SynapticDrums;

        beforeEach(() => {
            drums = new SynapticDrums(mockBridge);
        });

        it('uses default duration when not specified', () => {
            drums.defaultDuration(0.125);
            drums.kick().commit();

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBe(0.125);
        });

        it('explicit duration overrides default', () => {
            drums.defaultDuration(0.125);
            drums.kick(0.5).commit();

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBe(0.5);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().defaultDuration() works', () => {
            const result = Clip.melody('test')
                .defaultDuration(0.5)
                .note('C4').rest(0.5)
                .note('D4').rest(0.5)
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].duration).toBe(0.5);
            expect(noteOps[1].duration).toBe(0.5);
        });

        it('Clip.drums().defaultDuration() works', () => {
            const result = Clip.drums('test')
                .defaultDuration(0.125)
                .kick().rest(0.125)
                .snare().rest(0.125)
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].duration).toBe(0.125);
            expect(noteOps[1].duration).toBe(0.125);
        });
    });

    describe('edge cases', () => {
        it('handles very small durations', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultDuration(0.0625); // 1/16 note
            melody.note('C4').commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBe(0.0625);
        });

        it('handles large durations', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultDuration(4); // Whole note
            melody.note('C4').commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].duration).toBe(4);
        });

        it('overriding with 0 duration uses explicit 0', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.defaultDuration(0.5);
            melody.note('C4', 0).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Even 0 is an explicit duration and should be used
            expect(noteOps[0].duration).toBe(0);
        });
    });
});
