import { SynapticMelody } from '../clips/SynapticMelody'
import { ScaleMode } from '../types'
import { createTestBridge } from '../test-bridge'

describe('Scale context and degree()', () => {
    let melody: SynapticMelody;
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
        melody = new SynapticMelody(mockBridge);
    });

    describe('setScale()', () => {
        it('sets scale context', () => {
            melody.setScale('G', ScaleMode.MAJOR);

            const ctx = melody.getScaleContext();
            expect(ctx).toEqual({ root: 'G', mode: ScaleMode.MAJOR, octave: 4 });
        });

        it('sets scale context with custom octave', () => {
            melody.setScale('C', ScaleMode.MINOR, 5);

            const ctx = melody.getScaleContext();
            expect(ctx).toEqual({ root: 'C', mode: ScaleMode.MINOR, octave: 5 });
        });

        it('returns this for chaining', () => {
            const result = melody.setScale('C', ScaleMode.MAJOR);
            expect(result).toBe(melody);
        });
    });

    describe('scale() shorthand', () => {
        it('parses root+mode into primitive scale context', () => {
            melody.scale('D dorian');

            const ctx = melody.getScaleContext();
            expect(ctx).toEqual({ root: 'D', mode: ScaleMode.DORIAN, octave: 4 });
        });

        it('does not keep legacy string-backed scale state', () => {
            melody.scale('C major');
            expect((melody as any).currentScale).toBeUndefined();
        });
    });

    describe('degree()', () => {
        it('throws without scale context', () => {
            expect(() => melody.degree(1)).toThrow('degree() requires setScale() to be called first');
        });

        it('degree(1) returns root note in C major', () => {
            melody.setScale('C', ScaleMode.MAJOR);
            melody.degree(1, 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(60); // C4
        });

        it('degree(3) returns major third in C major', () => {
            melody.setScale('C', ScaleMode.MAJOR);
            melody.degree(3, 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(64); // E4 (C + 4 semitones)
        });

        it('degree(3) returns minor third in C minor', () => {
            melody.setScale('C', ScaleMode.MINOR);
            melody.degree(3, 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(63); // Eb4 (C + 3 semitones)
        });

        it('degree(1) in G major returns G4', () => {
            melody.setScale('G', ScaleMode.MAJOR);
            melody.degree(1, 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(67); // G4
        });

        it('degree(8) wraps to next octave', () => {
            melody.setScale('C', ScaleMode.MAJOR);
            melody.degree(8, 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(72); // C5
        });

        it('octaveOffset shifts octaves', () => {
            melody.setScale('C', ScaleMode.MAJOR);
            melody.degree(1, 0.25, 1).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(72); // C5 (C4 + 12)
        });

        it('alteration adds/subtracts semitones', () => {
            melody.setScale('C', ScaleMode.MAJOR);
            melody.degree(2, 0.25, undefined, 1).commit(); // D# instead of D

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(63); // D4 + 1 = D#4
        });

        it('negative alteration flattens', () => {
            melody.setScale('C', ScaleMode.MAJOR);
            melody.degree(5, 0.25, undefined, -1).commit(); // Gb instead of G

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66); // G4 - 1 = Gb4
        });

        it('supports all scale modes', () => {
            const modes = [ScaleMode.MAJOR, ScaleMode.MINOR, ScaleMode.DORIAN, ScaleMode.PHRYGIAN, ScaleMode.LYDIAN, ScaleMode.MIXOLYDIAN, ScaleMode.LOCRIAN];

            for (const mode of modes) {
                const bridge = createTestBridge();
                const m = new SynapticMelody(bridge);
                m.setScale('C', mode);
                m.degree(1, 0.25).commit();

                expect(m.build().operations[0].pitch).toBe(60); // Root is always C4
            }
        });

        it('dorian has raised 6th compared to minor', () => {
            const minorBridge = createTestBridge();
            const minor = new SynapticMelody(minorBridge);
            minor.setScale('C', ScaleMode.MINOR);
            minor.degree(6, 0.25).commit();

            const dorianBridge = createTestBridge();
            const dorian = new SynapticMelody(dorianBridge);
            dorian.setScale('C', ScaleMode.DORIAN);
            dorian.degree(6, 0.25).commit();

            // Minor 6th = 8 semitones (Ab), Dorian 6th = 9 semitones (A)
            expect(minor.build().operations[0].pitch).toBe(68);  // Ab4
            expect(dorian.build().operations[0].pitch).toBe(69); // A4
        });
    });
});
