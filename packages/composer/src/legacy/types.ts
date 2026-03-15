export const SCHEMA_VERSION = 1;

export interface ClipNode {
    readonly _version: number;
    kind: 'clip';
    name: string;
    operations: (NoteOperation | LoopOp | ClipOp | CCOperation | PitchBendOperation | AftertouchOperation | AutomationOperation | ScopeOp | TempoEnvelopeOp)[];
    tempo?: number;
    timeSignature?: [number, number];
    swing?: number;
    groove?: string | null;
    loopRegion?: {
        start: number;
        end: number;
        enabled: boolean;
    };
}

export interface NoteOperation {
    kind: 'note';
    pitch: number;
    velocity: number;
    duration: number;
    tick: number;
    muted: boolean;
    sourceId: number;
    legato?: boolean;
    expressionId?: number;  // MPE voice channel (1-15)
}

export interface LoopOp {
    kind: 'loop';
    count: number;
    operations: NoteOperation[];
}

export interface ClipOp {
    kind: 'clip';
    clip: ClipNode;
}

/**
 * CC (Control Change) operation for MIDI controller messages.
 * Used for sustain pedal (CC64), modulation, expression, etc.
 */
export interface CCOperation {
    kind: 'cc';
    controller: number;  // CC number (64 = sustain)
    value: number;       // 0-127
    tick: number;
}

/**
 * Pitch Bend operation for MIDI pitch bend messages.
 * Used for string bends, vibrato, and other pitch modulation.
 * Standard MIDI pitch bend is 14-bit (-8192 to +8191, center = 0).
 */
export interface PitchBendOperation {
    kind: 'pitchBend';
    value: number;  // -8192 to +8191 (center = 0)
    tick: number;
}

/**
 * Aftertouch operation for MIDI pressure messages.
 * Channel aftertouch affects all notes, poly aftertouch affects specific notes.
 */
/**
 * Aftertouch type: channel (all notes) or poly (specific note).
 */
export const AftertouchType = {
    CHANNEL: 0,
    POLY: 1,
} as const;
export type AftertouchType = (typeof AftertouchType)[keyof typeof AftertouchType];

export interface AftertouchOperation {
    kind: 'aftertouch';
    type: AftertouchType;
    value: number;       // 0-127 (scaled from 0-1 input)
    note?: number;       // MIDI note for poly aftertouch
    tick: number;
}

/**
 * Automation target parameters.
 */
export const AutomationTarget = {
    VOLUME: 0,
    PAN: 1,
    FILTER: 2,
    RESONANCE: 3,
    ATTACK: 4,
    RELEASE: 5,
} as const;
export type AutomationTarget = (typeof AutomationTarget)[keyof typeof AutomationTarget];

/**
 * Curve type for automation, dynamics, and tempo transitions.
 */
export const CurveType = {
    LINEAR: 0,
    EXPONENTIAL: 1,
    SMOOTH: 2,
    EASE_IN: 3,
    EASE_OUT: 4,
    EASE_IN_OUT: 5,
} as const;
export type CurveType = (typeof CurveType)[keyof typeof CurveType];

/**
 * Automation operation for parameter changes over time.
 */
export interface AutomationOperation {
    kind: 'automation';
    target: AutomationTarget;
    value: number;           // Normalized (volume: 0-1, pan: -1 to 1)
    rampBeats?: number;      // Duration to ramp (instant if undefined)
    curve?: CurveType;
    tick: number;
}

export const ScaleMode = {
    NONE: 0,
    MAJOR: 1,
    MINOR: 2,
    DORIAN: 3,
    PHRYGIAN: 4,
    LYDIAN: 5,
    MIXOLYDIAN: 6,
    LOCRIAN: 7,
} as const;
export type ScaleMode = (typeof ScaleMode)[keyof typeof ScaleMode];

export interface ScaleContext {
    root: string;      // 'C', 'G', 'F#', etc.
    mode: ScaleMode;
    octave: number;    // Base octave (4 = middle C octave)
}

/** Pitch class 0-11 to root string. Used for scale context conversion. */
export const PITCH_CLASS_TO_ROOT: readonly string[] = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

export interface DegreeOptions {
    octaveOffset?: number;   // Shift octaves (+1 = up, -1 = down)
    alteration?: number;     // Semitone alteration (+1 = sharp, -1 = flat)
}

