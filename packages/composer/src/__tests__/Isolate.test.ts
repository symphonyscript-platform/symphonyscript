import { SynapticMelody } from '../clips/SynapticMelody';
import { Clip } from '../Clip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { NoteOperation, ScopeOp } from '../types';

describe('Isolate (Task 039)', () => {
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
    });

    describe('SynapticClip.isolate()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.isolate({ tempo: true }, c => {
                c.note('C4', 0.5).commit();
                return c;
            });
            expect(result).toBe(melody);
        });

        it('wraps operations in ScopeOp', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.isolate({ tempo: true }, c => {
                c.note('C4', 0.5).commit();
                return c;
            });

            const result = melody.build();
            expect(result.operations).toHaveLength(1);
            expect(result.operations[0].kind).toBe('scope');
        });

        it('ScopeOp contains isolated operations', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.isolate({ tempo: true }, c => {
                c.note('C4', 0.5).commit();
                c.advanceTick(0.5);
                c.note('D4', 0.5).commit();
                return c;
            });

            const result = melody.build();
            const scopeOp = result.operations[0] as ScopeOp;

            expect(scopeOp.operations).toHaveLength(2);
            expect(scopeOp.operations[0].kind).toBe('note');
            expect(scopeOp.operations[1].kind).toBe('note');
        });

        it('ScopeOp stores isolation options', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.isolate({ tempo: true, dynamics: true }, c => {
                c.note('C4', 0.5).commit();
                return c;
            });

            const result = melody.build();
            const scopeOp = result.operations[0] as ScopeOp;

            expect(scopeOp.isolate.tempo).toBe(true);
            expect(scopeOp.isolate.dynamics).toBe(true);
        });
    });

    describe('Tempo isolation', () => {
        it('restores tempo after scope', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(120);

            melody.isolate({ tempo: true }, c => {
                c.tempo(180);
                c.note('C4', 0.5).commit();
                return c;
            });

            // Tempo should be restored to 120
            const result = melody.build();
            expect(result.tempo).toBe(120);
        });

        it('tempo change persists without isolation', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(120);

            melody.isolate({}, c => { // No tempo isolation
                c.tempo(180);
                c.note('C4', 0.5).commit();
                return c;
            });

            // Tempo should be 180
            const result = melody.build();
            expect(result.tempo).toBe(180);
        });
    });

    describe('Time signature isolation', () => {
        it('restores time signature after scope', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.timeSignature(4, 4);

            melody.isolate({ timeSignature: true }, c => {
                c.timeSignature(3, 4);
                c.note('C4', 0.5).commit();
                return c;
            });

            // Time signature should be restored to 4/4
            const result = melody.build();
            expect(result.timeSignature).toEqual([4, 4]);
        });

        it('time signature change persists without isolation', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.timeSignature(4, 4);

            melody.isolate({}, c => { // No time signature isolation
                c.timeSignature(6, 8);
                c.note('C4', 0.5).commit();
                return c;
            });

            // Time signature should be 6/8
            const result = melody.build();
            expect(result.timeSignature).toEqual([6, 8]);
        });
    });

    describe('Multiple isolations', () => {
        it('multiple isolated scopes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(120);

            melody.isolate({ tempo: true }, c => {
                c.tempo(140);
                c.note('C4', 0.5).commit();
                return c;
            });

            melody.isolate({ tempo: true }, c => {
                c.tempo(160);
                c.note('D4', 0.5).commit();
                return c;
            });

            const result = melody.build();
            expect(result.operations).toHaveLength(2);
            expect(result.operations[0].kind).toBe('scope');
            expect(result.operations[1].kind).toBe('scope');
            expect(result.tempo).toBe(120); // Still 120
        });

        it('nested isolations (inner scope)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(100);

            melody.isolate({ tempo: true }, c => {
                c.tempo(150);
                c.note('C4', 0.5).commit();
                // Note: nested isolate would create another scope
                return c;
            });

            const result = melody.build();
            expect(result.tempo).toBe(100);
        });
    });

    describe('Mixed operations', () => {
        it('operations before and after scope', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('A4', 0.5).commit();

            melody.isolate({ tempo: true }, c => {
                c.note('B4', 0.5).commit();
                return c;
            });

            melody.advanceTick(0.5);
            melody.note('C4', 0.5).commit();

            const result = melody.build();
            expect(result.operations).toHaveLength(3);
            expect(result.operations[0].kind).toBe('note');
            expect(result.operations[1].kind).toBe('scope');
            expect(result.operations[2].kind).toBe('note');
        });
    });

    describe('Cursor escape', () => {
        it('isolate() from cursor commits and returns clip', () => {
            const melody = new SynapticMelody(mockBridge);
            const cursor = melody.note('C4', 0.5);

            const clip = cursor.isolate({ tempo: true }, c => {
                c.note('D4', 0.5).commit();
                return c;
            });

            expect(clip).toBe(melody);

            const result = melody.build();
            expect(result.operations).toHaveLength(2);
            expect(result.operations[0].kind).toBe('note'); // C4 committed
            expect(result.operations[1].kind).toBe('scope'); // D4 in scope
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().isolate() works', () => {
            const melody = Clip.melody('test');
            melody.tempo(120);
            melody.isolate({ tempo: true }, c => {
                c.tempo(180);
                c.note('C4', 0.5).commit();
                return c;
            });

            const result = melody.build();
            expect(result.operations).toHaveLength(1);
            expect(result.operations[0].kind).toBe('scope');
            expect(result.tempo).toBe(120);
        });
    });

    describe('Edge cases', () => {
        it('empty scope', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.isolate({ tempo: true }, c => c);

            const result = melody.build();
            expect(result.operations).toHaveLength(0);
        });

        it('scope with only CC operations', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.isolate({ tempo: true }, c => {
                c.control(1, 64);
                return c;
            });

            const result = melody.build();
            expect(result.operations).toHaveLength(1);
            const scopeOp = result.operations[0] as ScopeOp;
            expect(scopeOp.operations).toHaveLength(1);
            expect(scopeOp.operations[0].kind).toBe('cc');
        });

        it('all isolation options', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(100);
            melody.timeSignature(4, 4);

            melody.isolate({ tempo: true, dynamics: true, timeSignature: true }, c => {
                c.tempo(200);
                c.timeSignature(7, 8);
                c.note('C4', 0.5).commit();
                return c;
            });

            const result = melody.build();
            expect(result.tempo).toBe(100);
            expect(result.timeSignature).toEqual([4, 4]);
        });

        it('builder function returning void', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.isolate({ tempo: true }, c => {
                c.note('C4', 0.5).commit();
                // No return
            });

            const result = melody.build();
            expect(result.operations).toHaveLength(1);
            expect(result.operations[0].kind).toBe('scope');
        });
    });
});
