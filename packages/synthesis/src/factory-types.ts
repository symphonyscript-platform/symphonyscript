import type { FilterType, OscillatorWaveform, StealPolicy } from '@symphonyscript/dsp';

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
    filterCutoff?: number;
    filterResonance?: number;
    filterType?: FilterType;
    filterAttackSec?: number;
    filterDecaySec?: number;
    /** Acts as BOTH envelope sustain level AND a multiplicative scale for filter cutoff at sustain.
     * effectiveCutoff = filterCutoff * filterSustainLevel (e.g. 4000 * 0.6 = 2400 Hz).
     * This prevents the footgun where users assume it only affects envelope timing. */
    filterSustainLevel?: number;
    filterReleaseSec?: number;
}

export interface FMSynthOptions {
    name?: string;
    maxVoices?: number;
    sampleRate?: number;
    blockSize?: number;
    stealPolicy?: StealPolicy;
    modulationIndex?: number;
    modulatorRatio?: number;
    attackSec?: number;
    decaySec?: number;
    sustainLevel?: number;
    releaseSec?: number;
    gain?: number;
}
