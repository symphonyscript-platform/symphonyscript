export declare const SCHEMA_VERSION = 1;
export interface ClipNode {
    readonly _version: number;
    kind: 'clip';
    name: string;
    operations: (NoteOperation | LoopOp | ClipOp | CCOperation | PitchBendOperation)[];
    tempo?: number;
    timeSignature?: [number, number];
    swing?: number;
    groove?: string | null;
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
    controller: number;
    value: number;
    tick: number;
}
/**
 * Pitch Bend operation for MIDI pitch bend messages.
 * Used for string bends, vibrato, and other pitch modulation.
 * Standard MIDI pitch bend is 14-bit (-8192 to +8191, center = 0).
 */
export interface PitchBendOperation {
    kind: 'pitchBend';
    value: number;
    tick: number;
}
export type ScaleMode = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian';
export interface ScaleContext {
    root: string;
    mode: ScaleMode;
    octave: number;
}
export interface DegreeOptions {
    octaveOffset?: number;
    alteration?: number;
}
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
    mode: 'major' | 'minor';
}
/**
 * Accidental override for the next note.
 * - 'sharp': Raise by semitone
 * - 'flat': Lower by semitone
 * - 'natural': Use natural (override key signature)
 */
export type Accidental = 'sharp' | 'flat' | 'natural';
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
/**
 * Dynamics operation for gradual volume changes.
 */
export interface DynamicsOp {
    kind: 'dynamics';
    type: 'crescendo' | 'decrescendo' | 'ramp' | 'curve';
    from: number;
    to: number;
    duration: number;
    curve?: 'linear' | 'exponential' | 'ease-in' | 'ease-out';
}
/**
 * A single point on a velocity curve.
 */
export interface VelocityPoint {
    tick: number;
    velocity: number;
}
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
export interface EuclideanDrumOptions {
    /** Number of hits to place */
    hits: number;
    /** Total number of steps in the pattern */
    steps: number;
    /** Drum sound to use */
    drum: 'kick' | 'snare' | 'hat' | 'clap' | 'tom';
    /** Duration of each step */
    stepDuration: number;
    /** Velocity for hits (0-1, default: 0.8) */
    velocity?: number;
    /** Rotation offset (positive = rotate right, default: 0) */
    rotation?: number;
    /** Number of times to repeat the pattern (default: 1) */
    repeat?: number;
}
/**
 * Arpeggio pattern types.
 * - 'up': ascending order
 * - 'down': descending order
 * - 'upDown': ascending then descending
 * - 'downUp': descending then ascending
 * - 'random': random order (use seed for reproducibility)
 * - 'converge': outer → inner (first, last, second, second-last, ...)
 * - 'diverge': inner → outer (middle outward)
 */
export type ArpPattern = 'up' | 'down' | 'upDown' | 'downUp' | 'random' | 'converge' | 'diverge';
/**
 * Options for arpeggio generation.
 */
export interface ArpeggioOptions {
    /** Arpeggio pattern (default: 'up') */
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
//# sourceMappingURL=types.d.ts.map