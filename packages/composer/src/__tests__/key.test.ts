import { SynapticMelody } from '../clips/SynapticMelody';
import { SiliconBridge } from '@symphonyscript/kernel';
import { applyKeySignature, hasExplicitAccidental } from '../utils/key';
import type { KeyContext } from '../types';

describe('Key signature context', () => {
    let melody: SynapticMelody;
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
        melody = new SynapticMelody(mockBridge);
    });

    describe('key()', () => {
        it('sets key context', () => {
            melody.key('G', 'major');

            const ctx = melody.getKeyContext();
            expect(ctx).toEqual({ root: 'G', mode: 'major' });
        });

        it('returns this for chaining', () => {
            const result = melody.key('D', 'minor');
            expect(result).toBe(melody);
        });

        it('can be changed', () => {
            melody.key('G', 'major');
            melody.key('F', 'major');

            const ctx = melody.getKeyContext();
            expect(ctx).toEqual({ root: 'F', mode: 'major' });
        });
    });

    describe('accidental()', () => {
        it('returns this for chaining', () => {
            const result = melody.accidental('sharp');
            expect(result).toBe(melody);
        });

        it('is consumed after use', () => {
            melody.accidental('sharp');
            const first = melody.consumeAccidental();
            const second = melody.consumeAccidental();

            expect(first).toBe('sharp');
            expect(second).toBeNull();
        });
    });

    describe('note() with key context', () => {
        it('note("F4") becomes F#4 in G major', () => {
            melody.key('G', 'major')
                .note('F4').commit();

            // F#4 = MIDI 66
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66);
        });

        it('note("B4") becomes Bb4 in F major', () => {
            melody.key('F', 'major')
                .note('B4').commit();

            // Bb4 = MIDI 70
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(70);
        });

        it('note("C4") stays C4 in G major (no accidental for C)', () => {
            melody.key('G', 'major')
                .note('C4').commit();

            // C4 = MIDI 60
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(60);
        });

        it('multiple sharps in D major (F# and C#)', () => {
            melody.key('D', 'major');
            melody.note('F4').commit();
            melody.note('C4').commit();

            // F#4 = 66, C#4 = 61
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66);
            expect(result.operations[1].pitch).toBe(61);
        });

        it('minor key accidentals (E minor has F#)', () => {
            melody.key('E', 'minor')
                .note('F4').commit();

            // F#4 = 66
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66);
        });
    });

    describe('accidental override', () => {
        it('accidental("natural").note("F4") stays F4 in G major', () => {
            melody.key('G', 'major')
                .accidental('natural')
                .note('F4').commit();

            // F4 = MIDI 65 (natural overrides key signature)
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(65);
        });

        it('accidental("sharp").note("C4") becomes C#4', () => {
            melody.accidental('sharp')
                .note('C4').commit();

            // C#4 = MIDI 61
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(61);
        });

        it('accidental("flat").note("B4") becomes Bb4', () => {
            melody.accidental('flat')
                .note('B4').commit();

            // Bb4 = MIDI 70
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(70);
        });

        it('accidental is consumed after one note', () => {
            melody.key('G', 'major')
                .accidental('natural')
                .note('F4').commit();  // Should be F4 (natural override)
            melody.note('F4').commit(); // Should be F#4 (key signature applies)

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(65); // F4
            expect(result.operations[1].pitch).toBe(66); // F#4
        });
    });

    describe('explicit accidentals in note name', () => {
        it('note("F#4") is not modified by key context', () => {
            melody.key('C', 'major') // C major has no sharps
                .note('F#4').commit();

            // F#4 = MIDI 66 (explicit accidental preserved)
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66);
        });

        it('note("Bb4") is not modified by key context', () => {
            melody.key('G', 'major') // G major has no Bb
                .note('Bb4').commit();

            // Bb4 = MIDI 70 (explicit accidental preserved)
            const result = melody.build();
            expect(result.operations[0].pitch).toBe(70);
        });

        it('explicit accidental overrides key signature', () => {
            melody.key('G', 'major'); // G major has F#
            melody.note('F4').commit();   // Should become F#4
            melody.note('Fb4').commit(); // Explicit Fb4 stays Fb4

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(66); // F#4
            expect(result.operations[1].pitch).toBe(64); // Fb4 = E4
        });
    });

    describe('numeric input', () => {
        it('numeric input ignores key context', () => {
            melody.key('G', 'major')
                .note(65).commit(); // MIDI 65 = F4

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(65); // Stays 65
        });

        it('accidental is consumed even for numeric input', () => {
            melody.key('G', 'major')
                .accidental('sharp')
                .note(60).commit();  // C4, accidental consumed but not applied
            melody.note('F4').commit(); // Should be F#4 (key applies, accidental consumed)

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(60); // C4 unchanged
            expect(result.operations[1].pitch).toBe(66); // F#4 from key
        });
    });

    describe('various key signatures', () => {
        const testCases: [string, 'major' | 'minor', string, number][] = [
            // Major keys - sharps
            ['G', 'major', 'F4', 66],  // F#4
            ['D', 'major', 'C4', 61],  // C#4
            ['A', 'major', 'G4', 68],  // G#4
            ['E', 'major', 'D4', 63],  // D#4
            ['B', 'major', 'A4', 70],  // A#4
            
            // Major keys - flats
            ['F', 'major', 'B4', 70],  // Bb4
            ['Bb', 'major', 'E4', 63], // Eb4
            ['Eb', 'major', 'A4', 68], // Ab4
            ['Ab', 'major', 'D4', 61], // Db4
            
            // Minor keys
            ['E', 'minor', 'F4', 66],  // F#4
            ['D', 'minor', 'B4', 70],  // Bb4
            ['G', 'minor', 'E4', 63],  // Eb4
        ];

        testCases.forEach(([root, mode, note, expectedPitch]) => {
            it(`${root} ${mode}: ${note} → MIDI ${expectedPitch}`, () => {
                melody = new SynapticMelody(mockBridge);
                
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
        const ctx: KeyContext = { root: 'G', mode: 'major' };
        expect(applyKeySignature('F4', ctx)).toBe('F#4');
    });

    it('applies flat in F major', () => {
        const ctx: KeyContext = { root: 'F', mode: 'major' };
        expect(applyKeySignature('B4', ctx)).toBe('Bb4');
    });

    it('natural override strips accidental', () => {
        const ctx: KeyContext = { root: 'G', mode: 'major' };
        expect(applyKeySignature('F4', ctx, 'natural')).toBe('F4');
    });

    it('sharp override adds sharp', () => {
        expect(applyKeySignature('C4', null, 'sharp')).toBe('C#4');
    });

    it('flat override adds flat', () => {
        expect(applyKeySignature('B4', null, 'flat')).toBe('Bb4');
    });

    it('does not modify explicit accidentals', () => {
        const ctx: KeyContext = { root: 'C', mode: 'major' };
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
