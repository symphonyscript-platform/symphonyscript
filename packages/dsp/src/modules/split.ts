import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

function makeOutputDescriptors(outputCount: number): PortDescriptor[] {
    const out: PortDescriptor[] = [];
    for (let i = 0; i < outputCount; i += 1) {
        out.push({
            id: i,
            rate: PortRate.AUDIO,
            channelCount: 1,
            name: `out${i}`,
        });
    }
    return out;
}

const SPLIT_INPUT: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'in',
    },
];

export class SplitModule implements DSPModule {
    public readonly type = ModuleType.SPLIT;
    public readonly id: number;
    public readonly inputs = SPLIT_INPUT;
    public readonly outputs: readonly PortDescriptor[];

    constructor(id: number, outputCount: number) {
        if (!Number.isInteger(outputCount) || outputCount < 1) {
            throw new Error('outputCount must be a positive integer');
        }
        this.id = id;
        this.outputs = makeOutputDescriptors(outputCount);
    }

    public process(
        inputBuffers: readonly AudioBuffer[],
        outputBuffers: readonly AudioBuffer[],
        blockSize: number
    ): void {
        const input = inputBuffers[0];
        if (!input || input.data.length < blockSize) {
            for (let o = 0; o < outputBuffers.length; o += 1) {
                outputBuffers[o]?.data.fill(0, 0, blockSize);
            }
            return;
        }

        const src = input.data;
        for (let o = 0; o < outputBuffers.length; o += 1) {
            const out = outputBuffers[o];
            if (out && out.data.length >= blockSize) {
                out.data.set(src.subarray(0, blockSize), 0);
            }
        }
    }

    public setParameter(_paramId: number, _value: number): void {}

    public getParameter(_paramId: number): number {
        return 0;
    }

    public reset(): void {}
}
