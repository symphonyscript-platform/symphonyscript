export const SCHEMA_VERSION = 1;

export interface ClipNode {
    readonly _version: number;
    kind: 'clip';
    name: string;
    operations: (NoteOperation | LoopOp | ClipOp | CCOperation)[];
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

export type ScaleMode = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian';

export interface ScaleContext {
    root: string;      // 'C', 'G', 'F#', etc.
    mode: ScaleMode;
    octave: number;    // Base octave (4 = middle C octave)
}

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
    mode: 'major' | 'minor';
}

/**
 * Accidental override for the next note.
 * - 'sharp': Raise by semitone
 * - 'flat': Lower by semitone
 * - 'natural': Use natural (override key signature)
 */
export type Accidental = 'sharp' | 'flat' | 'natural';

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

/**
 * Dynamics operation for gradual volume changes.
 */
export interface DynamicsOp {
    kind: 'dynamics';
    type: 'crescendo' | 'decrescendo' | 'ramp' | 'curve';
    from: number;       // Starting velocity (0-1)
    to: number;         // Ending velocity (0-1)
    duration: number;   // Duration in ticks
    curve?: 'linear' | 'exponential' | 'ease-in' | 'ease-out';
}

/**
 * A single point on a velocity curve.
 */
export interface VelocityPoint {
    tick: number;       // Relative tick offset
    velocity: number;   // Velocity (0-1)
}
