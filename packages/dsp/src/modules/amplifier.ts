import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const AMPLIFIER_INPUTS: readonly PortDescriptor[] = [
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
        name: 'gain',
    },
];

const AMPLIFIER_OUTPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'out',
    },
];

const DEFAULT_GAIN = 1;

export const AmplifierParam = {
    GAIN: 0,
} as const;

export type AmplifierParam = (typeof AmplifierParam)[keyof typeof AmplifierParam];

function sanitizeGain(value: number): number {
    if (!Number.isFinite(value)) {
        return DEFAULT_GAIN;
    }
    return value;
}

export class AmplifierModule implements DSPModule {
    public readonly type = ModuleType.AMPLIFIER;
    public readonly id: number;
    public readonly inputs = AMPLIFIER_INPUTS;
    public readonly outputs = AMPLIFIER_OUTPUTS;

    private baseGain = DEFAULT_GAIN;

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

        const audioData = audioInput.data;
        const controlInput = inputBuffers[1];
        const controlData = controlInput ? controlInput.data : null;
        const hasControl = controlData !== null && controlData.length >= blockSize;
        const baseGain = this.baseGain;

        for (let i = 0; i < blockSize; i += 1) {
            const controlGain = hasControl ? controlData[i] : 1;
            outputData[i] = audioData[i] * baseGain * controlGain;
        }
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === AmplifierParam.GAIN) {
            this.baseGain = sanitizeGain(value);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === AmplifierParam.GAIN) {
            return this.baseGain;
        }
        return 0;
    }

    public reset(): void {
        this.baseGain = DEFAULT_GAIN;
    }
}
