/**
 * RFC-047: MIDI Utilities (24-EDO Native)
 *
 * Note name parsing and MIDI number conversion.
 * Extends the pitch module with string-based note handling.
 */
import type { Interval24EDO } from '../types';
/**
 * Parsed note components.
 */
export interface ParsedNote {
    readonly name: string;
    readonly octave: number;
}
/**
 * Parse a note name into its components.
 * COMPOSER-ONLY: String parsing.
 *
 * @param note - Note string (e.g., "C4", "F#3", "Bb5")
 * @returns ParsedNote or null if invalid
 */
export declare function parseNote(note: string): ParsedNote | null;
/**
 * Convert a note name to MIDI number.
 * COMPOSER-ONLY: String parsing.
 *
 * Standard MIDI convention: C4 = 60 (middle C).
 *
 * @param note - Note string (e.g., "C4", "F#3", "Bb5")
 * @returns MIDI number (0-127) or null if invalid
 */
export declare function noteToMidi(note: string): number | null;
/**
 * Convert a MIDI number to note name.
 * COMPOSER-ONLY: String creation.
 *
 * @param midi - MIDI number (0-127)
 * @returns Note string (e.g., "C4") or null if invalid
 */
export declare function midiToNote(midi: number): string | null;
/**
 * Apply transposition to a note name.
 * COMPOSER-ONLY: String manipulation.
 *
 * @param note - Note string (e.g., "C4")
 * @param semitones - Semitones to transpose (positive = up, negative = down)
 * @returns Transposed note string or null if invalid/out of range
 */
export declare function transposeNote(note: string, semitones: number): string | null;
/**
 * Convert note name to 24-EDO pitch class.
 * COMPOSER-ONLY: String parsing.
 *
 * @param note - Note string (e.g., "C4", "F#3")
 * @returns 24-EDO pitch class (0-22, even only) or null if invalid
 */
export declare function noteToPitchClass24(note: string): Interval24EDO | null;
/**
 * Convert note name to absolute 24-EDO pitch (with octave).
 * COMPOSER-ONLY: String parsing.
 *
 * @param note - Note string (e.g., "C4", "F#3")
 * @returns Absolute 24-EDO pitch or null if invalid
 */
export declare function noteTo24EDO(note: string): number | null;
/**
 * Standard MIDI Control Change numbers.
 * KERNEL-SAFE: Frozen constants.
 */
export declare const MIDI_CC: {
    readonly BANK_SELECT_MSB: 0;
    readonly MODULATION: 1;
    readonly BREATH: 2;
    readonly FOOT: 4;
    readonly PORTAMENTO_TIME: 5;
    readonly DATA_ENTRY_MSB: 6;
    readonly VOLUME: 7;
    readonly BALANCE: 8;
    readonly PAN: 10;
    readonly EXPRESSION: 11;
    readonly EFFECT_1: 12;
    readonly EFFECT_2: 13;
    readonly BANK_SELECT_LSB: 32;
    readonly DATA_ENTRY_LSB: 38;
    readonly SUSTAIN: 64;
    readonly PORTAMENTO: 65;
    readonly SOSTENUTO: 66;
    readonly SOFT_PEDAL: 67;
    readonly LEGATO: 68;
    readonly HOLD_2: 69;
    readonly SOUND_VARIATION: 70;
    readonly TIMBRE: 71;
    readonly RELEASE_TIME: 72;
    readonly ATTACK_TIME: 73;
    readonly BRIGHTNESS: 74;
    readonly DECAY_TIME: 75;
    readonly VIBRATO_RATE: 76;
    readonly VIBRATO_DEPTH: 77;
    readonly VIBRATO_DELAY: 78;
    readonly REVERB: 91;
    readonly TREMOLO: 92;
    readonly CHORUS: 93;
    readonly DETUNE: 94;
    readonly PHASER: 95;
    readonly ALL_SOUND_OFF: 120;
    readonly RESET_ALL: 121;
    readonly LOCAL_CONTROL: 122;
    readonly ALL_NOTES_OFF: 123;
    readonly OMNI_OFF: 124;
    readonly OMNI_ON: 125;
    readonly MONO_ON: 126;
    readonly POLY_ON: 127;
};
/**
 * General MIDI program numbers (0-indexed).
 * KERNEL-SAFE: Frozen constants.
 */
