import { WindBuilder } from '../clips/WindBuilder';
import { Clip } from '../Clip';
import { ScaleMode } from '../types';
import { createTestBridge } from '../test-bridge';

describe('WindBuilder', () => {
    let wind: WindBuilder;
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
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
        it('returns this for chaining', () => {
            const result = wind.breath(0.5);
            expect(result).toBe(wind);
        });

        it('throws for amount < 0', () => {
            expect(() => wind.breath(-0.1)).toThrow('breath() amount must be 0-1, got -0.1');
        });

        it('throws for amount > 1', () => {
            expect(() => wind.breath(1.5)).toThrow('breath() amount must be 0-1, got 1.5');
        });
    });

    describe('expressionCC()', () => {
        it('returns this for chaining', () => {
            const result = wind.expressionCC(0.5);
            expect(result).toBe(wind);
        });

        it('throws for amount < 0', () => {
            expect(() => wind.expressionCC(-0.1)).toThrow('expressionCC() amount must be 0-1, got -0.1');
        });

        it('throws for amount > 1', () => {
            expect(() => wind.expressionCC(1.5)).toThrow('expressionCC() amount must be 0-1, got 1.5');
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

        it('full workflow with factory produces notes', () => {
            const flute = Clip.wind('Flute')
                .breath(0.8)
                .note('C5', 1).rest(1)
                .expressionCC(0.6)
                .note('D5', 1).rest(1);

            const result = flute.build();
            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
        });
    });

    describe('chaining with melody methods', () => {
        it('breath chains with note methods', () => {
            wind.setScale('C', ScaleMode.MAJOR);
            wind.breath(0.9);
            wind.degree(1, 1).commit();
            wind.advanceTick(1);
            wind.degree(2, 1).commit();
            wind.expressionCC(0.7);

            const result = wind.build();
            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
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
});
