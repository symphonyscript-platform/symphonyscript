/**
 * Tests for Type Definitions (PORT-018 through PORT-022)
 */

import {
    // Chord types (PORT-018)
    type ChordRoot,
    type ChordSuffix,
    type ChordQuality,
    type ChordCode,
    CHORD_ROOTS,
    CHORD_SUFFIXES,
    isValidChordRoot,
    isChordSuffix,
} from '../chords/types';

import {
    // Harmony types (PORT-019)
    type Accidental,
    type VoiceLeadingStyle,
    ACCIDENTALS,
    VOICE_LEADING_STYLES,
    isAccidental,
    isVoiceLeadingStyle,
} from '../harmony/types';

import {
    // Rhythm types (PORT-020)
    type Velocity,
    type ArpPattern,
    type TimeSignatureString,
    ARP_PATTERNS,
    isArpPattern,
    isTimeSignatureString,
    isValidVelocity,
} from '../rhythm/types';

import {
    // Tempo types (PORT-021)
    type TempoCurve,
    type EasingCurve,
    type TempoKeyframe,
    type TempoEnvelope,
    TEMPO_CURVES,
    EASING_CURVES,
    isTempoCurve,
    isEasingCurve,
    isValidTempoKeyframe,
    createTempoKeyframe,
    createTempoEnvelope,
} from '../rhythm/tempo';

import {
    // Effects types (PORT-022)
    type EffectType,
    type FilterType,
    EFFECT_TYPES,
    FILTER_TYPES,
    isEffectType,
    isFilterType,
    createInsertEffect,
    createSendConfig,
    createEffectBusConfig,
} from '../effects/types';

// ============================================================================
// PORT-018: Chord Helper Types
// ============================================================================

describe('Chord Helper Types (PORT-018)', () => {
    describe('CHORD_ROOTS', () => {
        test('contains all 17 roots', () => {
            expect(CHORD_ROOTS).toHaveLength(17);
        });

        test('includes naturals, sharps, and flats', () => {
            expect(CHORD_ROOTS).toContain('C');
            expect(CHORD_ROOTS).toContain('C#');
            expect(CHORD_ROOTS).toContain('Db');
            expect(CHORD_ROOTS).toContain('B');
        });

        test('is frozen', () => {
            expect(Object.isFrozen(CHORD_ROOTS)).toBe(true);
        });
    });

    describe('CHORD_SUFFIXES', () => {
        test('contains all 20 suffixes', () => {
            expect(CHORD_SUFFIXES).toHaveLength(20);
        });

        test('includes common suffixes', () => {
            expect(CHORD_SUFFIXES).toContain('');
            expect(CHORD_SUFFIXES).toContain('m');
            expect(CHORD_SUFFIXES).toContain('7');
            expect(CHORD_SUFFIXES).toContain('maj7');
            expect(CHORD_SUFFIXES).toContain('dim');
        });
    });

    describe('isValidChordRoot()', () => {
        test('returns true for valid roots', () => {
            expect(isValidChordRoot('C')).toBe(true);
            expect(isValidChordRoot('F#')).toBe(true);
            expect(isValidChordRoot('Bb')).toBe(true);
        });

        test('returns false for invalid roots', () => {
            expect(isValidChordRoot('H')).toBe(false);
            expect(isValidChordRoot('c')).toBe(false);
            expect(isValidChordRoot('')).toBe(false);
        });
    });

    describe('isChordSuffix()', () => {
        test('returns true for valid suffixes', () => {
            expect(isChordSuffix('')).toBe(true);
            expect(isChordSuffix('m')).toBe(true);
            expect(isChordSuffix('maj7')).toBe(true);
        });

        test('returns false for invalid suffixes', () => {
            expect(isChordSuffix('xyz')).toBe(false);
            expect(isChordSuffix('major')).toBe(false);
        });
    });
});

// ============================================================================
// PORT-019: Harmony Helper Types
// ============================================================================

describe('Harmony Helper Types (PORT-019)', () => {
    describe('ACCIDENTALS', () => {
        test('contains all 3 accidentals', () => {
            expect(ACCIDENTALS).toHaveLength(3);
            expect(ACCIDENTALS).toContain('sharp');
            expect(ACCIDENTALS).toContain('flat');
            expect(ACCIDENTALS).toContain('natural');
        });
    });

    describe('VOICE_LEADING_STYLES', () => {
        test('contains all 3 styles', () => {
            expect(VOICE_LEADING_STYLES).toHaveLength(3);
            expect(VOICE_LEADING_STYLES).toContain('close');
            expect(VOICE_LEADING_STYLES).toContain('open');
            expect(VOICE_LEADING_STYLES).toContain('drop2');
        });
    });

    describe('isAccidental()', () => {
        test('returns true for valid accidentals', () => {
            expect(isAccidental('sharp')).toBe(true);
            expect(isAccidental('flat')).toBe(true);
            expect(isAccidental('natural')).toBe(true);
        });

        test('returns false for invalid accidentals', () => {
            expect(isAccidental('#')).toBe(false);
            expect(isAccidental('b')).toBe(false);
            expect(isAccidental('')).toBe(false);
        });
    });

    describe('isVoiceLeadingStyle()', () => {
        test('returns true for valid styles', () => {
            expect(isVoiceLeadingStyle('close')).toBe(true);
            expect(isVoiceLeadingStyle('open')).toBe(true);
            expect(isVoiceLeadingStyle('drop2')).toBe(true);
        });

        test('returns false for invalid styles', () => {
            expect(isVoiceLeadingStyle('spread')).toBe(false);
            expect(isVoiceLeadingStyle('')).toBe(false);
        });
    });
});

