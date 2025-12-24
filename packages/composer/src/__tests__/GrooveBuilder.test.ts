import { GrooveBuilder } from '../GrooveBuilder';

describe('GrooveBuilder', () => {
    test('Default values', () => {
        const groove = new GrooveBuilder().build();
        expect(groove.swing).toBe(0.5);
        expect(groove.steps).toBe(4);
    });

    test('Immutability: .swing() returns new instance', () => {
        const g1 = new GrooveBuilder();
        const g2 = g1.swing(0.66);
        expect(g1).not.toBe(g2);
        expect(g1.build().swing).toBe(0.5);
        expect(g2.build().swing).toBe(0.66);
    });

    test('Immutability: .build() returns frozen object', () => {
        const groove = new GrooveBuilder().swing(0.6).build();
        expect(() => { (groove as any).swing = 0.7; }).toThrow();
    });

    test('Validation: swing out of range', () => {
        expect(() => new GrooveBuilder(1.5, 4)).toThrow('Swing must be 0-1');
    });

    test('Validation: steps < 1', () => {
        expect(() => new GrooveBuilder(0.5, 0)).toThrow('Steps must be >= 1');
    });

    test('Fluent chaining', () => {
        const groove = new GrooveBuilder()
            .swing(0.55)
            .steps(16)
            .build();
        expect(groove.swing).toBe(0.55);
        expect(groove.steps).toBe(16);
    });
});
