/**
 * Tests for MIDI Utilities
 * RFC-047: Bitwise Music Theory System
 */

import {
    parseNote,
    noteToMidi,
    midiToNote,
    transposeNote,
    noteToPitchClass24,
    noteTo24EDO,
    MIDI_CC,
    GM_PROGRAM,
    GM_DRUM,
    midiChannel,
    midiValue,
    midiControl,
    instrumentId,
    isInstrumentId,
    unsafeInstrumentId,
    type MidiChannel,
    type MidiValue,
    type MidiControlID,
    type InstrumentId,
} from '../pitch/midi';
import { asInterval24EDO } from '../types';

// ============================================================================
// Note Parsing Tests
// ============================================================================

describe('Note Parsing', () => {
    describe('parseNote()', () => {
        test('parses natural notes', () => {
            expect(parseNote('C4')).toEqual({ name: 'C', octave: 4 });
            expect(parseNote('D5')).toEqual({ name: 'D', octave: 5 });
            expect(parseNote('G3')).toEqual({ name: 'G', octave: 3 });
        });

        test('parses sharp notes', () => {
            expect(parseNote('C#4')).toEqual({ name: 'C#', octave: 4 });
            expect(parseNote('F#3')).toEqual({ name: 'F#', octave: 3 });
        });

        test('converts flats to sharps', () => {
            expect(parseNote('Db4')).toEqual({ name: 'C#', octave: 4 });
            expect(parseNote('Bb3')).toEqual({ name: 'A#', octave: 3 });
            expect(parseNote('Eb5')).toEqual({ name: 'D#', octave: 5 });
        });

        test('handles negative octaves', () => {
            expect(parseNote('C-1')).toEqual({ name: 'C', octave: -1 });
        });

        test('handles lowercase input', () => {
            expect(parseNote('c4')).toEqual({ name: 'C', octave: 4 });
            expect(parseNote('f#3')).toEqual({ name: 'F#', octave: 3 });
        });

        test('returns null for invalid input', () => {
            expect(parseNote('')).toBeNull();
            expect(parseNote('X4')).toBeNull();
            expect(parseNote('C')).toBeNull();
            expect(parseNote('4')).toBeNull();
            expect(parseNote('C4C')).toBeNull();
        });
    });
});

// ============================================================================
// MIDI Conversion Tests
// ============================================================================

describe('MIDI Conversion', () => {
    describe('noteToMidi()', () => {
        test('C4 = 60 (middle C)', () => {
            expect(noteToMidi('C4')).toBe(60);
        });

        test('A4 = 69 (concert pitch)', () => {
            expect(noteToMidi('A4')).toBe(69);
        });

        test('C-1 = 0 (lowest MIDI note)', () => {
            expect(noteToMidi('C-1')).toBe(0);
        });

        test('G9 = 127 (highest MIDI note)', () => {
            expect(noteToMidi('G9')).toBe(127);
        });

        test('handles sharps correctly', () => {
            expect(noteToMidi('C#4')).toBe(61);
            expect(noteToMidi('F#4')).toBe(66);
        });

        test('handles flats correctly (converts to sharps)', () => {
            expect(noteToMidi('Db4')).toBe(61);
            expect(noteToMidi('Bb3')).toBe(58);
        });

        test('returns null for out of range', () => {
            expect(noteToMidi('C-2')).toBeNull();
            expect(noteToMidi('G#9')).toBeNull();
        });

        test('returns null for invalid input', () => {
            expect(noteToMidi('')).toBeNull();
            expect(noteToMidi('invalid')).toBeNull();
        });
    });

    describe('midiToNote()', () => {
        test('60 = C4 (middle C)', () => {
            expect(midiToNote(60)).toBe('C4');
        });

        test('69 = A4 (concert pitch)', () => {
            expect(midiToNote(69)).toBe('A4');
        });

        test('0 = C-1 (lowest)', () => {
            expect(midiToNote(0)).toBe('C-1');
        });

        test('127 = G9 (highest)', () => {
            expect(midiToNote(127)).toBe('G9');
        });

        test('uses sharps for accidentals', () => {
            expect(midiToNote(61)).toBe('C#4');
            expect(midiToNote(66)).toBe('F#4');
        });

        test('returns null for out of range', () => {
            expect(midiToNote(-1)).toBeNull();
            expect(midiToNote(128)).toBeNull();
            expect(midiToNote(NaN)).toBeNull();
            expect(midiToNote(Infinity)).toBeNull();
        });
    });

    describe('round-trip conversion', () => {
        test('noteToMidi -> midiToNote preserves note', () => {
            const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
            for (const note of notes) {
                const midi = noteToMidi(note);
                expect(midi).not.toBeNull();
                expect(midiToNote(midi!)).toBe(note);
            }
        });

        test('midiToNote -> noteToMidi preserves MIDI', () => {
            for (let midi = 0; midi <= 127; midi++) {
                const note = midiToNote(midi);
                expect(note).not.toBeNull();
                expect(noteToMidi(note!)).toBe(midi);
            }
        });
    });
});

