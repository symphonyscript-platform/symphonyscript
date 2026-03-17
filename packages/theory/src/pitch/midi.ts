/**
 * RFC-047: MIDI Constants & Velocity Utilities
 *
 * Standard MIDI Control Change numbers, General MIDI constants,
 * and velocity conversion utilities.
 *
 * KERNEL-SAFE: All constants are frozen primitives.
 * Functions are zero-allocation pure arithmetic.
 *
 * NOTE: Note name parsing, MIDI conversion, and branded types have been
 * extracted to @symphonyscript/notations.
 */

// ============================================================================
// SECTION 1: MIDI CC Constants
// ============================================================================

/**
 * Standard MIDI Control Change numbers.
 * KERNEL-SAFE: Frozen constants.
 */
export const MIDI_CC = {
    // Standard Controllers
    BANK_SELECT_MSB: 0,
    MODULATION: 1,
    BREATH: 2,
    FOOT: 4,
    PORTAMENTO_TIME: 5,
    DATA_ENTRY_MSB: 6,
    VOLUME: 7,
    BALANCE: 8,
    PAN: 10,
    EXPRESSION: 11,
    EFFECT_1: 12,
    EFFECT_2: 13,

    // LSB Controllers (32-63)
    BANK_SELECT_LSB: 32,
    DATA_ENTRY_LSB: 38,

    // Pedals and Switches
    SUSTAIN: 64,
    PORTAMENTO: 65,
    SOSTENUTO: 66,
    SOFT_PEDAL: 67,
    LEGATO: 68,
    HOLD_2: 69,

    // Sound Controllers
    SOUND_VARIATION: 70,
    TIMBRE: 71,
    RELEASE_TIME: 72,
    ATTACK_TIME: 73,
    BRIGHTNESS: 74,
    DECAY_TIME: 75,
    VIBRATO_RATE: 76,
    VIBRATO_DEPTH: 77,
    VIBRATO_DELAY: 78,

    // Effects
    REVERB: 91,
    TREMOLO: 92,
    CHORUS: 93,
    DETUNE: 94,
    PHASER: 95,

    // Channel Mode Messages
    ALL_SOUND_OFF: 120,
    RESET_ALL: 121,
    LOCAL_CONTROL: 122,
    ALL_NOTES_OFF: 123,
    OMNI_OFF: 124,
    OMNI_ON: 125,
    MONO_ON: 126,
    POLY_ON: 127,
} as const;

// ============================================================================
// SECTION 2: General MIDI Constants
// ============================================================================

/**
 * General MIDI program numbers (0-indexed).
 * KERNEL-SAFE: Frozen constants.
 */
export const GM_PROGRAM = {
    // Piano (0-7)
    ACOUSTIC_GRAND: 0,
    BRIGHT_ACOUSTIC: 1,
    ELECTRIC_GRAND: 2,
    HONKY_TONK: 3,
    ELECTRIC_PIANO_1: 4,
    ELECTRIC_PIANO_2: 5,
    HARPSICHORD: 6,
    CLAVINET: 7,

    // Chromatic Percussion (8-15)
    CELESTA: 8,
    GLOCKENSPIEL: 9,
    MUSIC_BOX: 10,
    VIBRAPHONE: 11,
    MARIMBA: 12,
    XYLOPHONE: 13,
    TUBULAR_BELLS: 14,
    DULCIMER: 15,

    // Organ (16-23)
    DRAWBAR_ORGAN: 16,
    PERCUSSIVE_ORGAN: 17,
    ROCK_ORGAN: 18,
    CHURCH_ORGAN: 19,
    REED_ORGAN: 20,
    ACCORDION: 21,
    HARMONICA: 22,
    TANGO_ACCORDION: 23,

    // Guitar (24-31)
    ACOUSTIC_NYLON: 24,
    ACOUSTIC_STEEL: 25,
    ELECTRIC_JAZZ: 26,
    ELECTRIC_CLEAN: 27,
    ELECTRIC_MUTED: 28,
    OVERDRIVEN: 29,
    DISTORTION: 30,
    HARMONICS: 31,

    // Bass (32-39)
    ACOUSTIC_BASS: 32,
    ELECTRIC_BASS_FINGER: 33,
    ELECTRIC_BASS_PICK: 34,
    FRETLESS_BASS: 35,
    SLAP_BASS_1: 36,
    SLAP_BASS_2: 37,
    SYNTH_BASS_1: 38,
    SYNTH_BASS_2: 39,

    // Strings (40-47)
    VIOLIN: 40,
    VIOLA: 41,
    CELLO: 42,
    CONTRABASS: 43,
    TREMOLO_STRINGS: 44,
    PIZZICATO_STRINGS: 45,
    ORCHESTRAL_HARP: 46,
    TIMPANI: 47,

    // Ensemble (48-55)
    STRING_ENSEMBLE_1: 48,
    STRING_ENSEMBLE_2: 49,
    SYNTH_STRINGS_1: 50,
    SYNTH_STRINGS_2: 51,
    CHOIR_AAHS: 52,
    VOICE_OOHS: 53,
    SYNTH_VOICE: 54,
    ORCHESTRA_HIT: 55,

    // Brass (56-63)
    TRUMPET: 56,
    TROMBONE: 57,
    TUBA: 58,
    MUTED_TRUMPET: 59,
    FRENCH_HORN: 60,
    BRASS_SECTION: 61,
    SYNTH_BRASS_1: 62,
    SYNTH_BRASS_2: 63,

    // Reed (64-71)
    SOPRANO_SAX: 64,
    ALTO_SAX: 65,
    TENOR_SAX: 66,
    BARITONE_SAX: 67,
    OBOE: 68,
    ENGLISH_HORN: 69,
    BASSOON: 70,
    CLARINET: 71,

    // Pipe (72-79)
    PICCOLO: 72,
    FLUTE: 73,
    RECORDER: 74,
    PAN_FLUTE: 75,
    BLOWN_BOTTLE: 76,
    SHAKUHACHI: 77,
    WHISTLE: 78,
    OCARINA: 79,

    // Synth Lead (80-87)
    LEAD_SQUARE: 80,
    LEAD_SAWTOOTH: 81,
    LEAD_CALLIOPE: 82,
    LEAD_CHIFF: 83,
    LEAD_CHARANG: 84,
    LEAD_VOICE: 85,
    LEAD_FIFTHS: 86,
    LEAD_BASS_LEAD: 87,

    // Synth Pad (88-95)
    PAD_NEW_AGE: 88,
    PAD_WARM: 89,
    PAD_POLYSYNTH: 90,
    PAD_CHOIR: 91,
    PAD_BOWED: 92,
    PAD_METALLIC: 93,
    PAD_HALO: 94,
    PAD_SWEEP: 95,

    // Synth Effects (96-103)
    FX_RAIN: 96,
    FX_SOUNDTRACK: 97,
    FX_CRYSTAL: 98,
    FX_ATMOSPHERE: 99,
    FX_BRIGHTNESS: 100,
    FX_GOBLINS: 101,
    FX_ECHOES: 102,
    FX_SCI_FI: 103,

    // Ethnic (104-111)
    SITAR: 104,
    BANJO: 105,
    SHAMISEN: 106,
    KOTO: 107,
    KALIMBA: 108,
    BAGPIPE: 109,
    FIDDLE: 110,
    SHANAI: 111,

    // Percussive (112-119)
    TINKLE_BELL: 112,
    AGOGO: 113,
    STEEL_DRUMS: 114,
    WOODBLOCK: 115,
    TAIKO_DRUM: 116,
    MELODIC_TOM: 117,
    SYNTH_DRUM: 118,
    REVERSE_CYMBAL: 119,

    // Sound Effects (120-127)
    GUITAR_FRET_NOISE: 120,
    BREATH_NOISE: 121,
    SEASHORE: 122,
    BIRD_TWEET: 123,
    TELEPHONE_RING: 124,
    HELICOPTER: 125,
    APPLAUSE: 126,
    GUNSHOT: 127,
} as const;

