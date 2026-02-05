export * from './Clip';
export * from './SymphonyEngine';
export { Track } from './Track';
export type { TrackOptions } from './Track';

// Cursors
export { ComposerCursor } from './cursors/ComposerCursor';
export { SynapticNoteCursor } from './cursors/SynapticNoteCursor';
export { SynapticMelodyBaseCursor } from './cursors/SynapticMelodyBaseCursor';
export { SynapticMelodyNoteCursor } from './cursors/SynapticMelodyNoteCursor';
export { SynapticChordCursor } from './cursors/SynapticChordCursor';
export { SynapticDrumHitCursor } from './cursors/SynapticDrumHitCursor';

// Clips
export { SynapticClip } from './clips/SynapticClip';
export { SynapticMelody } from './clips/SynapticMelody';
export { SynapticDrums } from './clips/SynapticDrums';

// Groove
export { SynapticGrooveBuilder } from './groove/SynapticGrooveBuilder';
export type { GrooveTemplate } from './groove/SynapticGrooveBuilder';
export { GrooveStepCursor } from './groove/GrooveStepCursor';

// Utils
export { parsePitch } from './utils/pitch';
export { parseChord, packIntervals } from './utils/chord';

// Types
export type { ClipNode, ClipBuilder, TrackNode, NoteOperation, LoopOp, ClipOp, ScaleMode, ScaleContext, DegreeOptions } from './types';
export { SCHEMA_VERSION } from './types';