// ============================================================================
// PORT-020: Rhythm Helper Types
// ============================================================================

describe('Rhythm Helper Types (PORT-020)', () => {
    describe('ARP_PATTERNS', () => {
        test('contains all 7 patterns', () => {
            expect(ARP_PATTERNS).toHaveLength(7);
        });

        test('includes all pattern types', () => {
            expect(ARP_PATTERNS).toContain('up');
            expect(ARP_PATTERNS).toContain('down');
            expect(ARP_PATTERNS).toContain('upDown');
            expect(ARP_PATTERNS).toContain('random');
        });
    });

    describe('isArpPattern()', () => {
        test('returns true for valid patterns', () => {
            expect(isArpPattern('up')).toBe(true);
            expect(isArpPattern('down')).toBe(true);
            expect(isArpPattern('random')).toBe(true);
        });

        test('returns false for invalid patterns', () => {
            expect(isArpPattern('ascending')).toBe(false);
            expect(isArpPattern('')).toBe(false);
        });
    });

    describe('isTimeSignatureString()', () => {
        test('returns true for valid time signatures', () => {
            expect(isTimeSignatureString('4/4')).toBe(true);
            expect(isTimeSignatureString('3/4')).toBe(true);
            expect(isTimeSignatureString('6/8')).toBe(true);
            expect(isTimeSignatureString('12/8')).toBe(true);
        });

        test('returns false for invalid time signatures', () => {
            expect(isTimeSignatureString('4')).toBe(false);
            expect(isTimeSignatureString('4-4')).toBe(false);
            expect(isTimeSignatureString('')).toBe(false);
            expect(isTimeSignatureString('a/b')).toBe(false);
        });
    });

    describe('isValidVelocity()', () => {
        test('returns true for valid velocities', () => {
            expect(isValidVelocity(0)).toBe(true);
            expect(isValidVelocity(64)).toBe(true);
            expect(isValidVelocity(127)).toBe(true);
        });

        test('returns false for invalid velocities', () => {
            expect(isValidVelocity(-1)).toBe(false);
            expect(isValidVelocity(128)).toBe(false);
            expect(isValidVelocity(64.5)).toBe(false);
            expect(isValidVelocity(NaN)).toBe(false);
        });
    });
});

// ============================================================================
// PORT-021: Tempo Types
// ============================================================================

describe('Tempo Types (PORT-021)', () => {
    describe('TEMPO_CURVES', () => {
        test('contains all 4 curves', () => {
            expect(TEMPO_CURVES).toHaveLength(4);
            expect(TEMPO_CURVES).toContain('linear');
            expect(TEMPO_CURVES).toContain('ease-in');
            expect(TEMPO_CURVES).toContain('ease-out');
            expect(TEMPO_CURVES).toContain('ease-in-out');
        });
    });

    describe('EASING_CURVES', () => {
        test('contains all 7 curves', () => {
            expect(EASING_CURVES).toHaveLength(7);
            expect(EASING_CURVES).toContain('linear');
            expect(EASING_CURVES).toContain('exponential');
            expect(EASING_CURVES).toContain('smooth');
        });
    });

    describe('isTempoCurve()', () => {
        test('returns true for valid curves', () => {
            expect(isTempoCurve('linear')).toBe(true);
            expect(isTempoCurve('ease-in')).toBe(true);
        });

        test('returns false for invalid curves', () => {
            expect(isTempoCurve('exponential')).toBe(false);
            expect(isTempoCurve('')).toBe(false);
        });
    });

    describe('isEasingCurve()', () => {
        test('returns true for valid curves', () => {
            expect(isEasingCurve('linear')).toBe(true);
            expect(isEasingCurve('exponential')).toBe(true);
            expect(isEasingCurve('smooth')).toBe(true);
        });

        test('returns false for invalid curves', () => {
            expect(isEasingCurve('cubic')).toBe(false);
        });
    });

    describe('isValidTempoKeyframe()', () => {
        test('returns true for valid keyframes', () => {
            expect(isValidTempoKeyframe({ beat: 0, bpm: 120 })).toBe(true);
            expect(isValidTempoKeyframe({ beat: 4, bpm: 140, curve: 'linear' })).toBe(true);
        });

        test('returns false for invalid keyframes', () => {
            expect(isValidTempoKeyframe(null)).toBe(false);
            expect(isValidTempoKeyframe({})).toBe(false);
            expect(isValidTempoKeyframe({ beat: 0 })).toBe(false);
            expect(isValidTempoKeyframe({ beat: 0, bpm: 0 })).toBe(false);
            expect(isValidTempoKeyframe({ beat: 0, bpm: 120, curve: 'invalid' })).toBe(false);
        });
    });

    describe('createTempoKeyframe()', () => {
        test('creates valid keyframes', () => {
            expect(createTempoKeyframe(0, 120)).toEqual({ beat: 0, bpm: 120 });
            expect(createTempoKeyframe(4, 140, 'ease-in')).toEqual({ beat: 4, bpm: 140, curve: 'ease-in' });
        });

        test('returns null for invalid input', () => {
            expect(createTempoKeyframe(-1, 120)).toBeNull();
            expect(createTempoKeyframe(0, 0)).toBeNull();
            expect(createTempoKeyframe(0, 120, 'invalid' as any)).toBeNull();
        });
    });

    describe('createTempoEnvelope()', () => {
        test('creates valid envelopes', () => {
            const keyframes = [{ beat: 0, bpm: 120 }, { beat: 4, bpm: 140 }];
            const envelope = createTempoEnvelope(keyframes, 120);
            expect(envelope).not.toBeNull();
            expect(envelope!.keyframes).toEqual(keyframes);
            expect(envelope!.defaultBpm).toBe(120);
        });

        test('returns null for invalid input', () => {
            expect(createTempoEnvelope([], 0)).toBeNull();
            expect(createTempoEnvelope([], -1)).toBeNull();
        });
    });
});