// ============================================================================
// Key Signature Types (RFC-022)
// ============================================================================

/**
 * Key signature context for automatic accidental application.
 * 
 * Unlike ScaleContext (used for degree-based notation), KeyContext
 * modifies literal note names: note('F4') becomes F#4 in G major.
 */
export interface KeyContext {
    /** Key root (e.g., 'G', 'Bb') */
    root: string;
    /** Key mode (major or minor) */
    mode: ScaleMode;
}

/**
 * Accidental override for the next note.
 * - SHARP: Raise by semitone
 * - FLAT: Lower by semitone
 * - NATURAL: Use natural (override key signature)
 */
export const Accidental = {
    NONE: 0,
    SHARP: 1,
    FLAT: 2,
    NATURAL: 3,
} as const;
export type Accidental = (typeof Accidental)[keyof typeof Accidental];

// ============================================================================
// Track Types (RFC-020)
// ============================================================================

import type { InsertEffect, SendConfig, EffectBusConfig } from '@symphonyscript/theory';

/**
 * Track node representing a clip associated with an instrument and effects.
 */
export interface TrackNode {
    readonly _version: number;
    kind: 'track';
    name: string;
    instrumentId: string;
    clip: ClipNode;
    tempo?: number;
    timeSignature?: [number, number];
    inserts: InsertEffect[];
    sends: SendConfig[];
}

/**
 * Interface for objects that can build a ClipNode.
 */
export interface ClipBuilder {
    build(): ClipNode;
}

// ============================================================================
// Session Types (RFC-021)
// ============================================================================

/**
 * Session node representing a complete musical composition.
 */
export interface SessionNode {
    readonly _version: number;
    kind: 'session';
    name: string;
    tempo?: number;
    timeSignature?: [number, number];
    tracks: TrackNode[];
    buses: EffectBusConfig[];
}

// ============================================================================
// Dynamics Types (Task 024)
// ============================================================================

export const DynamicsType = {
    NONE: 0,
    STATIC: 1,
    CRESCENDO: 2,
    DECRESCENDO: 3,
    RAMP: 4,
    CURVE: 5,
} as const;
export type DynamicsType = (typeof DynamicsType)[keyof typeof DynamicsType];

/**
 * A single point on a velocity curve.
 */
export interface VelocityPoint {
    tick: number;       // Relative tick offset
    velocity: number;   // Velocity (0-1)
}

// ============================================================================
// Euclidean Rhythm Types (Task 028)
// ============================================================================

/**
 * Options for generating Euclidean rhythms on melody clips.
 */
export interface EuclideanMelodyOptions {
    /** Number of hits (notes) to place */
    hits: number;
    /** Total number of steps in the pattern */
    steps: number;
    /** Notes to cycle through for each hit */
    notes: (string | number)[];
    /** Duration of each step */
    stepDuration: number;
    /** Velocity for notes (0-1, default: 0.8) */
    velocity?: number;
    /** Rotation offset (positive = rotate right, default: 0) */
    rotation?: number;
    /** Number of times to repeat the pattern (default: 1) */
    repeat?: number;
}

/**
 * Options for generating Euclidean rhythms on drum clips.
 */
/**
 * Drum type for Euclidean rhythm patterns.
 */
export const DrumType = {
    KICK: 0,
    SNARE: 1,
    HAT: 2,
    CLAP: 3,
    TOM: 4,
} as const;
export type DrumType = (typeof DrumType)[keyof typeof DrumType];

export interface EuclideanDrumOptions {
    /** Number of hits to place */
    hits: number;
    /** Total number of steps in the pattern */
    steps: number;
    /** Drum sound to use */
    drum: DrumType;
    /** Duration of each step */
    stepDuration: number;
    /** Velocity for hits (0-1, default: 0.8) */
    velocity?: number;
    /** Rotation offset (positive = rotate right, default: 0) */
    rotation?: number;
    /** Number of times to repeat the pattern (default: 1) */
    repeat?: number;
}

// ============================================================================
// Arpeggio Types (Task 029)
// ============================================================================

/**
 * Arpeggio pattern types.
 */