// ============================================================================
// Transposition Tests
// ============================================================================

describe('Transposition', () => {
    describe('transposeNote()', () => {
        test('transposes up by semitone', () => {
            expect(transposeNote('C4', 1)).toBe('C#4');
            expect(transposeNote('E4', 1)).toBe('F4');
        });

        test('transposes down by semitone', () => {
            expect(transposeNote('C4', -1)).toBe('B3');
            expect(transposeNote('F4', -1)).toBe('E4');
        });

        test('transposes by octave', () => {
            expect(transposeNote('C4', 12)).toBe('C5');
            expect(transposeNote('C4', -12)).toBe('C3');
        });

        test('transposes by arbitrary interval', () => {
            expect(transposeNote('C4', 7)).toBe('G4'); // Perfect fifth
            expect(transposeNote('C4', 5)).toBe('F4'); // Perfect fourth
        });

        test('zero transposition returns original', () => {
            expect(transposeNote('C4', 0)).toBe('C4');
        });

        test('returns null for out of range result', () => {
            expect(transposeNote('C-1', -1)).toBeNull();
            expect(transposeNote('G9', 1)).toBeNull();
        });

        test('returns null for invalid input', () => {
            expect(transposeNote('invalid', 1)).toBeNull();
        });
    });
});

// ============================================================================
// 24-EDO Conversion Tests
// ============================================================================

describe('24-EDO Conversion', () => {
    describe('noteToPitchClass24()', () => {
        test('C = 0', () => {
            expect(noteToPitchClass24('C4')).toBe(asInterval24EDO(0));
        });

        test('C# = 2', () => {
            expect(noteToPitchClass24('C#4')).toBe(asInterval24EDO(2));
        });

        test('D = 4', () => {
            expect(noteToPitchClass24('D4')).toBe(asInterval24EDO(4));
        });

        test('E = 8', () => {
            expect(noteToPitchClass24('E4')).toBe(asInterval24EDO(8));
        });

        test('F = 10', () => {
            expect(noteToPitchClass24('F4')).toBe(asInterval24EDO(10));
        });

        test('G = 14', () => {
            expect(noteToPitchClass24('G4')).toBe(asInterval24EDO(14));
        });

        test('A = 18', () => {
            expect(noteToPitchClass24('A4')).toBe(asInterval24EDO(18));
        });

        test('B = 22', () => {
            expect(noteToPitchClass24('B4')).toBe(asInterval24EDO(22));
        });

        test('returns null for invalid', () => {
            expect(noteToPitchClass24('invalid')).toBeNull();
        });
    });

    describe('noteTo24EDO()', () => {
        test('C4 = 96 (4 octaves × 24)', () => {
            expect(noteTo24EDO('C4')).toBe(96);
        });

        test('C5 = 120 (5 octaves × 24)', () => {
            expect(noteTo24EDO('C5')).toBe(120);
        });

        test('E4 = 104 (96 + 8)', () => {
            expect(noteTo24EDO('E4')).toBe(104);
        });

        test('returns null for invalid', () => {
            expect(noteTo24EDO('invalid')).toBeNull();
        });
    });
});

// ============================================================================
// MIDI Constants Tests
// ============================================================================

describe('MIDI Constants', () => {
    describe('MIDI_CC', () => {
        test('standard controllers have correct values', () => {
            expect(MIDI_CC.MODULATION).toBe(1);
            expect(MIDI_CC.VOLUME).toBe(7);
            expect(MIDI_CC.PAN).toBe(10);
            expect(MIDI_CC.EXPRESSION).toBe(11);
        });

        test('pedals have correct values', () => {
            expect(MIDI_CC.SUSTAIN).toBe(64);
            expect(MIDI_CC.SOSTENUTO).toBe(66);
            expect(MIDI_CC.SOFT_PEDAL).toBe(67);
        });

        test('channel mode messages have correct values', () => {
            expect(MIDI_CC.ALL_NOTES_OFF).toBe(123);
            expect(MIDI_CC.ALL_SOUND_OFF).toBe(120);
        });
    });

    describe('GM_PROGRAM', () => {
        test('piano family starts at 0', () => {
            expect(GM_PROGRAM.ACOUSTIC_GRAND).toBe(0);
            expect(GM_PROGRAM.CLAVINET).toBe(7);
        });

        test('strings start at 40', () => {
            expect(GM_PROGRAM.VIOLIN).toBe(40);
        });

        test('brass starts at 56', () => {
            expect(GM_PROGRAM.TRUMPET).toBe(56);
        });

        test('sound effects end at 127', () => {
            expect(GM_PROGRAM.GUNSHOT).toBe(127);
        });
    });

    describe('GM_DRUM', () => {
        test('kick drums', () => {
            expect(GM_DRUM.ACOUSTIC_BASS_DRUM).toBe(35);
            expect(GM_DRUM.BASS_DRUM_1).toBe(36);
        });

        test('snare drums', () => {
            expect(GM_DRUM.ACOUSTIC_SNARE).toBe(38);
            expect(GM_DRUM.ELECTRIC_SNARE).toBe(40);
        });

        test('hi-hats', () => {
            expect(GM_DRUM.CLOSED_HI_HAT).toBe(42);
            expect(GM_DRUM.OPEN_HI_HAT).toBe(46);
            expect(GM_DRUM.PEDAL_HI_HAT).toBe(44);
        });

        test('cymbals', () => {
            expect(GM_DRUM.CRASH_CYMBAL_1).toBe(49);
            expect(GM_DRUM.RIDE_CYMBAL_1).toBe(51);
        });
    });
});

