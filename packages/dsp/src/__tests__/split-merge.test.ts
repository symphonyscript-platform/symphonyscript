import { ModuleType, PortRate } from '../constants';
import { compileGraph } from '../graph-compiler';
import { createExecutionContext, executePlan } from '../plan-executor';
import { createAudioBuffer } from '../buffer-utils';
import { CopySplitModule } from '../modules/split';
import { SumMergeModule } from '../modules/merge';
import type { AudioBuffer, CompiledPlan, DSPModule, PortDescriptor } from '../types';

const EMPTY_PORTS: readonly PortDescriptor[] = [];
const MONO_OUTPUT: readonly PortDescriptor[] = [
    { id: 0, rate: PortRate.AUDIO, channelCount: 1, name: 'out' },
];

function createSourceModule(id: number, fillValue: number): DSPModule {
    return {
        type: ModuleType.GAIN,
        id,
        inputs: EMPTY_PORTS,
        outputs: MONO_OUTPUT,
        process: (_in, outputs, blockSize) => {
            const out = outputs[0];
            if (out) {
                out.data.fill(fillValue, 0, blockSize);
            }
        },
        setParameter: () => {},
        getParameter: () => 0,
        reset: () => {},
    };
}

describe('split module', () => {
    test('split works with compileGraph and outputPortCount', () => {
        const graph = {
            modules: [
                { id: 1, type: ModuleType.GAIN, initialParameters: [] },
                { id: 2, type: ModuleType.SPLIT, initialParameters: [], outputPortCount: 3 },
                { id: 3, type: ModuleType.GAIN, initialParameters: [] },
                { id: 4, type: ModuleType.GAIN, initialParameters: [] },
                { id: 5, type: ModuleType.GAIN, initialParameters: [] },
            ],
            wires: [
                { sourceModuleId: 1, sourcePortId: 0, targetModuleId: 2, targetPortId: 0 },
                { sourceModuleId: 2, sourcePortId: 0, targetModuleId: 3, targetPortId: 0 },
                { sourceModuleId: 2, sourcePortId: 1, targetModuleId: 4, targetPortId: 0 },
                { sourceModuleId: 2, sourcePortId: 2, targetModuleId: 5, targetPortId: 0 },
            ],
            outputPortModuleId: 3,
            outputPortId: 0,
        };

        const plan = compileGraph(graph, 32);

        expect(plan.bufferDescriptors).toHaveLength(7);
        const splitStep = plan.steps.find((s) => plan.moduleIds[s.moduleIndex] === 2);
        expect(splitStep?.outputBufferIndices).toHaveLength(3);
    });

    test('split distributes to all outputs', () => {
        const blockSize = 64;
        const plan: CompiledPlan = {
            steps: [
                {
                    moduleIndex: 0,
                    inputBufferIndices: [],
                    outputBufferIndices: [0],
                },
                {
                    moduleIndex: 1,
                    inputBufferIndices: [0],
                    outputBufferIndices: [1, 2, 3],
                },
            ],
            moduleIds: [10, 20],
            wires: [],
            arena: new Float32Array(4 * blockSize),
            bufferDescriptors: [
                { offset: 0, channelCount: 1, blockSize },
                { offset: blockSize, channelCount: 1, blockSize },
                { offset: 2 * blockSize, channelCount: 1, blockSize },
                { offset: 3 * blockSize, channelCount: 1, blockSize },
            ],
            outputChannelCount: 1,
        };

        const source = createSourceModule(10, 0.5);
        const split = new CopySplitModule(20, 3);

        const modules: readonly DSPModule[] = [source, split];
        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx, blockSize);

        const inputData = ctx.descriptorBuffers[0].data;
        const out0 = ctx.descriptorBuffers[1].data;
        const out1 = ctx.descriptorBuffers[2].data;
        const out2 = ctx.descriptorBuffers[3].data;

        for (let i = 0; i < blockSize; i += 1) {
            expect(out0[i]).toBe(inputData[i]);
            expect(out1[i]).toBe(inputData[i]);
            expect(out2[i]).toBe(inputData[i]);
        }
    });
});

describe('merge module', () => {
    test('merge sums correctly', () => {
        const blockSize = 64;
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [], outputBufferIndices: [1] },
                { moduleIndex: 2, inputBufferIndices: [0, 1], outputBufferIndices: [2] },
            ],
            moduleIds: [10, 11, 20],
            wires: [],
            arena: new Float32Array(3 * blockSize),
            bufferDescriptors: [
                { offset: 0, channelCount: 1, blockSize },
                { offset: blockSize, channelCount: 1, blockSize },
                { offset: 2 * blockSize, channelCount: 1, blockSize },
            ],
            outputChannelCount: 1,
        };

        const sourceA = createSourceModule(10, 0.3);
        const sourceB = createSourceModule(11, 0.7);
        const merge = new SumMergeModule(20, 2);

        const modules: readonly DSPModule[] = [sourceA, sourceB, merge];
        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx, blockSize);

        const out = ctx.descriptorBuffers[2].data;
        for (let i = 0; i < blockSize; i += 1) {
            expect(out[i]).toBe(1);
        }
    });

    test('merge with one silent input does not silence the other', () => {
        const blockSize = 64;
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [], outputBufferIndices: [1] },
                { moduleIndex: 2, inputBufferIndices: [0, 1], outputBufferIndices: [2] },
            ],
            moduleIds: [10, 11, 20],
            wires: [],
            arena: new Float32Array(3 * blockSize),
            bufferDescriptors: [
                { offset: 0, channelCount: 1, blockSize },
                { offset: blockSize, channelCount: 1, blockSize },
                { offset: 2 * blockSize, channelCount: 1, blockSize },
            ],
            outputChannelCount: 1,
        };

        const sourceA = createSourceModule(10, 1);
        const sourceB = createSourceModule(11, 0);
        const merge = new SumMergeModule(20, 2);

        const modules: readonly DSPModule[] = [sourceA, sourceB, merge];
        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx, blockSize);

        const out = ctx.descriptorBuffers[2].data;
        for (let i = 0; i < blockSize; i += 1) {
            expect(out[i]).toBe(1);
        }
    });
});