/**
 * General MIDI drum map (channel 10).
 * Note numbers for standard drum sounds.
 * KERNEL-SAFE: Frozen constants.
 */
export const GM_DRUM = {
    ACOUSTIC_BASS_DRUM: 35,
    BASS_DRUM_1: 36,
    SIDE_STICK: 37,
    ACOUSTIC_SNARE: 38,
    HAND_CLAP: 39,
    ELECTRIC_SNARE: 40,
    LOW_FLOOR_TOM: 41,
    CLOSED_HI_HAT: 42,
    HIGH_FLOOR_TOM: 43,
    PEDAL_HI_HAT: 44,
    LOW_TOM: 45,
    OPEN_HI_HAT: 46,
    LOW_MID_TOM: 47,
    HI_MID_TOM: 48,
    CRASH_CYMBAL_1: 49,
    HIGH_TOM: 50,
    RIDE_CYMBAL_1: 51,
    CHINESE_CYMBAL: 52,
    RIDE_BELL: 53,
    TAMBOURINE: 54,
    SPLASH_CYMBAL: 55,
    COWBELL: 56,
    CRASH_CYMBAL_2: 57,
    VIBRASLAP: 58,
    RIDE_CYMBAL_2: 59,
    HI_BONGO: 60,
    LOW_BONGO: 61,
    MUTE_HI_CONGA: 62,
    OPEN_HI_CONGA: 63,
    LOW_CONGA: 64,
    HIGH_TIMBALE: 65,
    LOW_TIMBALE: 66,
    HIGH_AGOGO: 67,
    LOW_AGOGO: 68,
    CABASA: 69,
    MARACAS: 70,
    SHORT_WHISTLE: 71,
    LONG_WHISTLE: 72,
    SHORT_GUIRO: 73,
    LONG_GUIRO: 74,
    CLAVES: 75,
    HI_WOOD_BLOCK: 76,
    LOW_WOOD_BLOCK: 77,
    MUTE_CUICA: 78,
    OPEN_CUICA: 79,
    MUTE_TRIANGLE: 80,
    OPEN_TRIANGLE: 81,
} as const;

// ============================================================================
// SECTION 3: Velocity Conversion
// ============================================================================

/**
 * Convert MIDI velocity (0-127) to normalized (0-1).
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param midi - MIDI velocity (0-127)

 * @returns Normalized velocity (0-1), clamped
 */
export function midiVelocityToNormalized(midi: number): number {
    if (!Number.isFinite(midi)) return 0;
    // Clamp to valid range and normalize
    const clamped = Math.max(0, Math.min(127, midi));
    return clamped / 127;
}

/**
 * Convert normalized velocity (0-1) to MIDI (0-127).
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param normalized - Normalized velocity (0-1)

 * @returns MIDI velocity (0-127), clamped and rounded
 */
export function normalizedToMidiVelocity(normalized: number): number {
    if (!Number.isFinite(normalized)) return 0;
    // Clamp to valid range and scale
    const clamped = Math.max(0, Math.min(1, normalized));
    return Math.round(clamped * 127);
}
