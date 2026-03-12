import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const TWO_PI = Math.PI * 2;
const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_RATE_HZ = 1;
const DEFAULT_DEPTH = 1;

const EMPTY_INPUTS: readonly PortDescriptor[] = [];
const LFO_OUTPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.CONTROL,
        channelCount: 1,
        name: 'out',
    },
];

export const LFOWaveform = {
    SINE: 0,
    SAW: 1,
    SQUARE: 2,
    TRIANGLE: 3,
} as const;

export type LFOWaveform = (typeof LFOWaveform)[keyof typeof LFOWaveform];

export const LFOParam = {
    RATE_HZ: 0,
    DEPTH: 1,
    WAVEFORM: 2,
    PHASE_OFFSET: 3,
} as const;

export type LFOParam = (typeof LFOParam)[keyof typeof LFOParam];

function sanitizeSampleRate(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return DEFAULT_SAMPLE_RATE;
    }
    return value;
}

function sanitizeRateHz(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return 0;
    }
    return value;
}

function sanitizeDepth(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return 0;
    }
    return value;
}

function sanitizeWaveform(value: number): LFOWaveform {
    if (!Number.isFinite(value)) {
        return LFOWaveform.SINE;
    }
    const waveform = Math.trunc(value);
    if (waveform <= LFOWaveform.SINE) {
        return LFOWaveform.SINE;
    }
    if (waveform >= LFOWaveform.TRIANGLE) {
        return LFOWaveform.TRIANGLE;
    }
    return waveform as LFOWaveform;
}

function normalizePhase(phase: number): number {
    if (!Number.isFinite(phase)) {
        return 0;
    }
    if (phase >= TWO_PI || phase < 0) {
        phase %= TWO_PI;
        if (phase < 0) {
            phase += TWO_PI;
        }
    }
    return phase;
}

export class LFOModule implements DSPModule {
    public readonly type = ModuleType.LFO;
    public readonly id: number;
    public readonly inputs = EMPTY_INPUTS;
    public readonly outputs = LFO_OUTPUTS;

    private sampleRate: number;
    private rateHz = DEFAULT_RATE_HZ;
    private depth = DEFAULT_DEPTH;
    private waveform: LFOWaveform = LFOWaveform.SINE;
    private phaseOffset = 0;
    private phase = 0;

    constructor(id: number, sampleRate = DEFAULT_SAMPLE_RATE) {
        this.id = id;
        this.sampleRate = sanitizeSampleRate(sampleRate);
    }

    public process(
        _inputBuffers: readonly AudioBuffer[],
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
        const depth = this.depth;
        const waveform = this.waveform;
        const phaseOffset = this.phaseOffset;
        const phaseIncrement = (TWO_PI * this.rateHz) / this.sampleRate;
        let phase = this.phase;

        for (let i = 0; i < blockSize; i += 1) {
            const p = normalizePhase(phase + phaseOffset);
            let wave = 0;
            if (waveform === LFOWaveform.SINE) {
                wave = Math.sin(p);
            } else if (waveform === LFOWaveform.SAW) {
                wave = p / Math.PI - 1;
            } else if (waveform === LFOWaveform.SQUARE) {
                wave = p < Math.PI ? 1 : -1;
            } else {
                const normalized = p / TWO_PI;
                wave = 1 - 4 * Math.abs(normalized - 0.5);
            }
            outputData[i] = wave * depth;

            phase += phaseIncrement;
            if (phase >= TWO_PI || phase < 0) {
                phase = normalizePhase(phase);
            }
        }

        this.phase = normalizePhase(phase);
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === LFOParam.RATE_HZ) {
            this.rateHz = sanitizeRateHz(value);
            return;
        }
        if (paramId === LFOParam.DEPTH) {
            this.depth = sanitizeDepth(value);
            return;
        }
        if (paramId === LFOParam.WAVEFORM) {
            this.waveform = sanitizeWaveform(value);
            return;
        }
        if (paramId === LFOParam.PHASE_OFFSET) {
            this.phaseOffset = normalizePhase(value);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === LFOParam.RATE_HZ) {
            return this.rateHz;
        }
        if (paramId === LFOParam.DEPTH) {
            return this.depth;
        }
        if (paramId === LFOParam.WAVEFORM) {
            return this.waveform;
        }
        if (paramId === LFOParam.PHASE_OFFSET) {
            return this.phaseOffset;
        }
        return 0;
    }

    public reset(): void {
        this.phase = 0;
    }
}
