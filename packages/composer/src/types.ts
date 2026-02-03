export const SCHEMA_VERSION = 1;

export interface ClipNode {
    readonly _version: number;
    kind: 'clip';
    name: string;
    operations: (NoteOperation | LoopOp | ClipOp)[];
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
