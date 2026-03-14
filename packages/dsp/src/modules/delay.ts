import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const DELAY_INPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'in',
    },
];

const DELAY_OUTPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'out',
    },
];

export const DelayParam = {
    DELAY_TIME_SAMPLES: 0,
    FEEDBACK: 1,
    MIX: 2,
} as const;

export type DelayParam = (typeof DelayParam)[keyof typeof DelayParam];

function clampInt(value: number, min: number, max: number): number {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
        return min;
    }
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function clampFloat(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

export class DelayModule implements DSPModule {
    public readonly type = ModuleType.DELAY;
    public readonly id: number;
    public readonly inputs = DELAY_INPUTS;
    public readonly outputs = DELAY_OUTPUTS;

    private readonly buffer: Float32Array;
    private readonly maxDelaySamples: number;

    private delayTimeSamples = 1;
    private feedback = 0;
    private mix = 0.5;

    private writeHead = 0;

    constructor(id: number, sampleRate: number, maxDelaySeconds: number) {
        this.id = id;
        this.maxDelaySamples = Math.ceil(maxDelaySeconds * sampleRate);
        this.buffer = new Float32Array(
            this.maxDelaySamples > 0 ? this.maxDelaySamples : 1
        );
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
        const delaySamples = this.delayTimeSamples;
        const fb = this.feedback;
        const mixVal = this.mix;
        const dryGain = 1 - mixVal;
        let writeIdx = this.writeHead;

        for (let i = 0; i < blockSize; i += 1) {
            const dry = inputData[i];
            const readIdx =
                (writeIdx - delaySamples + maxSamples) % maxSamples;
            const wet = buf[readIdx];

            outputData[i] = dry * dryGain + wet * mixVal;

            buf[writeIdx] = dry + wet * fb;

            writeIdx = (writeIdx + 1) % maxSamples;
        }

        this.writeHead = writeIdx;
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === DelayParam.DELAY_TIME_SAMPLES) {
            this.delayTimeSamples = clampInt(
                value,
                1,
                Math.max(1, this.maxDelaySamples - 1)
            );
        } else if (paramId === DelayParam.FEEDBACK) {
            this.feedback = clampFloat(value, 0, 0.99);
        } else if (paramId === DelayParam.MIX) {
            this.mix = clampFloat(value, 0, 1);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === DelayParam.DELAY_TIME_SAMPLES) {
            return this.delayTimeSamples;
        }
        if (paramId === DelayParam.FEEDBACK) {
            return this.feedback;
        }
        if (paramId === DelayParam.MIX) {
            return this.mix;
        }
        return 0;
    }

    public reset(): void {
        this.buffer.fill(0);
        this.writeHead = 0;
    }
}
