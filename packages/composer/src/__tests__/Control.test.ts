import { SynapticMelody } from '../clips/SynapticMelody';
import { SynapticDrums } from '../clips/SynapticDrums';
import { Clip } from '../Clip';
import { NoteOperation } from '../types';
import { createTestBridge } from '../test-bridge';
import { OPCODE } from '@symphonyscript/kernel';

describe('Control CC (Task 033)', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
    });

    describe('Tempo direct write', () => {
        it('tempo() writes BPM directly to the bridge', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(132);

            expect(mockBridge.setBpm).toHaveBeenCalledTimes(1);
            expect(mockBridge.setBpm).toHaveBeenCalledWith(132);
            expect(melody.build().tempo).toBe(132);
        });
    });

    describe('SynapticClip.control()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.control(1, 64);
            expect(result).toBe(melody);
        });

        it('cc() alias emits CC via bridge immediately', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.cc(74, 80);
            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                OPCODE.CC,
                74,
                80,
                0,
                0,
                false,
                expect.any(Number)
            );
        });

        it('pitchBend() emits bend via bridge immediately', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.advanceTick(1.5);
            melody.pitchBend(2048);
            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                OPCODE.BEND,
                2048,
                0,
                0,
                1.5,
                false,
                expect.any(Number)
            );
        });

        it('control does not affect notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64).note('C4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(60);
        });

        it('control with advanceTick - notes at correct position', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.advanceTick(2);
            melody.control(7, 100).note('C4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].tick).toBe(2);
        });

        it('allows multiple control calls', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64).control(7, 100).control(10, 64);
            melody.note('C4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });

        it('preserves order with notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64).note('C4', 0.5).commit();
            melody.advanceTick(0.5);
            melody.control(1, 127).note('D4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].pitch).toBe(60);
            expect(noteOps[1].pitch).toBe(62);
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
            expect(() => melody.control(1, 64)).not.toThrow();
        });

        it('CC7 Volume', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(7, 100)).not.toThrow();
        });

        it('CC10 Pan', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(10, 64)).not.toThrow();
        });

        it('CC64 Sustain', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(64, 127)).not.toThrow();
        });

        it('CC74 Brightness', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.control(74, 80)).not.toThrow();
        });
    });

    describe('Cursor escape', () => {
        it('control() from cursor commits and returns clip', () => {
            const melody = new SynapticMelody(mockBridge);
            const cursor = melody.note('C4', 0.5);

            const clip = cursor.control(1, 64);

            expect(clip).toBe(melody);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });

        it('chained cursor control works', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody.control(1, 64).control(7, 100).note('D4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
        });

        it('cursor cc() and pitchBend() escape to clip', () => {
            const melody = new SynapticMelody(mockBridge);
            const clip = melody.note('C4', 0.5).cc(1, 64).pitchBend(512);
            expect(clip).toBe(melody);
            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                OPCODE.CC,
                1,
                64,
                0,
                0,
                false,
                expect.any(Number)
            );
            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                OPCODE.BEND,
                512,
                0,
                0,
                0,
                false,
                expect.any(Number)
            );
        });
    });

    describe('SynapticDrums', () => {
        it('control works on drum clips', () => {
            const drums = new SynapticDrums(mockBridge);
            drums.control(7, 100).kick(0.25).commit();

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().control() works', () => {
            const result = Clip.melody('test')
                .control(1, 64)
                .note('C4', 0.5)
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });

        it('Clip.drums().control() works', () => {
            const result = Clip.drums('test')
                .control(7, 80)
                .kick(0.25)
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });
    });

    describe('Edge cases', () => {
        it('empty clip with only CC operations returns no notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64).control(7, 100);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note');
            expect(noteOps).toHaveLength(0);
        });

        it('control at different ticks with notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 0).note('C4', 0.5).commit();
            melody.advanceTick(1);
            melody.control(1, 64).note('D4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].tick).toBe(0);
            expect(noteOps[1].tick).toBe(1);
        });

        it('multiple control calls with note', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64).control(7, 100).control(10, 32).note('C4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });
    });
});
