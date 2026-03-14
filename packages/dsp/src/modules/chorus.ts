import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const TWO_PI = 2 * Math.PI;

const CHORUS_INPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'in',
    },
];

const CHORUS_OUTPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'out',
    },
];

export const ChorusParam = {
    RATE_HZ: 0,
    DEPTH: 1,
    MIX: 2,
} as const;

export type ChorusParam = (typeof ChorusParam)[keyof typeof ChorusParam];

function clampFloat(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function modPos(x: number, m: number): number {
    return ((x % m) + m) % m;
}

export class ChorusModule implements DSPModule {
    public readonly type = ModuleType.EFFECT;
    public readonly id: number;
    public readonly inputs = CHORUS_INPUTS;
    public readonly outputs = CHORUS_OUTPUTS;

    private readonly buffer: Float32Array;
    private readonly maxDelaySamples: number;
    private readonly sampleRate: number;

    /** Base delay in samples (7ms). */
    private readonly baseDelaySamples: number;
    /** Max modulation depth in samples (3ms) when depth param = 1. */
    private readonly depthSamplesMax: number;

    private rateHz = 0.5;
    private depth = 0.5;
    private mix = 0.5;

    private phaseIncrement = 0;
    private writeHead = 0;
    private phase = 0;

    constructor(id: number, sampleRate: number) {
        this.id = id;
        this.sampleRate = sampleRate;
        this.maxDelaySamples = Math.ceil(0.01 * sampleRate);
        this.buffer = new Float32Array(
            this.maxDelaySamples > 0 ? this.maxDelaySamples : 1
        );
        this.baseDelaySamples = 0.007 * sampleRate;
        this.depthSamplesMax = 0.003 * sampleRate;
        this.phaseIncrement = (TWO_PI * this.rateHz) / sampleRate;
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
        const buf = this.buffer;
        const maxSamples = this.maxDelaySamples;
        const baseDelay = this.baseDelaySamples;
        const depthSamples = this.depthSamplesMax * this.depth;
        const mixVal = this.mix;
        const dryGain = 1 - mixVal;
        const phaseInc = this.phaseIncrement;
        let writeIdx = this.writeHead;
        let ph = this.phase;

        for (let i = 0; i < blockSize; i += 1) {
            const dry = inputData[i];

            ph += phaseInc;
            if (ph >= TWO_PI) ph -= TWO_PI;
            else if (ph < 0) ph += TWO_PI;

            const mod = Math.sin(ph);
            const delaySamples = baseDelay + depthSamples * mod;

            const readPos = writeIdx - delaySamples;
            const idx0 = Math.floor(readPos);
            const idx1 = idx0 + 1;
            const frac = readPos - idx0;

            const i0 = modPos(idx0, maxSamples);
            const i1 = modPos(idx1, maxSamples);
            const v0 = buf[i0];
            const v1 = buf[i1];
            const wet = v0 + frac * (v1 - v0);

            outputData[i] = dry * dryGain + wet * mixVal;

            buf[writeIdx] = dry;
            writeIdx = (writeIdx + 1) % maxSamples;
        }

        this.writeHead = writeIdx;
        this.phase = ph;
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === ChorusParam.RATE_HZ) {
            this.rateHz = clampFloat(value, 0.01, 10);
            this.phaseIncrement =
                (TWO_PI * this.rateHz) / this.sampleRate;
        } else if (paramId === ChorusParam.DEPTH) {
            this.depth = clampFloat(value, 0, 1);
        } else if (paramId === ChorusParam.MIX) {
            this.mix = clampFloat(value, 0, 1);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === ChorusParam.RATE_HZ) {
            return this.rateHz;
        }
        if (paramId === ChorusParam.DEPTH) {
            return this.depth;
        }
        if (paramId === ChorusParam.MIX) {
            return this.mix;
        }
        return 0;
    }

    public reset(): void {
        this.buffer.fill(0);
        this.writeHead = 0;
        this.phase = 0;
    }
}
