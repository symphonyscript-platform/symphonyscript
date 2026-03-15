export * from './Clip';
export * from './SymphonyEngine';
export { Track } from './Track';
export type { TrackOptions } from './Track';
export { Session } from './Session';
export type { SessionOptions } from './Session';

// Cursors
export { SynapticCursor } from './cursors/SynapticCursor';
export { BaseNoteCursor } from './cursors/BaseNoteCursor';
export { SynapticNoteCursor } from './cursors/SynapticNoteCursor';
export { SynapticMelodyBaseCursor } from './cursors/SynapticMelodyBaseCursor';
export { MelodyNoteCursor } from './cursors/MelodyNoteCursor';
export { MelodyChordCursor } from './cursors/MelodyChordCursor';
export { DrumsHitCursor } from './cursors/DrumsHitCursor';
// Backward-compat aliases (deprecated)
export { MelodyNoteCursor as SynapticMelodyNoteCursor } from './cursors/MelodyNoteCursor';
export { MelodyChordCursor as SynapticChordCursor } from './cursors/MelodyChordCursor';
export { DrumsHitCursor as SynapticDrumHitCursor } from './cursors/DrumsHitCursor';

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
export { applyKeySignature, hasExplicitAccidental, scaleModeToKeyString } from './utils/key';
export { romanToChord, toTheoryKeyContext } from './utils/romanAdapter';

// Types
export { ScaleMode, Accidental, CurveType, DynamicsType, AutomationTarget, ArpPattern, AftertouchType, DrumType } from './types';
export type { ClipNode, ClipBuilder, TrackNode, SessionNode, NoteOperation, LoopOp, ClipOp, CCOperation, PitchBendOperation, AftertouchOperation, AutomationOperation, ScaleContext, DegreeOptions, KeyContext, EuclideanMelodyOptions, EuclideanDrumOptions, ArpeggioOptions, HumanizeSettings, QuantizeSettings, FreezeOptions, ScopeIsolation, ScopeOp, DrumMap, TempoKeyframe, TempoEnvelopeOp, ClipOperation, OperationsSource, VelocityPoint } from './types';
export { SCHEMA_VERSION } from './types';

// FrozenClip
export { FrozenClip } from './clips/FrozenClip';