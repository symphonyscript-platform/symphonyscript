export const PortRate = {
    AUDIO: 0,
    CONTROL: 1,
} as const;

export type PortRate = (typeof PortRate)[keyof typeof PortRate];

export const VoiceState = {
    IDLE: 0,
    ACTIVE: 1,
    RELEASE: 2,
} as const;

export type VoiceState = (typeof VoiceState)[keyof typeof VoiceState];

export const ModuleType = {
    OSCILLATOR: 0,
    FILTER: 1,
    ENVELOPE: 2,
    AMPLIFIER: 3,
    LFO: 4,
    MIXER: 5,
    PANNER: 6,
    DELAY: 7,
    EFFECT: 8,
    GAIN: 9,
    SPLIT: 10,
    MERGE: 11,
    OUTPUT: 12,
} as const;

export type ModuleType = (typeof ModuleType)[keyof typeof ModuleType];

export const StealPolicy = {
    OLDEST: 0,
    QUIETEST: 1,
    LOWEST: 2,
    HIGHEST: 3,
    NONE: 4,
} as const;

export type StealPolicy = (typeof StealPolicy)[keyof typeof StealPolicy];
