import { SynapticMelody } from '../clips/SynapticMelody';
import { SiliconBridge } from '@symphonyscript/kernel';
import { romanToChord, toTheoryKeyContext } from '../utils/romanAdapter';
import type { KeyContext } from '../types';

describe('Roman numeral methods', () => {
    let melody: SynapticMelody;
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
        melody = new SynapticMelody(mockBridge);
    });

    describe('roman()', () => {
        it('throws if key() not set', () => {
            expect(() => melody.roman('I')).toThrow('roman() requires key() to be called first');
        });

        it('returns chord cursor for I in C major', () => {
            melody.key('C', 'major');
            const cursor = melody.roman('I');
            expect(cursor).toBeDefined();
        });

        it('roman("I") returns root chord cursor', () => {
            melody.key('C', 'major');
            melody.roman('I').commit();

            const result = melody.build();
            // C major triad: C4 (60), E4 (64), G4 (67)
            expect(result.operations.length).toBe(3);
            const pitches = result.operations.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([60, 64, 67]);
        });

        it('roman("ii") returns minor chord cursor', () => {
            melody.key('C', 'major');
            melody.roman('ii').commit();

            const result = melody.build();
            // D minor triad: D4 (62), F4 (65), A4 (69)
            const pitches = result.operations.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([62, 65, 69]);
        });

        it('roman("V7") returns dominant 7th chord cursor', () => {
            melody.key('C', 'major');
            melody.roman('V7').commit();

            const result = melody.build();
            // G7: G4 (67), B4 (71), D5 (74), F5 (77)
            const pitches = result.operations.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([67, 71, 74, 77]);
        });

        it('accepts optional duration', () => {
            melody.key('G', 'major');
            const cursor = melody.roman('I', 2);
            cursor.commit();

            const result = melody.build();
            expect(result.operations[0].duration).toBe(2);
        });

        it('throws for invalid roman numeral', () => {
            melody.key('C', 'major');
            expect(() => melody.roman('VIII')).toThrow('Invalid roman numeral: VIII');
        });
    });

    describe('progression()', () => {
        it('throws if key() not set', () => {
            expect(() => melody.progression(['I', 'IV', 'V'])).toThrow('progression() requires key() to be called first');
        });

        it('emits 4 chords for I-IV-V-I', () => {
            melody.key('C', 'major');
            melody.progression(['I', 'IV', 'V', 'I']);

            const result = melody.build();
            // 4 triads = 12 notes
            expect(result.operations.length).toBe(12);
        });

        it('uses specified duration for each chord', () => {
            melody.key('C', 'major');
            melody.progression(['I', 'V'], { duration: 2 });

            const result = melody.build();
            expect(result.operations[0].duration).toBe(2);
            expect(result.operations[3].duration).toBe(2); // Second chord's first note
        });

        it('advances tick position between chords', () => {
            melody.key('C', 'major');
            melody.progression(['I', 'V'], { duration: 1 });

            const result = melody.build();
            // First chord at tick 0, second chord at tick 1
            const firstChordTick = result.operations[0].tick;
            const secondChordTick = result.operations[3].tick;
            expect(firstChordTick).toBe(0);
            expect(secondChordTick).toBe(1);
        });

        it('throws for invalid numeral in progression', () => {
            melody.key('C', 'major');
            expect(() => melody.progression(['I', 'VIII', 'V'])).toThrow('Invalid roman numeral in progression: VIII');
        });

        it('returns this for chaining', () => {
            melody.key('C', 'major');
            const result = melody.progression(['I', 'V']);
            expect(result).toBe(melody);
        });
    });

    describe('works with different keys', () => {
        it('G major: roman("I") gives G major chord', () => {
            melody.key('G', 'major');
            melody.roman('I').commit();

            const result = melody.build();
            // G major: G4 (67), B4 (71), D5 (74)
            const pitches = result.operations.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([67, 71, 74]);
        });

        it('F major: roman("IV") gives Bb major chord', () => {
            melody.key('F', 'major');
            melody.roman('IV').commit();

            const result = melody.build();
            // Bb major: Bb4 (70), D5 (74), F5 (77)
            const pitches = result.operations.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([70, 74, 77]);
        });

        it('A minor: roman("i") gives A minor chord', () => {
            melody.key('A', 'minor');
            melody.roman('i').commit();

            const result = melody.build();
            // A minor: A4 (69), C5 (72), E5 (76)
            const pitches = result.operations.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([69, 72, 76]);
        });

        it('D major: roman("vi") gives B minor chord', () => {
            melody.key('D', 'major');
            melody.roman('vi').commit();

            const result = melody.build();
            // B minor: B4 (71), D5 (74), F#5 (78)
            const pitches = result.operations.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([71, 74, 78]);
        });
    });

    describe('modal interchange', () => {
        it('bVII in C major gives Bb major', () => {
            melody.key('C', 'major');
            melody.roman('bVII').commit();

            const result = melody.build();
            // Bb major: Bb4 (70), D5 (74), F5 (77)
            const pitches = result.operations.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([70, 74, 77]);
        });
    });
});

