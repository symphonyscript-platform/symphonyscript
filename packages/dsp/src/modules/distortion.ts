import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const DISTORTION_INPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'in',
    },
];

const DISTORTION_OUTPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'out',
    },
];

const DEFAULT_DRIVE = 1;
const DEFAULT_MIX = 1;

const DRIVE_MIN = 1;
const DRIVE_MAX = 100;
const MIX_MIN = 0;
const MIX_MAX = 1;

export const DistortionParam = {
    DRIVE: 0,
    MIX: 1,
} as const;

export type DistortionParam = (typeof DistortionParam)[keyof typeof DistortionParam];

function clampFloat(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

export class DistortionModule implements DSPModule {
    public readonly type = ModuleType.EFFECT;
    public readonly id: number;
    public readonly inputs = DISTORTION_INPUTS;
    public readonly outputs = DISTORTION_OUTPUTS;

    private drive = DEFAULT_DRIVE;
    private mix = DEFAULT_MIX;

    constructor(id: number) {
        this.id = id;
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
        const driveVal = this.drive;
        const mixVal = this.mix;
        const dryGain = 1 - mixVal;
        const tanhDrive = Math.tanh(driveVal);

        for (let i = 0; i < blockSize; i += 1) {
            const x = inputData[i];
            const dry = x;
            const wet = Math.tanh(driveVal * x) / tanhDrive;
            outputData[i] = dry * dryGain + wet * mixVal;
        }
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === DistortionParam.DRIVE) {
            this.drive = clampFloat(value, DRIVE_MIN, DRIVE_MAX);
        } else if (paramId === DistortionParam.MIX) {
            this.mix = clampFloat(value, MIX_MIN, MIX_MAX);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === DistortionParam.DRIVE) {
            return this.drive;
        }
        if (paramId === DistortionParam.MIX) {
            return this.mix;
        }
        return 0;
    }

    public reset(): void {
        // No internal state beyond parameters — no-op per spec
    }
}
