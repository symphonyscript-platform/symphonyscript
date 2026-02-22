import { SynapticMelody } from '../clips/SynapticMelody';
import { Clip } from '../Clip';
import { createTestBridge } from '../test-bridge';

/**
 * Task 063: isolate() removed. Tests use pushState/popState (zero-allocation).
 */
describe('Isolate (Task 063: pushState/popState)', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
    });

    describe('SynapticClip.pushState/popState', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.pushState({ tempo: true });
            melody.note('C4', 0.5).commit();
            const result = melody.popState({ tempo: true });
            expect(result).toBe(melody);
        });

        it('notes from scope appear in build', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.pushState({ tempo: true });
            melody.note('C4', 0.5).commit();
            melody.popState({ tempo: true });

            const result = melody.build();
            expect(result.operations).toHaveLength(1);
            expect(result.operations[0].kind).toBe('note');
        });

        it('multiple notes in scope appear in build', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.pushState({ tempo: true });
            melody.note('C4', 0.5).commit();
            melody.advanceTick(0.5);
            melody.note('D4', 0.5).commit();
            melody.popState({ tempo: true });

            const result = melody.build();
            expect(result.operations).toHaveLength(2);
            expect(result.operations[0].kind).toBe('note');
            expect(result.operations[1].kind).toBe('note');
        });

        it('pushState/popState options restore state', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(100);
            melody.pushState({ tempo: true, dynamics: true });
            melody.tempo(200);
            melody.note('C4', 0.5).commit();
            melody.popState({ tempo: true, dynamics: true });

            const result = melody.build();
            expect(result.tempo).toBe(100);
        });
    });

    describe('Tempo isolation', () => {
        it('restores tempo after scope', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(120);

            melody.pushState({ tempo: true });
            melody.tempo(180);
            melody.note('C4', 0.5).commit();
            melody.popState({ tempo: true });

            const result = melody.build();
            expect(result.tempo).toBe(120);
        });

        it('tempo change persists without isolation', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(120);
            melody.note('C4', 0.5).commit();
            melody.tempo(180);

            const result = melody.build();
            expect(result.tempo).toBe(180);
        });
    });

    describe('Time signature isolation', () => {
        it('restores time signature after scope', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.timeSignature(4, 4);

            melody.pushState({ timeSignature: true });
            melody.timeSignature(3, 4);
            melody.note('C4', 0.5).commit();
            melody.popState({ timeSignature: true });

            const result = melody.build();
            expect(result.timeSignature).toEqual([4, 4]);
        });

        it('time signature change persists without isolation', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.timeSignature(4, 4);
            melody.timeSignature(6, 8);
            melody.note('C4', 0.5).commit();

            const result = melody.build();
            expect(result.timeSignature).toEqual([6, 8]);
        });
    });

    describe('Multiple isolations', () => {
        it('multiple isolated scopes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(120);

            melody.pushState({ tempo: true });
            melody.tempo(140);
            melody.note('C4', 0.5).commit();
            melody.popState({ tempo: true });

            melody.pushState({ tempo: true });
            melody.tempo(160);
            melody.note('D4', 0.5).commit();
            melody.popState({ tempo: true });

            const result = melody.build();
            expect(result.operations).toHaveLength(2);
            expect(result.operations.every(op => op.kind === 'note')).toBe(true);
            expect(result.tempo).toBe(120);
        });

        it('nested isolations (inner scope)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(100);

            melody.pushState({ tempo: true });
            melody.tempo(150);
            melody.note('C4', 0.5).commit();
            melody.popState({ tempo: true });

            const result = melody.build();
            expect(result.tempo).toBe(100);
        });
    });

    describe('Mixed operations', () => {
        it('operations before and after scope', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('A4', 0.5).commit();

            melody.pushState({ tempo: true });
            melody.note('B4', 0.5).commit();
            melody.popState({ tempo: true });

            melody.advanceTick(0.5);
            melody.note('C4', 0.5).commit();

            const result = melody.build();
            expect(result.operations).toHaveLength(3);
            expect(result.operations.every(op => op.kind === 'note')).toBe(true);
        });
    });

    describe('Cursor escape', () => {
        it('pushState/popState from cursor commits and returns clip', () => {
            const melody = new SynapticMelody(mockBridge);
            const cursor = melody.note('C4', 0.5);

            cursor.pushState({ tempo: true });
            cursor.note('D4', 0.5).commit();
            const clip = cursor.popState({ tempo: true });

            expect(clip).toBe(melody);

            const result = melody.build();
            expect(result.operations).toHaveLength(2);
            expect(result.operations.every(op => op.kind === 'note')).toBe(true);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().pushState/popState works', () => {
            const melody = Clip.melody('test');
            melody.tempo(120);
            melody.pushState({ tempo: true });
            melody.tempo(180);
            melody.note('C4', 0.5).commit();
            melody.popState({ tempo: true });

            const result = melody.build();
            expect(result.operations).toHaveLength(1);
            expect(result.operations[0].kind).toBe('note');
            expect(result.tempo).toBe(120);
        });
    });

    describe('Edge cases', () => {
        it('empty scope', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.pushState({ tempo: true }).popState({ tempo: true });

            const result = melody.build();
            expect(result.operations).toHaveLength(0);
        });

        it('scope with only CC operations returns no notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.pushState({ tempo: true });
            melody.control(1, 64);
            melody.popState({ tempo: true });

            const result = melody.build();
            expect(result.operations).toHaveLength(0);
        });

        it('all isolation options', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(100);
            melody.timeSignature(4, 4);

            melody.pushState({ tempo: true, dynamics: true, timeSignature: true });
            melody.tempo(200);
            melody.timeSignature(7, 8);
            melody.note('C4', 0.5).commit();
            melody.popState({ tempo: true, dynamics: true, timeSignature: true });

            const result = melody.build();
            expect(result.tempo).toBe(100);
            expect(result.timeSignature).toEqual([4, 4]);
        });
    });

    describe('Stack overflow protection', () => {
        it('throws on stack overflow', () => {
            const melody = new SynapticMelody(mockBridge);
            for (let i = 0; i < 16; i++) {
                melody.pushState({ tempo: true });
            }
            expect(() => melody.pushState({ tempo: true })).toThrow('state stack overflow');
        });

        it('throws on stack underflow', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.popState({ tempo: true })).toThrow('state stack underflow');
        });
    });
});
