import { SynapticMelody } from '../clips/SynapticMelody';
import { SynapticDrums } from '../clips/SynapticDrums';
import { Clip } from '../Clip';
import { createTestBridge } from '../test-bridge';
import { NoteOperation } from '../types';

/**
 * Task 058: Aftertouch operations no longer in build().operations.
 * Kernel insertAsync is note-only. Tests verify aftertouch() API and notes.
 */
describe('Aftertouch (Task 034)', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
    });

    describe('SynapticClip.aftertouch()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.aftertouch(0.5);
            expect(result).toBe(melody);
        });

        it('aftertouch does not affect notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.5);
            melody.note('C4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });

        it('aftertouch with advanceTick - notes at correct position', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.advanceTick(2);
            melody.aftertouch(0.8);
            melody.note('C4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].tick).toBe(2);
        });
    });

    describe('Value validation', () => {
        it('accepts value 0', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(0)).not.toThrow();
        });

        it('accepts value 1', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(1)).not.toThrow();
        });

        it('rejects value < 0', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(-0.1)).toThrow('Aftertouch value must be 0-1');
        });

        it('rejects value > 1', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(1.1)).toThrow('Aftertouch value must be 0-1');
        });
    });

    describe('Channel aftertouch', () => {
        it('explicit channel type', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(0.6, { type: 'channel' })).not.toThrow();
        });

        it('channel aftertouch with note option', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(0.6, { type: 'channel', note: 'C4' })).not.toThrow();
        });
    });

    describe('Poly aftertouch', () => {
        it('poly type with string note', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(0.7, { type: 'poly', note: 'C4' })).not.toThrow();
        });

        it('poly type with numeric note', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(0.7, { type: 'poly', note: 64 })).not.toThrow();
        });

        it('poly type requires note', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(0.7, { type: 'poly' })).toThrow('Poly aftertouch requires a note parameter');
        });

        it('parses various note names', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(0.5, { type: 'poly', note: 'D#5' })).not.toThrow();
        });
    });

    describe('Order with notes', () => {
        it('preserves order with notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody.aftertouch(0.8);
            melody.advanceTick(0.5);
            melody.note('D4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].pitch).toBe(60);
            expect(noteOps[1].pitch).toBe(62);
        });
    });

    describe('Cursor escape', () => {
        it('aftertouch() from cursor commits and returns clip', () => {
            const melody = new SynapticMelody(mockBridge);
            const cursor = melody.note('C4', 0.5);

            const clip = cursor.aftertouch(0.8);

            expect(clip).toBe(melody);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });

        it('chained cursor aftertouch works', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody.aftertouch(0.5).aftertouch(0.8);
            melody.note('D4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
        });
    });

    describe('SynapticDrums', () => {
        it('aftertouch works on drum clips', () => {
            const drums = new SynapticDrums(mockBridge);
            drums.aftertouch(0.6);
            drums.kick(0.25).commit();

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().aftertouch() works', () => {
            const result = Clip.melody('test')
                .aftertouch(0.5)
                .note('C4', 0.5)
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });

        it('Clip.melody() poly aftertouch works', () => {
            const result = Clip.melody('test')
                .aftertouch(0.7, { type: 'poly', note: 'E4' })
                .note('E4', 0.5)
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });
    });

    describe('Edge cases', () => {
        it('empty clip with only aftertouch returns no notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.5);
            melody.aftertouch(0.8);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note');
            expect(noteOps).toHaveLength(0);
        });

        it('multiple aftertouch with notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0);
            melody.note('C4', 0.5).commit();
            melody.advanceTick(1);
            melody.aftertouch(0.5);
            melody.note('D4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].tick).toBe(0);
            expect(noteOps[1].tick).toBe(1);
        });

        it('mixed channel and poly aftertouch with note', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.5);
            melody.aftertouch(0.7, { type: 'poly', note: 'C4' });
            melody.aftertouch(0.3);
            melody.note('C4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });
    });
});
