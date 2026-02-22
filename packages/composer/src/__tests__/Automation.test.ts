import { SynapticMelody } from '../clips/SynapticMelody';
import { SynapticDrums } from '../clips/SynapticDrums';
import { Clip } from '../Clip';
import { NoteOperation, CurveType } from '../types';
import { createTestBridge } from '../test-bridge';

describe('Automation (Task 035)', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
    });

    describe('SynapticClip.automate()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.automate('volume', 0.5);
            expect(result).toBe(melody);
        });

        it('automate does not throw', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.automate('volume', 0.8)).not.toThrow();
        });
    });

    describe('Automation targets', () => {
        const targets: Array<'volume' | 'pan' | 'filter' | 'resonance' | 'attack' | 'release'> = 
            ['volume', 'filter', 'resonance', 'attack', 'release'];

        targets.forEach(target => {
            it(`supports ${target} target`, () => {
                const melody = new SynapticMelody(mockBridge);
                expect(() => melody.automate(target, 0.5)).not.toThrow();
            });
        });

        it('supports pan target with negative value', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.automate('pan', -0.5)).not.toThrow();
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
        it('accepts curve parameter', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.automate('volume', 1.0, 4, CurveType.LINEAR)).not.toThrow();
        });
    });

    describe('volume() shorthand', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.volume(0.5);
            expect(result).toBe(melody);
        });

        it('volume does not throw', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.volume(0.7)).not.toThrow();
        });

        it('supports rampBeats', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.volume(1.0, 2)).not.toThrow();
        });
    });

    describe('pan() shorthand', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.pan(0);
            expect(result).toBe(melody);
        });

        it('pan does not throw', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.pan(-0.5)).not.toThrow();
        });

        it('supports rampBeats', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.pan(1, 4)).not.toThrow();
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

            expect(noteOps).toHaveLength(1);
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
        it('notes work with automation calls', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.volume(0.5);
            melody.note('C4', 0.5).commit();
            melody.advanceTick(0.5);
            melody.volume(1.0, 2);
            melody.note('D4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note');
            expect(noteOps).toHaveLength(2);
        });
    });

    describe('SynapticDrums', () => {
        it('automation works on drum clips', () => {
            const drums = new SynapticDrums(mockBridge);
            drums.volume(0.8);
            drums.kick(0.25).commit();

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().volume() works', () => {
            const result = Clip.melody('test')
                .volume(0.5)
                .note('C4', 0.5)
                .build();

            expect(result.operations.filter(op => op.kind === 'note')).toHaveLength(1);
        });

        it('Clip.melody().pan() works', () => {
            const result = Clip.melody('test')
                .pan(-0.7)
                .note('C4', 0.5)
                .build();

            expect(result.operations.filter(op => op.kind === 'note')).toHaveLength(1);
        });
    });

    describe('Edge cases', () => {
        it('empty clip with only automation', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.volume(0.5);
            melody.pan(0);

            const result = melody.build();
            expect(result.operations).toBeDefined();
        });

        it('multiple automation at different ticks', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.volume(0);
            melody.advanceTick(1);
            melody.volume(0.5, 1);
            melody.advanceTick(1);
            melody.volume(1);

            const result = melody.build();
            expect(result).toBeDefined();
        });

        it('instant automation (no ramp)', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.volume(0.8)).not.toThrow();
        });
    });
});
