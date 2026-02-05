import { SynapticMelody } from '../clips/SynapticMelody';
import { SynapticDrums } from '../clips/SynapticDrums';
import { Clip } from '../Clip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { CCOperation, NoteOperation } from '../types';

describe('Control CC (Task 033)', () => {
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
    });

    describe('SynapticClip.control()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.control(1, 64);
            expect(result).toBe(melody);
        });

        it('queues CC operation at current tick', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64);

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(1);
            expect(ccOps[0].controller).toBe(1);
            expect(ccOps[0].value).toBe(64);
            expect(ccOps[0].tick).toBe(0);
        });

        it('queues CC at correct tick position', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.advanceTick(2);
            melody.control(7, 100);

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].tick).toBe(2);
        });

        it('allows multiple CC operations', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64);   // Mod wheel
            melody.control(7, 100);  // Volume
            melody.control(10, 64);  // Pan

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(3);
            expect(ccOps[0].controller).toBe(1);
            expect(ccOps[1].controller).toBe(7);
            expect(ccOps[2].controller).toBe(10);
        });

        it('preserves order with notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64);
            melody.note('C4', 0.5).commit();
            melody.advanceTick(0.5);
            melody.control(1, 127);
            melody.note('D4', 0.5).commit();

            const result = melody.build();

            // Should be: CC, Note, CC, Note
            expect(result.operations[0].kind).toBe('cc');
            expect(result.operations[1].kind).toBe('note');
            expect(result.operations[2].kind).toBe('cc');
            expect(result.operations[3].kind).toBe('note');
        });
    });

    describe('Value validation', () => {
        it('accepts controller 0', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(0, 64)).not.toThrow();
        });

        it('accepts controller 127', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(127, 64)).not.toThrow();
        });

        it('rejects controller < 0', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(-1, 64)).toThrow('Controller number must be 0-127');
        });

        it('rejects controller > 127', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(128, 64)).toThrow('Controller number must be 0-127');
        });

        it('accepts value 0', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(1, 0)).not.toThrow();
        });

        it('accepts value 127', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(1, 127)).not.toThrow();
        });

        it('rejects value < 0', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(1, -1)).toThrow('CC value must be 0-127');
        });

        it('rejects value > 127', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(1, 128)).toThrow('CC value must be 0-127');
        });
    });

    describe('Common CC numbers', () => {
        it('CC1 Modulation', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64);

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].controller).toBe(1);
        });

        it('CC7 Volume', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(7, 100);

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].controller).toBe(7);
        });

        it('CC10 Pan', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(10, 64);

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].controller).toBe(10);
        });

        it('CC64 Sustain', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(64, 127); // Sustain on

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].controller).toBe(64);
            expect(ccOps[0].value).toBe(127);
        });

        it('CC74 Brightness', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(74, 80);

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].controller).toBe(74);
        });
    });

    describe('Cursor escape', () => {
        it('control() from cursor commits and returns clip', () => {
            const melody = new SynapticMelody(mockBridge);
            const cursor = melody.note('C4', 0.5);

            // Control escape should commit pending note and return clip
            const clip = cursor.control(1, 64);

            expect(clip).toBe(melody);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(noteOps).toHaveLength(1);
            expect(ccOps).toHaveLength(1);
        });

        it('chained cursor control works', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody
                .control(1, 64)
                .control(7, 100);
            melody.note('D4', 0.5).commit();

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(2);
        });
    });

    describe('SynapticDrums', () => {
        it('control works on drum clips', () => {
            const drums = new SynapticDrums(mockBridge);
            drums.control(7, 100);
            drums.kick(0.25).commit();

            const result = drums.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(ccOps).toHaveLength(1);
            expect(noteOps).toHaveLength(1);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().control() works', () => {
            const result = Clip.melody('test')
                .control(1, 64)
                .note('C4', 0.5)
                .build();

            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];
            expect(ccOps).toHaveLength(1);
            expect(ccOps[0].controller).toBe(1);
            expect(ccOps[0].value).toBe(64);
        });

        it('Clip.drums().control() works', () => {
            const result = Clip.drums('test')
                .control(7, 80)
                .kick(0.25)
                .build();

            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];
            expect(ccOps).toHaveLength(1);
        });
    });

    describe('Edge cases', () => {
        it('empty clip with only CC operations', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64);
            melody.control(7, 100);

            const result = melody.build();

            expect(result.operations).toHaveLength(2);
            expect(result.operations.every(op => op.kind === 'cc')).toBe(true);
        });

        it('same CC at different ticks', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 0);
            melody.advanceTick(1);
            melody.control(1, 64);
            melody.advanceTick(1);
            melody.control(1, 127);

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(3);
            expect(ccOps[0].tick).toBe(0);
            expect(ccOps[0].value).toBe(0);
            expect(ccOps[1].tick).toBe(1);
            expect(ccOps[1].value).toBe(64);
            expect(ccOps[2].tick).toBe(2);
            expect(ccOps[2].value).toBe(127);
        });

        it('multiple CC controllers at same tick', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64);
            melody.control(7, 100);
            melody.control(10, 32);

            const result = melody.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(3);
            ccOps.forEach(op => {
                expect(op.tick).toBe(0);
            });
        });
    });
});
