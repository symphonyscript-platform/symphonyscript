import { ModuleType } from '../constants';
import { createExecutionContext, executePlan } from '../plan-executor';
import type { AudioBuffer, CompiledPlan, DSPModule, PortDescriptor } from '../types';

const EMPTY_PORTS: readonly PortDescriptor[] = [];

function createTestModule(
    id: number,
    processImpl: (
        inputBuffers: readonly AudioBuffer[],
        outputBuffers: readonly AudioBuffer[],
        blockSize: number
    ) => void
): DSPModule {
    return {
        type: ModuleType.GAIN,
        id,
        inputs: EMPTY_PORTS,
        outputs: EMPTY_PORTS,
        process: processImpl,
        setParameter: () => {},
        getParameter: () => 0,
        reset: () => {},
    };
}

describe('plan executor', () => {
    test('executes modules in plan order and flows data through chain', () => {
        const blockSize = 4;
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [0], outputBufferIndices: [1] },
            ],
            arena: new Float32Array(blockSize * 2),
            bufferDescriptors: [
                { offset: 0, channelCount: 1, blockSize },
                { offset: blockSize, channelCount: 1, blockSize },
            ],
            outputChannelCount: 1,
        };

        const order: number[] = [];
        const modules: readonly DSPModule[] = [
            createTestModule(100, (_inputs, outputs, size) => {
                order.push(100);
                const out = outputs[0].data;
                for (let i = 0; i < size; i += 1) {
                    out[i] = i + 1;
                }
            }),
            createTestModule(200, (inputs, outputs, size) => {
                order.push(200);
                const src = inputs[0].data;
                const dst = outputs[0].data;
                for (let i = 0; i < size; i += 1) {
                    dst[i] = src[i] * 2;
                }
            }),
        ];

        const ctx = createExecutionContext(plan, modules);
        executePlan(ctx);

        expect(order).toEqual([100, 200]);
        expect(Array.from(ctx.descriptorBuffers[0].data)).toEqual([1, 2, 3, 4]);
        expect(Array.from(ctx.descriptorBuffers[1].data)).toEqual([2, 4, 6, 8]);
    });

    test('invalid moduleIndex in step throws during context creation', () => {
        const plan: CompiledPlan = {
            steps: [{ moduleIndex: 1, inputBufferIndices: [], outputBufferIndices: [0] }],
            arena: new Float32Array(8),
            bufferDescriptors: [{ offset: 0, channelCount: 1, blockSize: 8 }],
            outputChannelCount: 1,
        };
        const modules: readonly DSPModule[] = [createTestModule(1, () => {})];

        expect(() => createExecutionContext(plan, modules)).toThrow(/moduleIndex out of range/i);
    });

    test('invalid buffer descriptor range throws during context creation', () => {
        const plan: CompiledPlan = {
            steps: [{ moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] }],
            arena: new Float32Array(8),
            bufferDescriptors: [{ offset: 6, channelCount: 1, blockSize: 4 }],
            outputChannelCount: 1,
        };
        const modules: readonly DSPModule[] = [createTestModule(1, () => {})];

        expect(() => createExecutionContext(plan, modules)).toThrow(/range exceeds arena length/i);
    });

    test('executePlan throws on mismatched blockSize override', () => {
        const blockSize = 4;
        const plan: CompiledPlan = {
            steps: [{ moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] }],
            arena: new Float32Array(blockSize),
            bufferDescriptors: [{ offset: 0, channelCount: 1, blockSize }],
            outputChannelCount: 1,
        };
        const modules: readonly DSPModule[] = [createTestModule(1, () => {})];
        const ctx = createExecutionContext(plan, modules);

        expect(() => executePlan(ctx, blockSize + 1)).toThrow(/blockSize mismatch/i);
    });
});