export declare const GM_PROGRAM: {
    readonly ACOUSTIC_GRAND: 0;
    readonly BRIGHT_ACOUSTIC: 1;
    readonly ELECTRIC_GRAND: 2;
    readonly HONKY_TONK: 3;
    readonly ELECTRIC_PIANO_1: 4;
    readonly ELECTRIC_PIANO_2: 5;
    readonly HARPSICHORD: 6;
    readonly CLAVINET: 7;
    readonly CELESTA: 8;
    readonly GLOCKENSPIEL: 9;
    readonly MUSIC_BOX: 10;
    readonly VIBRAPHONE: 11;
    readonly MARIMBA: 12;
    readonly XYLOPHONE: 13;
    readonly TUBULAR_BELLS: 14;
    readonly DULCIMER: 15;
    readonly DRAWBAR_ORGAN: 16;
    readonly PERCUSSIVE_ORGAN: 17;
    readonly ROCK_ORGAN: 18;
    readonly CHURCH_ORGAN: 19;
    readonly REED_ORGAN: 20;
    readonly ACCORDION: 21;
    readonly HARMONICA: 22;
    readonly TANGO_ACCORDION: 23;
    readonly ACOUSTIC_NYLON: 24;
    readonly ACOUSTIC_STEEL: 25;
    readonly ELECTRIC_JAZZ: 26;
    readonly ELECTRIC_CLEAN: 27;
    readonly ELECTRIC_MUTED: 28;
    readonly OVERDRIVEN: 29;
    readonly DISTORTION: 30;
    readonly HARMONICS: 31;
    readonly ACOUSTIC_BASS: 32;
    readonly ELECTRIC_BASS_FINGER: 33;
    readonly ELECTRIC_BASS_PICK: 34;
    readonly FRETLESS_BASS: 35;
    readonly SLAP_BASS_1: 36;
    readonly SLAP_BASS_2: 37;
    readonly SYNTH_BASS_1: 38;
    readonly SYNTH_BASS_2: 39;
    readonly VIOLIN: 40;
    readonly VIOLA: 41;
    readonly CELLO: 42;
    readonly CONTRABASS: 43;
    readonly TREMOLO_STRINGS: 44;
    readonly PIZZICATO_STRINGS: 45;
    readonly ORCHESTRAL_HARP: 46;
    readonly TIMPANI: 47;
    readonly STRING_ENSEMBLE_1: 48;
    readonly STRING_ENSEMBLE_2: 49;
    readonly SYNTH_STRINGS_1: 50;
    readonly SYNTH_STRINGS_2: 51;
    readonly CHOIR_AAHS: 52;
    readonly VOICE_OOHS: 53;
    readonly SYNTH_VOICE: 54;
    readonly ORCHESTRA_HIT: 55;
    readonly TRUMPET: 56;
    readonly TROMBONE: 57;
    readonly TUBA: 58;
    readonly MUTED_TRUMPET: 59;
    readonly FRENCH_HORN: 60;
    readonly BRASS_SECTION: 61;
    readonly SYNTH_BRASS_1: 62;
    readonly SYNTH_BRASS_2: 63;
    readonly SOPRANO_SAX: 64;
    readonly ALTO_SAX: 65;
    readonly TENOR_SAX: 66;
    readonly BARITONE_SAX: 67;
    readonly OBOE: 68;
    readonly ENGLISH_HORN: 69;
    readonly BASSOON: 70;
    readonly CLARINET: 71;
    readonly PICCOLO: 72;
    readonly FLUTE: 73;
    readonly RECORDER: 74;
    readonly PAN_FLUTE: 75;
    readonly BLOWN_BOTTLE: 76;
    readonly SHAKUHACHI: 77;
    readonly WHISTLE: 78;
    readonly OCARINA: 79;
    readonly LEAD_SQUARE: 80;
    readonly LEAD_SAWTOOTH: 81;
    readonly LEAD_CALLIOPE: 82;
    readonly LEAD_CHIFF: 83;
    readonly LEAD_CHARANG: 84;
    readonly LEAD_VOICE: 85;
    readonly LEAD_FIFTHS: 86;
    readonly LEAD_BASS_LEAD: 87;
    readonly PAD_NEW_AGE: 88;
    readonly PAD_WARM: 89;
    readonly PAD_POLYSYNTH: 90;
    readonly PAD_CHOIR: 91;
    readonly PAD_BOWED: 92;
    readonly PAD_METALLIC: 93;
    readonly PAD_HALO: 94;
    readonly PAD_SWEEP: 95;
    readonly FX_RAIN: 96;
    readonly FX_SOUNDTRACK: 97;
    readonly FX_CRYSTAL: 98;
    readonly FX_ATMOSPHERE: 99;
    readonly FX_BRIGHTNESS: 100;
    readonly FX_GOBLINS: 101;
    readonly FX_ECHOES: 102;
    readonly FX_SCI_FI: 103;
    readonly SITAR: 104;
    readonly BANJO: 105;
    readonly SHAMISEN: 106;
    readonly KOTO: 107;
    readonly KALIMBA: 108;
    readonly BAGPIPE: 109;
    readonly FIDDLE: 110;
    readonly SHANAI: 111;
    readonly TINKLE_BELL: 112;
    readonly AGOGO: 113;
    readonly STEEL_DRUMS: 114;
    readonly WOODBLOCK: 115;
    readonly TAIKO_DRUM: 116;
    readonly MELODIC_TOM: 117;
    readonly SYNTH_DRUM: 118;
    readonly REVERSE_CYMBAL: 119;
    readonly GUITAR_FRET_NOISE: 120;
    readonly BREATH_NOISE: 121;
    readonly SEASHORE: 122;
    readonly BIRD_TWEET: 123;
    readonly TELEPHONE_RING: 124;
    readonly HELICOPTER: 125;
    readonly APPLAUSE: 126;
    readonly GUNSHOT: 127;
};
/**
 * General MIDI drum map (channel 10).
 * Note numbers for standard drum sounds.
 * KERNEL-SAFE: Frozen constants.
 */
