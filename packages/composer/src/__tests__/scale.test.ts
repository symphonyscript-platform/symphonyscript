import { SynapticMelody } from '../clips/SynapticMelody';
import { SiliconBridge } from '@symphonyscript/kernel';

describe('Scale context and degree()', () => {
    let melody: SynapticMelody;
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
        melody = new SynapticMelody(mockBridge);
    });

    describe('setScale()', () => {
        it('sets scale context', () => {
            melody.setScale('G', 'major');

            const ctx = melody.getScaleContext();
            expect(ctx).toEqual({ root: 'G', mode: 'major', octave: 4 });
        });

        it('sets scale context with custom octave', () => {
            melody.setScale('C', 'minor', 5);

            const ctx = melody.getScaleContext();
            expect(ctx).toEqual({ root: 'C', mode: 'minor', octave: 5 });
        });

        it('returns this for chaining', () => {
            const result = melody.setScale('C', 'major');
            expect(result).toBe(melody);
        });
    });

    describe('degree()', () => {
        it('throws without scale context', () => {
            expect(() => melody.degree(1)).toThrow('degree() requires setScale() to be called first');
        });

        it('degree(1) returns root note in C major', () => {
            melody.setScale('C', 'major');
            melody.degree(1, 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(60); // C4
        });

        it('degree(3) returns major third in C major', () => {
            melody.setScale('C', 'major');
            melody.degree(3, 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(64); // E4 (C + 4 semitones)
        });

        it('degree(3) returns minor third in C minor', () => {
            melody.setScale('C', 'minor');
            melody.degree(3, 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(63); // Eb4 (C + 3 semitones)
        });

        it('degree(1) in G major returns G4', () => {
            melody.setScale('G', 'major');
            melody.degree(1, 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(67); // G4
        });

        it('degree(8) wraps to next octave', () => {
            melody.setScale('C', 'major');
            melody.degree(8, 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(72); // C5
        });

        it('octaveOffset shifts octaves', () => {
            melody.setScale('C', 'major');
            melody.degree(1, 0.25, { octaveOffset: 1 }).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(72); // C5 (C4 + 12)
        });

        it('alteration adds/subtracts semitones', () => {
            melody.setScale('C', 'major');
            melody.degree(2, 0.25, { alteration: 1 }).commit(); // D# instead of D

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(63); // D4 + 1 = D#4
        });

        it('negative alteration flattens', () => {
            melody.setScale('C', 'major');
            melody.degree(5, 0.25, { alteration: -1 }).commit(); // Gb instead of G

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66); // G4 - 1 = Gb4
        });

        it('supports all scale modes', () => {
            const modes = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] as const;

            for (const mode of modes) {
                const m = new SynapticMelody(mockBridge);
                m.setScale('C', mode);
                m.degree(1, 0.25).commit();

                expect(m.build().operations[0].pitch).toBe(60); // Root is always C4
            }
        });

        it('dorian has raised 6th compared to minor', () => {
            const minor = new SynapticMelody(mockBridge);
            minor.setScale('C', 'minor');
            minor.degree(6, 0.25).commit();

            const dorian = new SynapticMelody(mockBridge);
            dorian.setScale('C', 'dorian');
            dorian.degree(6, 0.25).commit();

            // Minor 6th = 8 semitones (Ab), Dorian 6th = 9 semitones (A)
            expect(minor.build().operations[0].pitch).toBe(68);  // Ab4
            expect(dorian.build().operations[0].pitch).toBe(69); // A4
        });
    });
});