// ============================================================================
// PORT-022: Effects Types
// ============================================================================

describe('Effects Types (PORT-022)', () => {
    describe('EFFECT_TYPES', () => {
        test('contains all 8 effect types', () => {
            expect(EFFECT_TYPES).toHaveLength(8);
            expect(EFFECT_TYPES).toContain('reverb');
            expect(EFFECT_TYPES).toContain('delay');
            expect(EFFECT_TYPES).toContain('compressor');
            expect(EFFECT_TYPES).toContain('custom');
        });
    });

    describe('FILTER_TYPES', () => {
        test('contains all 3 filter types', () => {
            expect(FILTER_TYPES).toHaveLength(3);
            expect(FILTER_TYPES).toContain('lowpass');
            expect(FILTER_TYPES).toContain('highpass');
            expect(FILTER_TYPES).toContain('bandpass');
        });
    });

    describe('isEffectType()', () => {
        test('returns true for valid effect types', () => {
            expect(isEffectType('reverb')).toBe(true);
            expect(isEffectType('delay')).toBe(true);
            expect(isEffectType('custom')).toBe(true);
        });

        test('returns false for invalid effect types', () => {
            expect(isEffectType('phaser')).toBe(false);
            expect(isEffectType('')).toBe(false);
        });
    });

    describe('isFilterType()', () => {
        test('returns true for valid filter types', () => {
            expect(isFilterType('lowpass')).toBe(true);
            expect(isFilterType('highpass')).toBe(true);
            expect(isFilterType('bandpass')).toBe(true);
        });

        test('returns false for invalid filter types', () => {
            expect(isFilterType('notch')).toBe(false);
            expect(isFilterType('')).toBe(false);
        });
    });

    describe('createInsertEffect()', () => {
        test('creates valid insert effects', () => {
            const reverb = createInsertEffect('reverb', { roomSize: 0.5, decay: 2 });
            expect(reverb).not.toBeNull();
            expect(reverb!.type).toBe('reverb');
            expect(reverb!.params).toEqual({ roomSize: 0.5, decay: 2 });
        });

        test('returns null for invalid type', () => {
            expect(createInsertEffect('invalid' as any, {})).toBeNull();
        });
    });

    describe('createSendConfig()', () => {
        test('creates valid send configs', () => {
            const send = createSendConfig('reverb-bus', 0.5);
            expect(send).not.toBeNull();
            expect(send!.bus).toBe('reverb-bus');
            expect(send!.amount).toBe(0.5);
        });

        test('returns null for invalid input', () => {
            expect(createSendConfig('', 0.5)).toBeNull();
            expect(createSendConfig('bus', -0.1)).toBeNull();
            expect(createSendConfig('bus', 1.1)).toBeNull();
        });
    });

    describe('createEffectBusConfig()', () => {
        test('creates valid bus configs', () => {
            const effects = [{ type: 'reverb' as const, params: { roomSize: 0.5 } }];
            const bus = createEffectBusConfig('reverb-bus', effects);
            expect(bus).not.toBeNull();
            expect(bus!.name).toBe('reverb-bus');
            expect(bus!.effects).toEqual(effects);
        });

        test('returns null for invalid input', () => {
            expect(createEffectBusConfig('', [])).toBeNull();
        });
    });
});