export declare const GM_DRUM: {
    readonly ACOUSTIC_BASS_DRUM: 35;
    readonly BASS_DRUM_1: 36;
    readonly SIDE_STICK: 37;
    readonly ACOUSTIC_SNARE: 38;
    readonly HAND_CLAP: 39;
    readonly ELECTRIC_SNARE: 40;
    readonly LOW_FLOOR_TOM: 41;
    readonly CLOSED_HI_HAT: 42;
    readonly HIGH_FLOOR_TOM: 43;
    readonly PEDAL_HI_HAT: 44;
    readonly LOW_TOM: 45;
    readonly OPEN_HI_HAT: 46;
    readonly LOW_MID_TOM: 47;
    readonly HI_MID_TOM: 48;
    readonly CRASH_CYMBAL_1: 49;
    readonly HIGH_TOM: 50;
    readonly RIDE_CYMBAL_1: 51;
    readonly CHINESE_CYMBAL: 52;
    readonly RIDE_BELL: 53;
    readonly TAMBOURINE: 54;
    readonly SPLASH_CYMBAL: 55;
    readonly COWBELL: 56;
    readonly CRASH_CYMBAL_2: 57;
    readonly VIBRASLAP: 58;
    readonly RIDE_CYMBAL_2: 59;
    readonly HI_BONGO: 60;
    readonly LOW_BONGO: 61;
    readonly MUTE_HI_CONGA: 62;
    readonly OPEN_HI_CONGA: 63;
    readonly LOW_CONGA: 64;
    readonly HIGH_TIMBALE: 65;
    readonly LOW_TIMBALE: 66;
    readonly HIGH_AGOGO: 67;
    readonly LOW_AGOGO: 68;
    readonly CABASA: 69;
    readonly MARACAS: 70;
    readonly SHORT_WHISTLE: 71;
    readonly LONG_WHISTLE: 72;
    readonly SHORT_GUIRO: 73;
    readonly LONG_GUIRO: 74;
    readonly CLAVES: 75;
    readonly HI_WOOD_BLOCK: 76;
    readonly LOW_WOOD_BLOCK: 77;
    readonly MUTE_CUICA: 78;
    readonly OPEN_CUICA: 79;
    readonly MUTE_TRIANGLE: 80;
    readonly OPEN_TRIANGLE: 81;
};
/**
 * Convert MIDI velocity (0-127) to normalized (0-1).
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param midi - MIDI velocity (0-127)
 * @returns Normalized velocity (0-1), clamped
 */
export declare function midiVelocityToNormalized(midi: number): number;
/**
 * Convert normalized velocity (0-1) to MIDI (0-127).
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param normalized - Normalized velocity (0-1)
 * @returns MIDI velocity (0-127), clamped and rounded
 */
export declare function normalizedToMidiVelocity(normalized: number): number;
/**
 * Branded MIDI channel (0-15).
 */
export type MidiChannel = number & {
    readonly __brand: 'MidiChannel';
};
/**
 * Branded MIDI value (0-127).
 */
export type MidiValue = number & {
    readonly __brand: 'MidiValue';
};
/**
 * Branded MIDI CC number (0-127).
 */
export type MidiControlID = number & {
    readonly __brand: 'MidiControlID';
};
/**
 * Branded instrument identifier.
 */
export type InstrumentId = string & {
    readonly __brand: 'InstrumentId';
};
/**
 * Create validated MidiChannel.
 * COMPOSER-ONLY: Validation and branding.
 *
 * @param val - Channel number (0-15)
 * @returns MidiChannel or null if invalid
 */
export declare function midiChannel(val: number): MidiChannel | null;
/**
 * Create validated MidiValue.
 * COMPOSER-ONLY: Validation and branding.
 *
 * @param val - MIDI value (0-127)
 * @returns MidiValue or null if invalid
 */
export declare function midiValue(val: number): MidiValue | null;
/**
 * Create validated MidiControlID.
 * COMPOSER-ONLY: Validation and branding.
 *
 * @param val - CC number (0-127)
 * @returns MidiControlID or null if invalid
 */
export declare function midiControl(val: number): MidiControlID | null;
/**
 * Create validated InstrumentId.
 * COMPOSER-ONLY: Validation and branding.
 *
 * @param id - Instrument identifier string
 * @returns InstrumentId or null if invalid
 */
export declare function instrumentId(id: string): InstrumentId | null;
/**
 * Type guard for InstrumentId.
 * KERNEL-SAFE: Pure type check.
 *
 * @param value - Value to check
 * @returns True if value is a valid InstrumentId
 */
export declare function isInstrumentId(value: unknown): value is InstrumentId;
/**
 * Unsafe cast to InstrumentId (for internal use).
 * COMPOSER-ONLY: No validation performed.
 *
 * @param id - String to cast (must be pre-validated)
 * @returns InstrumentId (unchecked)
 */
export declare function unsafeInstrumentId(id: string): InstrumentId;
//# sourceMappingURL=midi.d.ts.map