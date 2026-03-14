import { ModuleType } from '../constants';
import { createExecutionContext, executePlan } from '../plan-executor';
import { createAudioBuffer } from '../buffer-utils';
import { PannerModule, PannerParam } from '../modules/panner';
import type { AudioBuffer, CompiledPlan, DSPModule } from '../types';

const BLOCK_SIZE = 64;

function createSourceModule(id: number, value: number): DSPModule {
    return {
        type: ModuleType.GAIN,
        id,
        inputs: [],
        outputs: [],
        process: (_in, outputs, blockSize) => {
            const out = outputs[0];
            if (out) {
                out.data.fill(value, 0, blockSize);
            }
        },
        setParameter: () => {},
        getParameter: () => 0,
        reset: () => {},
    };
}

describe('panner module', () => {
    test('pan=0 produces equal L/R', () => {
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [0], outputBufferIndices: [1, 2] },
            ],
            moduleIds: [10, 20],
            wires: [],
            arena: new Float32Array(3 * BLOCK_SIZE),
            bufferDescriptors: [
                { offset: 0, channelCount: 1, blockSize: BLOCK_SIZE },
                { offset: BLOCK_SIZE, channelCount: 1, blockSize: BLOCK_SIZE },
                { offset: 2 * BLOCK_SIZE, channelCount: 1, blockSize: BLOCK_SIZE },
            ],
            outputChannelCount: 1,
        };

        const source = createSourceModule(10, 1);
        const panner = new PannerModule(20);
        panner.setParameter(PannerParam.PAN, 0);

        const modules: readonly DSPModule[] = [source, panner];
        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx, BLOCK_SIZE);

        const l = ctx.descriptorBuffers[1].data;
        const r = ctx.descriptorBuffers[2].data;
        const expected = Math.cos(Math.PI / 4);

        for (let i = 0; i < BLOCK_SIZE; i += 1) {
            expect(l[i]).toBeCloseTo(expected);
            expect(r[i]).toBeCloseTo(expected);
        }
    });

    test('pan=-1 produces signal only on L', () => {
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [0], outputBufferIndices: [1, 2] },
            ],
            moduleIds: [10, 20],
            wires: [],
            arena: new Float32Array(3 * BLOCK_SIZE),
            bufferDescriptors: [
                { offset: 0, channelCount: 1, blockSize: BLOCK_SIZE },
                { offset: BLOCK_SIZE, channelCount: 1, blockSize: BLOCK_SIZE },
                { offset: 2 * BLOCK_SIZE, channelCount: 1, blockSize: BLOCK_SIZE },
            ],
            outputChannelCount: 1,
        };

        const source = createSourceModule(10, 1);
        const panner = new PannerModule(20);
        panner.setParameter(PannerParam.PAN, -1);

        const modules: readonly DSPModule[] = [source, panner];
        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx, BLOCK_SIZE);

        const l = ctx.descriptorBuffers[1].data;
        const r = ctx.descriptorBuffers[2].data;

        for (let i = 0; i < BLOCK_SIZE; i += 1) {
            expect(l[i]).toBeCloseTo(1);
            expect(r[i]).toBeCloseTo(0);
        }
    });

    test('pan=1 produces signal only on R', () => {
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [0], outputBufferIndices: [1, 2] },
            ],
            moduleIds: [10, 20],
            wires: [],
            arena: new Float32Array(3 * BLOCK_SIZE),
            bufferDescriptors: [
                { offset: 0, channelCount: 1, blockSize: BLOCK_SIZE },
                { offset: BLOCK_SIZE, channelCount: 1, blockSize: BLOCK_SIZE },
                { offset: 2 * BLOCK_SIZE, channelCount: 1, blockSize: BLOCK_SIZE },
            ],
            outputChannelCount: 1,
        };

        const source = createSourceModule(10, 1);
        const panner = new PannerModule(20);
        panner.setParameter(PannerParam.PAN, 1);

        const modules: readonly DSPModule[] = [source, panner];
        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx, BLOCK_SIZE);

        const l = ctx.descriptorBuffers[1].data;
        const r = ctx.descriptorBuffers[2].data;

        for (let i = 0; i < BLOCK_SIZE; i += 1) {
            expect(l[i]).toBeCloseTo(0);
            expect(r[i]).toBeCloseTo(1);
        }
    });
});
