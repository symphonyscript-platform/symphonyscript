import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const DEFAULT_SAMPLE_RATE = 48000;
const MIN_CUTOFF_HZ = 1e-6;
const DEFAULT_CUTOFF_HZ = 1000;
const DEFAULT_RESONANCE = 0;
const MAX_RESONANCE = 32;

const FILTER_INPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'in',
    },
    {
        id: 1,
        rate: PortRate.CONTROL,
        channelCount: 1,
        name: 'cutoff_mod',
    },
];

const FILTER_OUTPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'out',
    },
];

export const FilterType = {
    LOWPASS: 0,
    HIGHPASS: 1,
    BANDPASS: 2,
} as const;

export type FilterType = (typeof FilterType)[keyof typeof FilterType];

export const FilterParam = {
    CUTOFF: 0,
    RESONANCE: 1,
    FILTER_TYPE: 2,
} as const;

export type FilterParam = (typeof FilterParam)[keyof typeof FilterParam];

function sanitizeSampleRate(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return DEFAULT_SAMPLE_RATE;
    }
    return value;
}

function sanitizeCutoffHz(value: number, sampleRate: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return MIN_CUTOFF_HZ;
    }

    const nyquistLimit = sampleRate * 0.499;
    if (value >= nyquistLimit) {
        return nyquistLimit;
    }
    return value;
}

function sanitizeResonance(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return 0;
    }
    if (value >= MAX_RESONANCE) {
        return MAX_RESONANCE;
    }
    return value;
}

function sanitizeFilterType(value: number): FilterType {
    if (!Number.isFinite(value)) {
        return FilterType.LOWPASS;
    }
    const filterType = Math.trunc(value);
    if (filterType <= FilterType.LOWPASS) {
        return FilterType.LOWPASS;
    }
    if (filterType >= FilterType.BANDPASS) {
        return FilterType.BANDPASS;
    }
    return filterType as FilterType;
}

export class FilterModule implements DSPModule {
    public readonly type = ModuleType.FILTER;
    public readonly id: number;
    public readonly inputs = FILTER_INPUTS;
    public readonly outputs = FILTER_OUTPUTS;

    private sampleRate: number;
    private cutoffHz = DEFAULT_CUTOFF_HZ;
    private resonance = DEFAULT_RESONANCE;
    private filterType: FilterType = FilterType.LOWPASS;

    // TPT-style SVF state (integrator memory terms).
    private ic1eq = 0;
    private ic2eq = 0;

    constructor(id: number, sampleRate = DEFAULT_SAMPLE_RATE) {
        this.id = id;
        this.sampleRate = sanitizeSampleRate(sampleRate);
        this.cutoffHz = sanitizeCutoffHz(this.cutoffHz, this.sampleRate);
    }

    public process(
        inputBuffers: readonly AudioBuffer[],
        outputBuffers: readonly AudioBuffer[],
        blockSize: number
    ): void {
        if (outputBuffers.length === 0 || blockSize <= 0) {
            return;
        }

        const output = outputBuffers[0];
        if (!output || output.data.length < blockSize) {
            return;
        }

        const outputData = output.data;
        const audioInput = inputBuffers[0];
        if (!audioInput || audioInput.data.length < blockSize) {
            outputData.fill(0, 0, blockSize);
            return;
        }

        const inputData = audioInput.data;
        const cutoffModInput = inputBuffers[1];
        const cutoffModData = cutoffModInput ? cutoffModInput.data : null;
        const hasCutoffMod = cutoffModData !== null && cutoffModData.length >= blockSize;
        const sampleRate = this.sampleRate;
        const filterType = this.filterType;
        const baseCutoffHz = this.cutoffHz;
        const resonance = this.resonance;
        const k = 1 / (1 + resonance);
        let ic1eq = this.ic1eq;
        let ic2eq = this.ic2eq;

        for (let i = 0; i < blockSize; i += 1) {
            const input = inputData[i];
            const cutoffMod = hasCutoffMod ? cutoffModData[i] : 1;
            // Modulation is multiplicative: effective cutoff = baseCutoffHz * max(0, cutoffMod).
            const modulationScale = Number.isFinite(cutoffMod) && cutoffMod > 0 ? cutoffMod : 0;
            const effectiveCutoffHz = sanitizeCutoffHz(
                baseCutoffHz * modulationScale,
                sampleRate
            );
            const g = Math.tan(Math.PI * effectiveCutoffHz / sampleRate);
            const a1 = 1 / (1 + g * (g + k));
            const a2 = g * a1;
            const a3 = g * a2;

            const v3 = input - ic2eq;
            const v1 = a1 * ic1eq + a2 * v3;
            const v2 = ic2eq + a2 * ic1eq + a3 * v3;
            const low = v2;
            const band = v1;
            const high = input - k * band - low;

            ic1eq = 2 * v1 - ic1eq;
            ic2eq = 2 * v2 - ic2eq;

            if (filterType === FilterType.LOWPASS) {
                outputData[i] = low;
            } else if (filterType === FilterType.HIGHPASS) {
                outputData[i] = high;
            } else {
                outputData[i] = band;
            }
        }

        this.ic1eq = ic1eq;
        this.ic2eq = ic2eq;
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === FilterParam.CUTOFF) {
            this.cutoffHz = sanitizeCutoffHz(value, this.sampleRate);
            return;
        }
        if (paramId === FilterParam.RESONANCE) {
            this.resonance = sanitizeResonance(value);
            return;
        }
        if (paramId === FilterParam.FILTER_TYPE) {
            this.filterType = sanitizeFilterType(value);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === FilterParam.CUTOFF) {
            return this.cutoffHz;
        }
        if (paramId === FilterParam.RESONANCE) {
            return this.resonance;
        }
        if (paramId === FilterParam.FILTER_TYPE) {
            return this.filterType;
        }
        return 0;
    }

    public reset(): void {
        this.ic1eq = 0;
        this.ic2eq = 0;
    }
}
