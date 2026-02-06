import { SynapticMelody } from '../clips/SynapticMelody';
import { SynapticDrums } from '../clips/SynapticDrums';
import { Clip } from '../Clip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { AftertouchOperation, NoteOperation } from '../types';

describe('Aftertouch (Task 034)', () => {
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
    });

    describe('SynapticClip.aftertouch()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.aftertouch(0.5);
            expect(result).toBe(melody);
        });

        it('queues channel aftertouch by default', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.5);

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps).toHaveLength(1);
            expect(atOps[0].type).toBe('channel');
            expect(atOps[0].value).toBe(64); // 0.5 * 127 = 63.5 -> 64
            expect(atOps[0].note).toBeUndefined();
            expect(atOps[0].tick).toBe(0);
        });

        it('queues at correct tick position', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.advanceTick(2);
            melody.aftertouch(0.8);

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps[0].tick).toBe(2);
        });
    });

    describe('Value scaling', () => {
        it('scales 0 to 0', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0);

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps[0].value).toBe(0);
        });

        it('scales 1 to 127', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(1);

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps[0].value).toBe(127);
        });

        it('scales 0.5 to ~64', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.5);

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps[0].value).toBe(64);
        });

        it('rounds to nearest integer', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.75); // 0.75 * 127 = 95.25 -> 95

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps[0].value).toBe(95);
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
            melody.aftertouch(0.6, { type: 'channel' });

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps[0].type).toBe('channel');
            expect(atOps[0].note).toBeUndefined();
        });

        it('channel aftertouch ignores note parameter', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.6, { type: 'channel', note: 'C4' });

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            // Note is stored but type is still channel
            expect(atOps[0].type).toBe('channel');
            expect(atOps[0].note).toBe(60); // C4
        });
    });

    describe('Poly aftertouch', () => {
        it('poly type with string note', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.7, { type: 'poly', note: 'C4' });

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps[0].type).toBe('poly');
            expect(atOps[0].note).toBe(60); // C4
        });

        it('poly type with numeric note', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.7, { type: 'poly', note: 64 });

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps[0].type).toBe('poly');
            expect(atOps[0].note).toBe(64);
        });

        it('poly type requires note', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.aftertouch(0.7, { type: 'poly' })).toThrow('Poly aftertouch requires a note parameter');
        });

        it('parses various note names', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.5, { type: 'poly', note: 'D#5' });

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps[0].note).toBe(75); // D#5
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

            expect(result.operations[0].kind).toBe('note');
            expect(result.operations[1].kind).toBe('aftertouch');
            expect(result.operations[2].kind).toBe('note');
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
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(noteOps).toHaveLength(1);
            expect(atOps).toHaveLength(1);
        });

        it('chained cursor aftertouch works', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody
                .aftertouch(0.5)
                .aftertouch(0.8);

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps).toHaveLength(2);
        });
    });

    describe('SynapticDrums', () => {
        it('aftertouch works on drum clips', () => {
            const drums = new SynapticDrums(mockBridge);
            drums.aftertouch(0.6);
            drums.kick(0.25).commit();

            const result = drums.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(atOps).toHaveLength(1);
            expect(noteOps).toHaveLength(1);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().aftertouch() works', () => {
            const result = Clip.melody('test')
                .aftertouch(0.5)
                .note('C4', 0.5)
                .build();

            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];
            expect(atOps).toHaveLength(1);
            expect(atOps[0].type).toBe('channel');
        });

        it('Clip.melody() poly aftertouch works', () => {
            const result = Clip.melody('test')
                .aftertouch(0.7, { type: 'poly', note: 'E4' })
                .note('E4', 0.5)
                .build();

            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];
            expect(atOps).toHaveLength(1);
            expect(atOps[0].type).toBe('poly');
            expect(atOps[0].note).toBe(64); // E4
        });
    });

    describe('Edge cases', () => {
        it('empty clip with only aftertouch', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.5);
            melody.aftertouch(0.8);

            const result = melody.build();

            expect(result.operations).toHaveLength(2);
            expect(result.operations.every(op => op.kind === 'aftertouch')).toBe(true);
        });

        it('multiple aftertouch at different ticks', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0);
            melody.advanceTick(1);
            melody.aftertouch(0.5);
            melody.advanceTick(1);
            melody.aftertouch(1);

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps).toHaveLength(3);
            expect(atOps[0].tick).toBe(0);
            expect(atOps[0].value).toBe(0);
            expect(atOps[1].tick).toBe(1);
            expect(atOps[1].value).toBe(64);
            expect(atOps[2].tick).toBe(2);
            expect(atOps[2].value).toBe(127);
        });

        it('mixed channel and poly aftertouch', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.aftertouch(0.5); // Channel
            melody.aftertouch(0.7, { type: 'poly', note: 'C4' }); // Poly
            melody.aftertouch(0.3); // Channel

            const result = melody.build();
            const atOps = result.operations.filter(op => op.kind === 'aftertouch') as AftertouchOperation[];

            expect(atOps).toHaveLength(3);
            expect(atOps[0].type).toBe('channel');
            expect(atOps[1].type).toBe('poly');
            expect(atOps[2].type).toBe('channel');
        });
    });
});
