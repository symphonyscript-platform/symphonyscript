import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const STEREO_INPUTS: readonly PortDescriptor[] = [
    { id: 0, rate: PortRate.AUDIO, channelCount: 1, name: 'L' },
    { id: 1, rate: PortRate.AUDIO, channelCount: 1, name: 'R' },
];

const MONO_OUTPUT: readonly PortDescriptor[] = [
    { id: 0, rate: PortRate.AUDIO, channelCount: 1, name: 'out' },
];

export class StereoToMonoModule implements DSPModule {
    public readonly type = ModuleType.STEREO_TO_MONO;
    public readonly id: number;
    public readonly inputs = STEREO_INPUTS;
    public readonly outputs = MONO_OUTPUT;

    constructor(id: number) {
        this.id = id;
    }

    public process(
        inputBuffers: readonly AudioBuffer[],
        outputBuffers: readonly AudioBuffer[],
        blockSize: number
    ): void {
        const output = outputBuffers[0];
        if (!output || output.data.length < blockSize) return;

        const dst = output.data;
        const inL = inputBuffers[0]?.data;
        const inR = inputBuffers[1]?.data;

        if (!inL || inL.length < blockSize || !inR || inR.length < blockSize) {
            dst.fill(0, 0, blockSize);
            return;
        }

        for (let i = 0; i < blockSize; i += 1) {
            dst[i] = (inL[i] + inR[i]) * 0.5;
        }
    }

    public setParameter(): void {}
    public getParameter(): number {
        return 0;
    }
    public reset(): void {}
}
