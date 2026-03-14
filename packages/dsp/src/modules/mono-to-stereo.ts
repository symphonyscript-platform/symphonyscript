import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const MONO_INPUT: readonly PortDescriptor[] = [
    { id: 0, rate: PortRate.AUDIO, channelCount: 1, name: 'in' },
];

const STEREO_OUTPUTS: readonly PortDescriptor[] = [
    { id: 0, rate: PortRate.AUDIO, channelCount: 1, name: 'L' },
    { id: 1, rate: PortRate.AUDIO, channelCount: 1, name: 'R' },
];

export class MonoToStereoModule implements DSPModule {
    public readonly type = ModuleType.MONO_TO_STEREO;
    public readonly id: number;
    public readonly inputs = MONO_INPUT;
    public readonly outputs = STEREO_OUTPUTS;

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
            if (outputBuffers[0]) outputBuffers[0].data.fill(0, 0, blockSize);
            if (outputBuffers[1]) outputBuffers[1].data.fill(0, 0, blockSize);
            return;
        }

        const src = input.data;
        const outL = outputBuffers[0]?.data;
        const outR = outputBuffers[1]?.data;
        if (outL && outL.length >= blockSize) {
            outL.set(src.subarray(0, blockSize), 0);
        }
        if (outR && outR.length >= blockSize) {
            outR.set(src.subarray(0, blockSize), 0);
        }
    }

    public setParameter(): void {}
    public getParameter(): number {
        return 0;
    }
    public reset(): void {}
}
