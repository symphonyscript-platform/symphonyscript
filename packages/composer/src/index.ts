export * from './Clip';
export * from './SymphonyEngine';
export { Track } from './Track';
export type { TrackOptions } from './Track';
export { Session } from './Session';
export type { SessionOptions } from './Session';

// Cursors
export { SynapticCursor } from './cursors/SynapticCursor';
export { SynapticNoteCursor } from './cursors/SynapticNoteCursor';
export { SynapticMelodyBaseCursor } from './cursors/SynapticMelodyBaseCursor';
export { SynapticMelodyNoteCursor } from './cursors/SynapticMelodyNoteCursor';
export { SynapticChordCursor } from './cursors/SynapticChordCursor';
export { SynapticDrumHitCursor } from './cursors/SynapticDrumHitCursor';

// Clips
export { SynapticClip } from './clips/SynapticClip';
export { SynapticMelody } from './clips/SynapticMelody';
export { SynapticDrums } from './clips/SynapticDrums';
export { KeyboardBuilder } from './clips/KeyboardBuilder';
export { WindBuilder } from './clips/WindBuilder';
export { StringBuilder } from './clips/StringBuilder';

// Groove
export { SynapticGrooveBuilder } from './groove/SynapticGrooveBuilder';
export type { GrooveTemplate } from './groove/SynapticGrooveBuilder';
export { GrooveStepCursor } from './groove/GrooveStepCursor';

// Utils
export { parsePitch } from './utils/pitch';
export { parseChord, packIntervals } from './utils/chord';
export { applyKeySignature, hasExplicitAccidental } from './utils/key';
export { romanToChord, toTheoryKeyContext } from './utils/romanAdapter';

// Types
export type { ClipNode, ClipBuilder, TrackNode, SessionNode, NoteOperation, LoopOp, ClipOp, CCOperation, PitchBendOperation, AftertouchOperation, AutomationTarget, AutomationOperation, ScaleMode, ScaleContext, DegreeOptions, KeyContext, Accidental, EuclideanMelodyOptions, EuclideanDrumOptions, ArpPattern, ArpeggioOptions, HumanizeSettings, QuantizeSettings, FreezeOptions, ScopeIsolation, ScopeOp, DrumMap, TempoCurve, TempoKeyframe, TempoEnvelopeOp } from './types';
export { SCHEMA_VERSION } from './types';

// FrozenClip
export { FrozenClip } from './clips/FrozenClip';
