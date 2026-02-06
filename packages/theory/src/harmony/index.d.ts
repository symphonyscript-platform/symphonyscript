/**
 * RFC-047: Harmony Module (24-EDO Native)
 *
 * Chord progressions, voice leading, and key signatures.
 */
export { type KeyContext, type ParsedNumeral, parseRomanNumeral, getDegreeInterval, degreeToMask, romanToMask, progressionToMasks, PROGRESSION, createKey, KEY_ROOT, romanToChord, degreeToRoot, progressionToChords, tritoneSubstitute, applyTritoneSubstitutions, } from './progressions';
export { type VoiceLeadOptions, type VoiceMovement, voiceMovementCost, closeVoicing, openVoicing, drop2Voicing, voiceLead, voiceLeadProgression, pitchToInterval, pitchToOctave, createPitch, } from './voiceleading';
export { getKeySharps, getKeyFlats, getKeyAccidentals, isValidKey, countSharps, countFlats, isSharpedInKey, isFlattedInKey, applyKeyToPitchClass, getRelativeMinor, getRelativeMajor, getParallelMinor, getParallelMajor, ALL_KEYS, MAJOR_KEYS_CIRCLE, MINOR_KEYS_CIRCLE, applyKeySignature, type AccidentalOverride, } from './keys';
export * from './types';
//# sourceMappingURL=index.d.ts.map