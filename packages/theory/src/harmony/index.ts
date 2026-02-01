/**
 * RFC-047: Harmony Module (24-EDO Native)
 *
 * Chord progressions, voice leading, and key signatures.
 */

// Chord progressions
export {
    type KeyContext,
    type ParsedNumeral,
    parseRomanNumeral,
    getDegreeInterval,
    degreeToMask,
    romanToMask,
    progressionToMasks,
    PROGRESSION,
    createKey,
    KEY_ROOT,
} from './progressions';

// Voice leading
export {
    type VoiceLeadOptions,
    type VoiceMovement,
    voiceMovementCost,
    closeVoicing,
    openVoicing,
    drop2Voicing,
    voiceLead,
    voiceLeadProgression,
    pitchToInterval,
    pitchToOctave,
    createPitch,
} from './voiceleading';

// Key signatures
export {
    getKeySharps,
    getKeyFlats,
    getKeyAccidentals,
    isValidKey,
    countSharps,
    countFlats,
    isSharpedInKey,
    isFlattedInKey,
    applyKeyToPitchClass,
    getRelativeMinor,
    getRelativeMajor,
    getParallelMinor,
    getParallelMajor,
    ALL_KEYS,
    MAJOR_KEYS_CIRCLE,
    MINOR_KEYS_CIRCLE,
    applyKeySignature,
    type AccidentalOverride,
} from './keys';

// Helper types
export * from './types';
