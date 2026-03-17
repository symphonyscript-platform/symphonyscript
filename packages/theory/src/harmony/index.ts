/**
 * RFC-047: Harmony Module (24-EDO Native)
 *
 * Voice leading algorithms (pure math, stays in theory).
 *
 * NOTE: Chord progressions, key signatures, and roman numerals
 * have been extracted to @symphonyscript/notations.
 */

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

// Helper types
export * from './types';