// ============================================================================
// Branded MIDI Types Tests
// ============================================================================

describe('Branded MIDI Types', () => {
    describe('midiChannel()', () => {
        test('creates valid channels (0-15)', () => {
            expect(midiChannel(0)).toBe(0);
            expect(midiChannel(1)).toBe(1);
            expect(midiChannel(9)).toBe(9); // drum channel
            expect(midiChannel(15)).toBe(15);
        });

        test('returns null for invalid channels', () => {
            expect(midiChannel(-1)).toBeNull();
            expect(midiChannel(16)).toBeNull();
            expect(midiChannel(100)).toBeNull();
        });

        test('returns null for non-integers', () => {
            expect(midiChannel(0.5)).toBeNull();
            expect(midiChannel(1.1)).toBeNull();
            expect(midiChannel(NaN)).toBeNull();
            expect(midiChannel(Infinity)).toBeNull();
        });
    });

    describe('midiValue()', () => {
        test('creates valid values (0-127)', () => {
            expect(midiValue(0)).toBe(0);
            expect(midiValue(64)).toBe(64);
            expect(midiValue(127)).toBe(127);
        });

        test('returns null for invalid values', () => {
            expect(midiValue(-1)).toBeNull();
            expect(midiValue(128)).toBeNull();
            expect(midiValue(200)).toBeNull();
        });

        test('returns null for non-integers', () => {
            expect(midiValue(63.5)).toBeNull();
            expect(midiValue(NaN)).toBeNull();
            expect(midiValue(Infinity)).toBeNull();
        });
    });

    describe('midiControl()', () => {
        test('creates valid CC numbers (0-127)', () => {
            expect(midiControl(0)).toBe(0);
            expect(midiControl(1)).toBe(1); // modulation
            expect(midiControl(7)).toBe(7); // volume
            expect(midiControl(64)).toBe(64); // sustain
            expect(midiControl(127)).toBe(127);
        });

        test('returns null for invalid CC numbers', () => {
            expect(midiControl(-1)).toBeNull();
            expect(midiControl(128)).toBeNull();
        });

        test('returns null for non-integers', () => {
            expect(midiControl(64.5)).toBeNull();
            expect(midiControl(NaN)).toBeNull();
        });
    });

    describe('instrumentId()', () => {
        test('creates valid instrument IDs', () => {
            expect(instrumentId('piano')).toBe('piano');
            expect(instrumentId('synth-lead-1')).toBe('synth-lead-1');
            expect(instrumentId('drum-kit')).toBe('drum-kit');
        });

        test('returns null for empty string', () => {
            expect(instrumentId('')).toBeNull();
        });

        test('returns null for non-strings', () => {
            expect(instrumentId(null as unknown as string)).toBeNull();
            expect(instrumentId(undefined as unknown as string)).toBeNull();
            expect(instrumentId(123 as unknown as string)).toBeNull();
        });
    });

    describe('isInstrumentId()', () => {
        test('returns true for valid strings', () => {
            expect(isInstrumentId('piano')).toBe(true);
            expect(isInstrumentId('synth')).toBe(true);
        });

        test('returns false for empty string', () => {
            expect(isInstrumentId('')).toBe(false);
        });

        test('returns false for non-strings', () => {
            expect(isInstrumentId(null)).toBe(false);
            expect(isInstrumentId(undefined)).toBe(false);
            expect(isInstrumentId(123)).toBe(false);
            expect(isInstrumentId({})).toBe(false);
        });
    });

    describe('unsafeInstrumentId()', () => {
        test('casts string to InstrumentId', () => {
            const id: InstrumentId = unsafeInstrumentId('piano');
            expect(id).toBe('piano');
        });
    });

    describe('type safety', () => {
        test('branded types are assignable to their base types', () => {
            const channel: MidiChannel | null = midiChannel(5);
            const value: MidiValue | null = midiValue(100);
            const control: MidiControlID | null = midiControl(64);
            const instrument: InstrumentId | null = instrumentId('piano');

            // These should compile and work at runtime
            if (channel !== null) {
                const num: number = channel;
                expect(num).toBe(5);
            }
            if (value !== null) {
                const num: number = value;
                expect(num).toBe(100);
            }
            if (control !== null) {
                const num: number = control;
                expect(num).toBe(64);
            }
            if (instrument !== null) {
                const str: string = instrument;
                expect(str).toBe('piano');
            }
        });
    });
});