export const ArpPattern = {
    UP: 0,
    DOWN: 1,
    UP_DOWN: 2,
    DOWN_UP: 3,
    RANDOM: 4,
    CONVERGE: 5,
    DIVERGE: 6,
} as const;
export type ArpPattern = (typeof ArpPattern)[keyof typeof ArpPattern];

/**
 * Options for arpeggio generation.
 */
export interface ArpeggioOptions {
    /** Arpeggio pattern (default: ArpPattern.UP) */
    pattern?: ArpPattern;
    /** Velocity for notes (0-1, default: 0.8) */
    velocity?: number;
    /** Gate: note duration multiplier (0-1, default: 0.8) */
    gate?: number;
    /** Number of octaves to expand (default: 1) */
    octaves?: number;
    /** Seed for reproducible random pattern */
    seed?: number;
}

// ============================================================================
// Humanization Types (Task 031)
// ============================================================================

/**
 * Settings for clip-level humanization.
 * Applied to all notes unless overridden with precise().
 */
export interface HumanizeSettings {
    /** Max timing offset in ms (default: 0) */
    timing?: number;
    /** Max velocity variation (0-1, default: 0) */
    velocity?: number;
    /** Seed for reproducible humanization */
    seed?: number;
}

// ============================================================================
// Quantize Types (Task 032)
// ============================================================================

/**
 * Settings for snap-to-grid timing correction.
 * Applied in flushNote() pipeline: Quantize → Groove → Humanize
 */
export interface QuantizeSettings {
    /** Grid size in beats (e.g., 0.25 = 16th notes, 0.5 = 8th notes) */
    grid: number;
    /** How much to snap (0-1, default: 1 = full snap) */
    strength?: number;
    /** Also quantize note duration (default: false) */
    duration?: boolean;
}

// ============================================================================
// Freeze Types (Task 038)
// ============================================================================

/**
 * Options for freezing a clip for reuse.
 */
export interface FreezeOptions {
    /** Tempo for the frozen clip */
    bpm?: number;
    /** Time signature for the frozen clip */
    timeSignature?: [number, number];
}

// ============================================================================
// Drum Mapping Types (Task 040)
// ============================================================================

/**
 * Custom drum mapping type.
 * Maps drum names to pitch values (note names or MIDI numbers).
 */
export type DrumMap = Record<string, string | number>;

// ============================================================================
// Scope Isolation Types (Task 039)
// ============================================================================

/**
 * Options for scope isolation.
 * Specifies which state changes should be isolated to the scope.
 */
export interface ScopeIsolation {
    /** Isolate tempo changes */
    tempo?: boolean;
    /** Isolate dynamics changes */
    dynamics?: boolean;
    /** Isolate time signature changes */
    timeSignature?: boolean;
}

/**
 * Scope operation that wraps isolated operations.
 */
export interface ScopeOp {
    kind: 'scope';
    isolate: ScopeIsolation;
    operations: (NoteOperation | CCOperation | AftertouchOperation | AutomationOperation)[];
}

// ============================================================================
// Tempo Envelope Types (Task 042)
// ============================================================================

/**
 * A single keyframe in a tempo envelope.
 */
export interface TempoKeyframe {
    /** Beat position for this keyframe */
    beat: number;
    /** Target BPM at this keyframe */
    bpm: number;
    /** Curve type for transition to this keyframe (default: CurveType.LINEAR) */
    curve?: CurveType;
}

/**
 * Tempo envelope operation for multi-keyframe tempo transitions.
 */
export interface TempoEnvelopeOp {
    kind: 'tempoEnvelope';
    keyframes: TempoKeyframe[];
    tick: number;
}

// ============================================================================
// Operations Source Interface (Task 046)
// ============================================================================

/**
 * Union type for all operation types that can be in a clip.
 */
export type ClipOperation = NoteOperation | LoopOp | ClipOp | CCOperation | PitchBendOperation | AftertouchOperation | AutomationOperation | ScopeOp | TempoEnvelopeOp;

/**
 * Interface for objects that can provide their operations as an array.
 * Used by loop() and play() to accept both clips and frozen clips as content sources.
 */
export interface OperationsSource {
    /**
     * Returns a snapshot of the current operations.
     * @returns Array of operations
     */
    toOperations(): ClipOperation[];
}
