import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const PANNER_INPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'in',
    },
];

const PANNER_OUTPUTS: readonly PortDescriptor[] = [
    { id: 0, rate: PortRate.AUDIO, channelCount: 1, name: 'L' },
    { id: 1, rate: PortRate.AUDIO, channelCount: 1, name: 'R' },
];

export const PannerParam = {
    PAN: 0,
} as const;

export type PannerParam = (typeof PannerParam)[keyof typeof PannerParam];

const DEFAULT_PAN = 0;
const PI_OVER_4 = Math.PI / 4;

function sanitizePan(value: number): number {
    if (!Number.isFinite(value)) {
        return DEFAULT_PAN;
    }
    if (value <= -1) {
        return -1;
    }
    if (value >= 1) {
        return 1;
    }
    return value;
}

export class PannerModule implements DSPModule {
    public readonly type = ModuleType.PANNER;
    public readonly id: number;
    public readonly inputs = PANNER_INPUTS;
    public readonly outputs = PANNER_OUTPUTS;

    private pan = DEFAULT_PAN;

    constructor(id: number) {
        this.id = id;
    }

    public process(
        inputBuffers: readonly AudioBuffer[],
        outputBuffers: readonly AudioBuffer[],
        blockSize: number
    ): void {
        const input = inputBuffers[0];
        if (!input || input.data.length < blockSize) {
            if (outputBuffers[0]) {
                outputBuffers[0].data.fill(0, 0, blockSize);
            }
            if (outputBuffers[1]) {
                outputBuffers[1].data.fill(0, 0, blockSize);
            }
            return;
        }

        const angle = (this.pan + 1) * PI_OVER_4;
        const gainL = Math.cos(angle);
        const gainR = Math.sin(angle);
        const src = input.data;
        const dstL = outputBuffers[0]?.data;
        const dstR = outputBuffers[1]?.data;

        if (dstL && dstL.length >= blockSize) {
            for (let i = 0; i < blockSize; i += 1) {
                dstL[i] = src[i] * gainL;
            }
        }
        if (dstR && dstR.length >= blockSize) {
            for (let i = 0; i < blockSize; i += 1) {
                dstR[i] = src[i] * gainR;
            }
        }
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === PannerParam.PAN) {
            this.pan = sanitizePan(value);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === PannerParam.PAN) {
            return this.pan;
        }
        return 0;
    }

    public reset(): void {
        this.pan = DEFAULT_PAN;
    }
}