describe('romanToChord adapter', () => {
    it('converts I in C major to C', () => {
        const keyCtx: KeyContext = { root: 'C', mode: 'major' };
        expect(romanToChord('I', keyCtx)).toBe('C');
    });

    it('converts ii in C major to Dm', () => {
        const keyCtx: KeyContext = { root: 'C', mode: 'major' };
        expect(romanToChord('ii', keyCtx)).toBe('Dm');
    });

    it('converts V7 in C major to G7', () => {
        const keyCtx: KeyContext = { root: 'C', mode: 'major' };
        expect(romanToChord('V7', keyCtx)).toBe('G7');
    });

    it('converts IV in G major to C', () => {
        const keyCtx: KeyContext = { root: 'G', mode: 'major' };
        expect(romanToChord('IV', keyCtx)).toBe('C');
    });

    it('converts bVII in C major to Bb', () => {
        const keyCtx: KeyContext = { root: 'C', mode: 'major' };
        expect(romanToChord('bVII', keyCtx)).toBe('Bb');
    });

    it('returns null for invalid numeral', () => {
        const keyCtx: KeyContext = { root: 'C', mode: 'major' };
        expect(romanToChord('VIII', keyCtx)).toBeNull();
    });

    it('returns null for invalid key root', () => {
        const keyCtx: KeyContext = { root: 'X', mode: 'major' };
        expect(romanToChord('I', keyCtx)).toBeNull();
    });
});

describe('toTheoryKeyContext', () => {
    it('converts C major', () => {
        const keyCtx: KeyContext = { root: 'C', mode: 'major' };
        const result = toTheoryKeyContext(keyCtx);
        expect(result).toBeDefined();
        expect(result!.root).toBe(0);
        expect(result!.mode).toBe('major');
    });

    it('converts G major', () => {
        const keyCtx: KeyContext = { root: 'G', mode: 'major' };
        const result = toTheoryKeyContext(keyCtx);
        expect(result!.root).toBe(14); // G in 24-EDO
        expect(result!.mode).toBe('major');
    });

    it('converts F# minor', () => {
        const keyCtx: KeyContext = { root: 'F#', mode: 'minor' };
        const result = toTheoryKeyContext(keyCtx);
        expect(result!.root).toBe(12); // F# in 24-EDO
        expect(result!.mode).toBe('minor');
    });

    it('converts Bb major', () => {
        const keyCtx: KeyContext = { root: 'Bb', mode: 'major' };
        const result = toTheoryKeyContext(keyCtx);
        expect(result!.root).toBe(20); // Bb in 24-EDO
        expect(result!.mode).toBe('major');
    });

    it('returns null for invalid root', () => {
        const keyCtx: KeyContext = { root: 'X', mode: 'major' };
        expect(toTheoryKeyContext(keyCtx)).toBeNull();
    });
});
