import { SynapticMelody } from '../clips/SynapticMelody';
import { SynapticDrums } from '../clips/SynapticDrums';
import { Clip } from '../Clip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { AutomationOperation, NoteOperation } from '../types';

describe('Automation (Task 035)', () => {
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
    });

    describe('SynapticClip.automate()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.automate('volume', 0.5);
            expect(result).toBe(melody);
        });

        it('queues automation operation at current tick', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.automate('volume', 0.8);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps).toHaveLength(1);
            expect(autoOps[0].target).toBe('volume');
            expect(autoOps[0].value).toBe(0.8);
            expect(autoOps[0].tick).toBe(0);
        });

        it('queues at correct tick position', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.advanceTick(2);
            melody.automate('pan', 0.5);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].tick).toBe(2);
        });

        it('stores rampBeats', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.automate('volume', 1.0, 4);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].rampBeats).toBe(4);
        });

        it('stores curve type', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.automate('filter', 0.7, 2, 'exponential');

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].curve).toBe('exponential');
        });
    });

    describe('Automation targets', () => {
        const targets: Array<'volume' | 'pan' | 'filter' | 'resonance' | 'attack' | 'release'> = 
            ['volume', 'filter', 'resonance', 'attack', 'release'];

        targets.forEach(target => {
            it(`supports ${target} target`, () => {
                const melody = new SynapticMelody(mockBridge);
                melody.automate(target, 0.5);

                const result = melody.build();
                const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

                expect(autoOps[0].target).toBe(target);
            });
        });

        it('supports pan target with negative value', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.automate('pan', -0.5);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].target).toBe('pan');
            expect(autoOps[0].value).toBe(-0.5);
        });
    });

    describe('Value validation', () => {
        describe('volume', () => {
            it('accepts 0', () => {
                const melody = new SynapticMelody(mockBridge);
                expect(() => melody.automate('volume', 0)).not.toThrow();
            });

            it('accepts 1', () => {
                const melody = new SynapticMelody(mockBridge);
                expect(() => melody.automate('volume', 1)).not.toThrow();
            });

            it('rejects < 0', () => {
                const melody = new SynapticMelody(mockBridge);
                expect(() => melody.automate('volume', -0.1)).toThrow('volume value must be 0-1');
            });

            it('rejects > 1', () => {
                const melody = new SynapticMelody(mockBridge);
                expect(() => melody.automate('volume', 1.1)).toThrow('volume value must be 0-1');
            });
        });

        describe('pan', () => {
            it('accepts -1', () => {
                const melody = new SynapticMelody(mockBridge);
                expect(() => melody.automate('pan', -1)).not.toThrow();
            });

            it('accepts 0', () => {
                const melody = new SynapticMelody(mockBridge);
                expect(() => melody.automate('pan', 0)).not.toThrow();
            });

            it('accepts 1', () => {
                const melody = new SynapticMelody(mockBridge);
                expect(() => melody.automate('pan', 1)).not.toThrow();
            });

            it('rejects < -1', () => {
                const melody = new SynapticMelody(mockBridge);
                expect(() => melody.automate('pan', -1.1)).toThrow('Pan value must be -1 to 1');
            });

            it('rejects > 1', () => {
                const melody = new SynapticMelody(mockBridge);
                expect(() => melody.automate('pan', 1.1)).toThrow('Pan value must be -1 to 1');
            });
        });
    });

    describe('Curve types', () => {
        it('linear curve', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.automate('volume', 1.0, 4, 'linear');

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].curve).toBe('linear');
        });

        it('exponential curve', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.automate('volume', 1.0, 4, 'exponential');

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].curve).toBe('exponential');
        });

        it('smooth curve', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.automate('volume', 1.0, 4, 'smooth');

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].curve).toBe('smooth');
        });

        it('undefined curve when not specified', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.automate('volume', 1.0, 4);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].curve).toBeUndefined();
        });
    });

    describe('volume() shorthand', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.volume(0.5);
            expect(result).toBe(melody);
        });

        it('creates volume automation', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.volume(0.7);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].target).toBe('volume');
            expect(autoOps[0].value).toBe(0.7);
        });

        it('supports rampBeats', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.volume(1.0, 2);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].rampBeats).toBe(2);
        });
    });

    describe('pan() shorthand', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.pan(0);
            expect(result).toBe(melody);
        });

        it('creates pan automation', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.pan(-0.5);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].target).toBe('pan');
            expect(autoOps[0].value).toBe(-0.5);
        });

        it('supports rampBeats', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.pan(1, 4);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].rampBeats).toBe(4);
        });
    });

    describe('Cursor escapes', () => {
        it('automate() from cursor commits and returns clip', () => {
            const melody = new SynapticMelody(mockBridge);
            const cursor = melody.note('C4', 0.5);

            const clip = cursor.automate('volume', 0.8);

            expect(clip).toBe(melody);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(noteOps).toHaveLength(1);
            expect(autoOps).toHaveLength(1);
        });

        it('volume() from cursor works', () => {
            const melody = new SynapticMelody(mockBridge);
            const clip = melody.note('C4', 0.5).volume(0.5);

            expect(clip).toBe(melody);
        });

        it('pan() from cursor works', () => {
            const melody = new SynapticMelody(mockBridge);
            const clip = melody.note('C4', 0.5).pan(-0.3);

            expect(clip).toBe(melody);
        });
    });

    describe('Order with notes', () => {
        it('preserves order with notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.volume(0.5);
            melody.note('C4', 0.5).commit();
            melody.advanceTick(0.5);
            melody.volume(1.0, 2);
            melody.note('D4', 0.5).commit();

            const result = melody.build();

            expect(result.operations[0].kind).toBe('automation');
            expect(result.operations[1].kind).toBe('note');
            expect(result.operations[2].kind).toBe('automation');
            expect(result.operations[3].kind).toBe('note');
        });
    });

    describe('SynapticDrums', () => {
        it('automation works on drum clips', () => {
            const drums = new SynapticDrums(mockBridge);
            drums.volume(0.8);
            drums.kick(0.25).commit();

            const result = drums.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(autoOps).toHaveLength(1);
            expect(noteOps).toHaveLength(1);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().volume() works', () => {
            const result = Clip.melody('test')
                .volume(0.5)
                .note('C4', 0.5)
                .build();

            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];
            expect(autoOps).toHaveLength(1);
            expect(autoOps[0].target).toBe('volume');
        });

        it('Clip.melody().pan() works', () => {
            const result = Clip.melody('test')
                .pan(-0.7)
                .note('C4', 0.5)
                .build();

            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];
            expect(autoOps).toHaveLength(1);
            expect(autoOps[0].target).toBe('pan');
            expect(autoOps[0].value).toBe(-0.7);
        });
    });

    describe('Edge cases', () => {
        it('empty clip with only automation', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.volume(0.5);
            melody.pan(0);

            const result = melody.build();

            expect(result.operations).toHaveLength(2);
            expect(result.operations.every(op => op.kind === 'automation')).toBe(true);
        });

        it('multiple automation at different ticks', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.volume(0);
            melody.advanceTick(1);
            melody.volume(0.5, 1);
            melody.advanceTick(1);
            melody.volume(1);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps).toHaveLength(3);
            expect(autoOps[0].tick).toBe(0);
            expect(autoOps[0].value).toBe(0);
            expect(autoOps[1].tick).toBe(1);
            expect(autoOps[1].value).toBe(0.5);
            expect(autoOps[2].tick).toBe(2);
            expect(autoOps[2].value).toBe(1);
        });

        it('instant automation (no ramp)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.volume(0.8);

            const result = melody.build();
            const autoOps = result.operations.filter(op => op.kind === 'automation') as AutomationOperation[];

            expect(autoOps[0].rampBeats).toBeUndefined();
        });
    });
});
