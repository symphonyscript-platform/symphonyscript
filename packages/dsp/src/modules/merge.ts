import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

function makeInputDescriptors(inputCount: number): PortDescriptor[] {
    const out: PortDescriptor[] = [];
    for (let i = 0; i < inputCount; i += 1) {
        out.push({
            id: i,
            rate: PortRate.AUDIO,
            channelCount: 1,
            name: `in${i}`,
        });
    }
    return out;
}

const MERGE_OUTPUT: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'out',
    },
];

export class SumMergeModule implements DSPModule {
    public readonly type = ModuleType.MERGE;
    public readonly id: number;
    public readonly inputs: readonly PortDescriptor[];
    public readonly outputs = MERGE_OUTPUT;

    constructor(id: number, inputCount: number) {
        if (!Number.isInteger(inputCount) || inputCount < 1) {
            throw new Error('inputCount must be a positive integer');
        }
        this.id = id;
        this.inputs = makeInputDescriptors(inputCount);
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

        const dst = output.data;
        dst.fill(0, 0, blockSize);

        for (let i = 0; i < inputBuffers.length; i += 1) {
            const inp = inputBuffers[i];
            if (inp && inp.data.length >= blockSize) {
                const src = inp.data;
                for (let s = 0; s < blockSize; s += 1) {
                    dst[s] += src[s];
                }
            }
        }
    }

    public setParameter(_paramId: number, _value: number): void {}

    public getParameter(_paramId: number): number {
        return 0;
    }

    public reset(): void {}
}
