import { SynapticMelody } from '../clips/SynapticMelody';
import { applyKeySignature, hasExplicitAccidental } from '../utils/key';
import { ScaleMode, Accidental, type KeyContext } from '../types';
import { createTestBridge } from '../test-bridge';

describe('Key signature context', () => {
    let melody: SynapticMelody;
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
        melody = new SynapticMelody(mockBridge);
    });

    describe('key()', () => {
        it('sets key context', () => {
            melody.key('G', ScaleMode.MAJOR);

            const ctx = melody.getKeyContext();
            expect(ctx).toEqual({ root: 'G', mode: ScaleMode.MAJOR });
        });

        it('returns this for chaining', () => {
            const result = melody.key('D', ScaleMode.MINOR);
            expect(result).toBe(melody);
        });

        it('can be changed', () => {
            melody.key('G', ScaleMode.MAJOR);
            melody.key('F', ScaleMode.MAJOR);

            const ctx = melody.getKeyContext();
            expect(ctx).toEqual({ root: 'F', mode: ScaleMode.MAJOR });
        });
    });

    describe('accidental()', () => {
        it('returns this for chaining', () => {
            const result = melody.accidental(Accidental.SHARP);
            expect(result).toBe(melody);
        });

        it('is consumed after use', () => {
            melody.accidental(Accidental.SHARP);
            const first = melody.consumeAccidental();
            const second = melody.consumeAccidental();

            expect(first).toBe(Accidental.SHARP);
            expect(second).toBeNull();
        });
    });

    describe('note() with key context', () => {
        it('note("F4") becomes F#4 in G major', () => {
            melody.key('G', ScaleMode.MAJOR)
                .note('F4').commit();

            // F#4 = MIDI 66
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66);
        });

        it('note("B4") becomes Bb4 in F major', () => {
            melody.key('F', ScaleMode.MAJOR)
                .note('B4').commit();

            // Bb4 = MIDI 70
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(70);
        });

        it('note("C4") stays C4 in G major (no accidental for C)', () => {
            melody.key('G', ScaleMode.MAJOR)
                .note('C4').commit();

            // C4 = MIDI 60
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(60);
        });

        it('multiple sharps in D major (F# and C#)', () => {
            melody.key('D', ScaleMode.MAJOR);
            melody.note('F4').commit();
            melody.note('C4').commit();

            // F#4 = 66, C#4 = 61
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66);
            expect(result.operations[1].pitch).toBe(61);
        });

        it('minor key accidentals (E minor has F#)', () => {
            melody.key('E', ScaleMode.MINOR)
                .note('F4').commit();

            // F#4 = 66
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66);
        });
    });

    describe('accidental override', () => {
        it('accidental("natural").note("F4") stays F4 in G major', () => {
            melody.key('G', ScaleMode.MAJOR)
                .accidental(Accidental.NATURAL)
                .note('F4').commit();

            // F4 = MIDI 65 (natural overrides key signature)
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(65);
        });

        it('accidental("sharp").note("C4") becomes C#4', () => {
            melody.accidental(Accidental.SHARP)
                .note('C4').commit();

            // C#4 = MIDI 61
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(61);
        });

        it('accidental("flat").note("B4") becomes Bb4', () => {
            melody.accidental(Accidental.FLAT)
                .note('B4').commit();

            // Bb4 = MIDI 70
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(70);
        });

        it('accidental is consumed after one note', () => {
            melody.key('G', ScaleMode.MAJOR)
                .accidental(Accidental.NATURAL)
                .note('F4').commit();  // Should be F4 (natural override)
            melody.note('F4').commit(); // Should be F#4 (key signature applies)

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(65); // F4
            expect(result.operations[1].pitch).toBe(66); // F#4
        });
    });

    describe('explicit accidentals in note name', () => {
        it('note("F#4") is not modified by key context', () => {
            melody.key('C', ScaleMode.MAJOR) // C major has no sharps
                .note('F#4').commit();

            // F#4 = MIDI 66 (explicit accidental preserved)
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66);
        });

        it('note("Bb4") is not modified by key context', () => {
            melody.key('G', ScaleMode.MAJOR) // G major has no Bb
                .note('Bb4').commit();

            // Bb4 = MIDI 70 (explicit accidental preserved)
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(70);
        });

        it('explicit accidental overrides key signature', () => {
            melody.key('G', ScaleMode.MAJOR); // G major has F#
            melody.note('F4').commit();   // Should become F#4
            melody.note('Fb4').commit(); // Explicit Fb4 stays Fb4

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66); // F#4
            expect(result.operations[1].pitch).toBe(64); // Fb4 = E4
        });
    });

    describe('numeric input', () => {
        it('numeric input ignores key context', () => {
            melody.key('G', ScaleMode.MAJOR)
                .note(65).commit(); // MIDI 65 = F4

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(65); // Stays 65
        });

        it('accidental is consumed even for numeric input', () => {
            melody.key('G', ScaleMode.MAJOR)
                .accidental(Accidental.SHARP)
                .note(60).commit();  // C4, accidental consumed but not applied
            melody.note('F4').commit(); // Should be F#4 (key applies, accidental consumed)

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(60); // C4 unchanged
            expect(result.operations[1].pitch).toBe(66); // F#4 from key
        });
    });

    describe('various key signatures', () => {
        const testCases: [string, ScaleMode, string, number][] = [
            // Major keys - sharps
            ['G', ScaleMode.MAJOR, 'F4', 66],  // F#4
            ['D', ScaleMode.MAJOR, 'C4', 61],  // C#4
            ['A', ScaleMode.MAJOR, 'G4', 68],  // G#4
            ['E', ScaleMode.MAJOR, 'D4', 63],  // D#4
            ['B', ScaleMode.MAJOR, 'A4', 70],  // A#4
            
            // Major keys - flats
            ['F', ScaleMode.MAJOR, 'B4', 70],  // Bb4
            ['Bb', ScaleMode.MAJOR, 'E4', 63], // Eb4
            ['Eb', ScaleMode.MAJOR, 'A4', 68], // Ab4
            ['Ab', ScaleMode.MAJOR, 'D4', 61], // Db4
            
            // Minor keys
            ['E', ScaleMode.MINOR, 'F4', 66],  // F#4
            ['D', ScaleMode.MINOR, 'B4', 70],  // Bb4
            ['G', ScaleMode.MINOR, 'E4', 63],  // Eb4
        ];

        testCases.forEach(([root, mode, note, expectedPitch]) => {
            it(`${root} ${mode}: ${note} → MIDI ${expectedPitch}`, () => {
                const bridge = createTestBridge();
                melody = new SynapticMelody(bridge);
                
                melody.key(root, mode).note(note).commit();
                
                const result = melody.build();
                expect(result.operations[0].pitch).toBe(expectedPitch);
            });
        });
    });
});

