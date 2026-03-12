import type { OscillatorWaveform, StealPolicy } from '@symphonyscript/dsp';

export interface SubtractiveSynthOptions {
    name?: string;
    maxVoices?: number;
    sampleRate?: number;
    blockSize?: number;
    stealPolicy?: StealPolicy;
    waveform?: OscillatorWaveform;
    attackSec?: number;
    decaySec?: number;
    sustainLevel?: number;
    releaseSec?: number;
    gain?: number;
}

export interface FMSynthOptions {
    // TODO(RFC-SYNTH-FM): define FM operator/algorithm options.
}
