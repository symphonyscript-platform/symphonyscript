import { WindBuilder } from '../clips/WindBuilder';
import { Clip } from '../Clip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { CCOperation } from '../types';

describe('WindBuilder', () => {
    let wind: WindBuilder;
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
        wind = new WindBuilder(mockBridge);
    });

    describe('class structure', () => {
        it('extends SynapticMelody', () => {
            expect(typeof wind.note).toBe('function');
            expect(typeof wind.chord).toBe('function');
            expect(typeof wind.degree).toBe('function');
            expect(typeof wind.key).toBe('function');
        });
    });

    describe('breath()', () => {
        it('queues CC2 = 102 at current tick for amount 0.8', () => {
            wind.breath(0.8);

            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(1);
            expect(ccOps[0].controller).toBe(2);
            expect(ccOps[0].value).toBe(101); // floor(0.8 * 127) = 101
            expect(ccOps[0].tick).toBe(0);
        });

        it('queues CC2 = 127 for amount 1.0', () => {
            wind.breath(1.0);

            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].value).toBe(127);
        });

        it('queues CC2 = 0 for amount 0.0', () => {
            wind.breath(0.0);

            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].value).toBe(0);
        });

        it('returns this for chaining', () => {
            const result = wind.breath(0.5);
            expect(result).toBe(wind);
        });

        it('records tick position correctly', () => {
            wind.note('C4', 1).commit();
            wind.advanceTick(1);
            wind.breath(0.7);

            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].tick).toBe(1);
        });

        it('throws for amount < 0', () => {
            expect(() => wind.breath(-0.1)).toThrow('breath() amount must be 0-1, got -0.1');
        });

        it('throws for amount > 1', () => {
            expect(() => wind.breath(1.5)).toThrow('breath() amount must be 0-1, got 1.5');
        });
    });

    describe('expressionCC()', () => {
        it('queues CC11 = 63 at current tick for amount 0.5', () => {
            wind.expressionCC(0.5);

            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(1);
            expect(ccOps[0].controller).toBe(11);
            expect(ccOps[0].value).toBe(63); // floor(0.5 * 127) = 63
            expect(ccOps[0].tick).toBe(0);
        });

        it('queues CC11 = 127 for amount 1.0', () => {
            wind.expressionCC(1.0);

            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].value).toBe(127);
        });

        it('queues CC11 = 0 for amount 0.0', () => {
            wind.expressionCC(0.0);

            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].value).toBe(0);
        });

        it('returns this for chaining', () => {
            const result = wind.expressionCC(0.5);
            expect(result).toBe(wind);
        });

        it('records tick position correctly', () => {
            wind.note('C4', 1).commit();
            wind.advanceTick(1);
            wind.expressionCC(0.6);

            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].tick).toBe(1);
        });

        it('throws for amount < 0', () => {
            expect(() => wind.expressionCC(-0.1)).toThrow('expressionCC() amount must be 0-1, got -0.1');
        });

        it('throws for amount > 1', () => {
            expect(() => wind.expressionCC(1.5)).toThrow('expressionCC() amount must be 0-1, got 1.5');
        });
    });

    describe('breath + expression workflow', () => {
        it('both CC operations coexist', () => {
            wind.breath(0.8);
            wind.note('C5', 1).commit();
            wind.expressionCC(0.6);

            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(2);
            expect(ccOps[0].controller).toBe(2);  // breath
            expect(ccOps[1].controller).toBe(11); // expression
        });

        it('notes and CC operations coexist in build output', () => {
            wind.breath(0.7);
            wind.note('C5', 1).commit();
            wind.expressionCC(0.5);

            const result = wind.build();
            const noteOps = result.operations.filter(op => op.kind === 'note');
            const ccOps = result.operations.filter(op => op.kind === 'cc');

            expect(noteOps).toHaveLength(1);
            expect(ccOps).toHaveLength(2);
        });
    });

    describe('Clip.wind() factory', () => {
        it('creates a WindBuilder instance', () => {
            const flute = Clip.wind('Flute');

            expect(flute).toBeInstanceOf(WindBuilder);
        });

        it('factory result has breath/expressionCC methods', () => {
            const flute = Clip.wind('Flute');

            expect(typeof flute.breath).toBe('function');
            expect(typeof flute.expressionCC).toBe('function');
        });

        it('full workflow with factory', () => {
            const flute = Clip.wind('Flute')
                .breath(0.8)
                .note('C5', 1).rest(1)
                .expressionCC(0.6)
                .note('D5', 1).rest(1);

            const result = flute.build();

            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
            expect(result.operations.filter(op => op.kind === 'cc').length).toBe(2);
        });
    });

    describe('chaining with melody methods', () => {
        it('breath chains with note methods', () => {
            wind.setScale('C', 'major');
            wind.breath(0.9);
            wind.degree(1, 1).commit();
            wind.advanceTick(1);
            wind.degree(2, 1).commit();
            wind.expressionCC(0.7);

            const result = wind.build();

            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
            expect(result.operations.filter(op => op.kind === 'cc').length).toBe(2);
        });

        it('dynamics work with wind', () => {
            wind.crescendo(4);
            wind.breath(0.8);
            wind.note('C5', 1).commit();
            wind.advanceTick(1);
            wind.note('D5', 1).commit();

            const result = wind.build();
            const notes = result.operations.filter(op => op.kind === 'note');

            expect(notes[0].velocity).toBeLessThan(notes[1].velocity);
        });
    });

    describe('value scaling', () => {
        it('breath(0.8) produces 101 (floor(0.8 * 127))', () => {
            wind.breath(0.8);
            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];
            expect(ccOps[0].value).toBe(101);
        });

        it('expressionCC(0.5) produces 63 (floor(0.5 * 127))', () => {
            wind.expressionCC(0.5);
            const result = wind.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];
            expect(ccOps[0].value).toBe(63);
        });
    });
});