describe('applyKeySignature utility', () => {
    it('returns note unchanged without key context', () => {
        expect(applyKeySignature('F4', null)).toBe('F4');
    });

    it('applies sharp in G major', () => {
        const ctx: KeyContext = { root: 'G', mode: ScaleMode.MAJOR };
        expect(applyKeySignature('F4', ctx)).toBe('F#4');
    });

    it('applies flat in F major', () => {
        const ctx: KeyContext = { root: 'F', mode: ScaleMode.MAJOR };
        expect(applyKeySignature('B4', ctx)).toBe('Bb4');
    });

    it('natural override strips accidental', () => {
        const ctx: KeyContext = { root: 'G', mode: ScaleMode.MAJOR };
        expect(applyKeySignature('F4', ctx, Accidental.NATURAL)).toBe('F4');
    });

    it('sharp override adds sharp', () => {
        expect(applyKeySignature('C4', null, Accidental.SHARP)).toBe('C#4');
    });

    it('flat override adds flat', () => {
        expect(applyKeySignature('B4', null, Accidental.FLAT)).toBe('Bb4');
    });

    it('does not modify explicit accidentals', () => {
        const ctx: KeyContext = { root: 'C', mode: ScaleMode.MAJOR };
        expect(applyKeySignature('F#4', ctx)).toBe('F#4');
        expect(applyKeySignature('Bb4', ctx)).toBe('Bb4');
    });
});

describe('hasExplicitAccidental utility', () => {
    it('returns true for sharps', () => {
        expect(hasExplicitAccidental('F#4')).toBe(true);
        expect(hasExplicitAccidental('C#')).toBe(true);
    });

    it('returns true for flats', () => {
        expect(hasExplicitAccidental('Bb4')).toBe(true);
        expect(hasExplicitAccidental('Eb')).toBe(true);
    });

    it('returns false for natural notes', () => {
        expect(hasExplicitAccidental('F4')).toBe(false);
        expect(hasExplicitAccidental('C')).toBe(false);
    });
});
