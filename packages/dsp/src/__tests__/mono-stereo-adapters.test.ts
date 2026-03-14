import { ModuleType, PortRate } from '../constants';
import { createExecutionContext, executePlan } from '../plan-executor';
import { MonoToStereoModule } from '../modules/mono-to-stereo';
import { StereoToMonoModule } from '../modules/stereo-to-mono';
import type { AudioBuffer, CompiledPlan, DSPModule } from '../types';

const BLOCK_SIZE = 64;

function createSourceModule(id: number, fillValue: number): DSPModule {
    return {
        type: ModuleType.GAIN,
        id,
        inputs: [],
        outputs: [{ id: 0, rate: PortRate.AUDIO, channelCount: 1, name: 'out' }],
        process: (_in, outputs, blockSize) => {
            const out = outputs[0];
            if (out) out.data.fill(fillValue, 0, blockSize);
        },
        setParameter: () => {},
        getParameter: () => 0,
        reset: () => {},
    };
}

describe('MonoToStereoModule', () => {
    test('duplicates mono input to L and R', () => {
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [0], outputBufferIndices: [1, 2] },
            ],
            moduleIds: [10, 20],
            wires: [{ sourceModuleId: 10, sourcePortId: 0, targetModuleId: 20, targetPortId: 0 }],
            arena: new Float32Array(0),
            bufferDescriptors: [
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
            ],
            outputChannelCount: 1,
        };

        const source = createSourceModule(10, 0.7);
        const monoToStereo = new MonoToStereoModule(20);
        const modules = [source, monoToStereo];
        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx, BLOCK_SIZE);

        const l = ctx.descriptorBuffers[1].data;
        const r = ctx.descriptorBuffers[2].data;
        for (let i = 0; i < BLOCK_SIZE; i += 1) {
            expect(l[i]).toBeCloseTo(0.7);
            expect(r[i]).toBeCloseTo(0.7);
        }
    });

    test('silent input produces silent output', () => {
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [0], outputBufferIndices: [1, 2] },
            ],
            moduleIds: [10, 20],
            wires: [{ sourceModuleId: 10, sourcePortId: 0, targetModuleId: 20, targetPortId: 0 }],
            arena: new Float32Array(0),
            bufferDescriptors: [
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
            ],
            outputChannelCount: 1,
        };

        const source = createSourceModule(10, 0);
        const monoToStereo = new MonoToStereoModule(20);
        const modules = [source, monoToStereo];
        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx, BLOCK_SIZE);

        const l = ctx.descriptorBuffers[1].data;
        const r = ctx.descriptorBuffers[2].data;
        for (let i = 0; i < BLOCK_SIZE; i += 1) {
            expect(l[i]).toBe(0);
            expect(r[i]).toBe(0);
        }
    });
});

describe('StereoToMonoModule', () => {
    test('downmixes L and R with equal-power sum', () => {
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [], outputBufferIndices: [1] },
                { moduleIndex: 2, inputBufferIndices: [0, 1], outputBufferIndices: [2] },
            ],
            moduleIds: [10, 11, 20],
            wires: [
                { sourceModuleId: 10, sourcePortId: 0, targetModuleId: 20, targetPortId: 0 },
                { sourceModuleId: 11, sourcePortId: 0, targetModuleId: 20, targetPortId: 1 },
            ],
            arena: new Float32Array(0),
            bufferDescriptors: [
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
            ],
            outputChannelCount: 1,
        };

        const sourceL = createSourceModule(10, 1);
        const sourceR = createSourceModule(11, 1);
        const stereoToMono = new StereoToMonoModule(20);
        const modules = [sourceL, sourceR, stereoToMono];
        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx, BLOCK_SIZE);

        const out = ctx.descriptorBuffers[2].data;
        for (let i = 0; i < BLOCK_SIZE; i += 1) {
            expect(out[i]).toBe(1);
        }
    });

    test('silent input produces silent output', () => {
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [], outputBufferIndices: [1] },
                { moduleIndex: 2, inputBufferIndices: [0, 1], outputBufferIndices: [2] },
            ],
            moduleIds: [10, 11, 20],
            wires: [
                { sourceModuleId: 10, sourcePortId: 0, targetModuleId: 20, targetPortId: 0 },
                { sourceModuleId: 11, sourcePortId: 0, targetModuleId: 20, targetPortId: 1 },
            ],
            arena: new Float32Array(0),
            bufferDescriptors: [
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
                { offset: 0, channelCount: 0, blockSize: BLOCK_SIZE },
            ],
            outputChannelCount: 1,
        };

        const sourceL = createSourceModule(10, 0);
        const sourceR = createSourceModule(11, 0);
        const stereoToMono = new StereoToMonoModule(20);
        const modules = [sourceL, sourceR, stereoToMono];
        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx, BLOCK_SIZE);

        const out = ctx.descriptorBuffers[2].data;
        for (let i = 0; i < BLOCK_SIZE; i += 1) {
            expect(out[i]).toBe(0);
        }
    });
});
