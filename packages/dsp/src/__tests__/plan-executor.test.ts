import { ModuleType, PortRate } from '../constants';
import { compileGraph } from '../graph-compiler';
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
            moduleIds: [100, 200],
            wires: [],
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

    test('module order mismatch throws during context creation', () => {
        const plan: CompiledPlan = {
            steps: [
                { moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] },
                { moduleIndex: 1, inputBufferIndices: [0], outputBufferIndices: [1] },
            ],
            moduleIds: [100, 200],
            wires: [],
            arena: new Float32Array(16),
            bufferDescriptors: [
                { offset: 0, channelCount: 1, blockSize: 8 },
                { offset: 8, channelCount: 1, blockSize: 8 },
            ],
            outputChannelCount: 1,
        };
        const modules: readonly DSPModule[] = [
            createTestModule(200, () => {}),
            createTestModule(100, () => {}),
        ];

        expect(() => createExecutionContext(plan, modules)).toThrow(
            /module order mismatch: step 0 expects module id 100 but modules\[0\] has id 200/i
        );
    });

    test('invalid moduleIndex in step throws during context creation', () => {
        const plan: CompiledPlan = {
            steps: [{ moduleIndex: 1, inputBufferIndices: [], outputBufferIndices: [0] }],
            moduleIds: [1],
            wires: [],
            arena: new Float32Array(8),
            bufferDescriptors: [{ offset: 0, channelCount: 1, blockSize: 8 }],
            outputChannelCount: 1,
        };
        const modules: readonly DSPModule[] = [createTestModule(1, () => {})];

        expect(() => createExecutionContext(plan, modules)).toThrow(/moduleIndex out of range/i);
    });

    test('executePlan throws on mismatched blockSize override', () => {
        const blockSize = 4;
        const plan: CompiledPlan = {
            steps: [{ moduleIndex: 0, inputBufferIndices: [], outputBufferIndices: [0] }],
            moduleIds: [1],
            wires: [],
            arena: new Float32Array(blockSize),
            bufferDescriptors: [{ offset: 0, channelCount: 1, blockSize }],
            outputChannelCount: 1,
        };
        const modules: readonly DSPModule[] = [createTestModule(1, () => {})];
        const ctx = createExecutionContext(plan, modules);

        expect(() => executePlan(ctx, blockSize + 1)).toThrow(/blockSize mismatch/i);
    });

    test('channel count mismatch throws with exact error format', () => {
        const blockSize = 64;
        const plan = compileGraph(
            {
                modules: [
                    { id: 1, type: ModuleType.GAIN, initialParameters: [] },
                    { id: 2, type: ModuleType.GAIN, initialParameters: [] },
                ],
                wires: [
                    { sourceModuleId: 1, sourcePortId: 0, targetModuleId: 2, targetPortId: 0 },
                ],
                outputPortModuleId: 2,
                outputPortId: 0,
            },
            blockSize
        );

        const stereoOutputModule: DSPModule = {
            type: ModuleType.GAIN,
            id: 1,
            inputs: EMPTY_PORTS,
            outputs: [{ id: 0, rate: PortRate.AUDIO, channelCount: 2, name: 'out' }],
            process: () => {},
            setParameter: () => {},
            getParameter: () => 0,
            reset: () => {},
        };

        const monoInputModule: DSPModule = {
            type: ModuleType.GAIN,
            id: 2,
            inputs: [{ id: 0, rate: PortRate.AUDIO, channelCount: 1, name: 'in' }],
            outputs: EMPTY_PORTS,
            process: () => {},
            setParameter: () => {},
            getParameter: () => 0,
            reset: () => {},
        };

        const modules = [stereoOutputModule, monoInputModule];

        expect(() => createExecutionContext(plan, modules)).toThrow(
            /channel count mismatch: wire from module 1 port 0 → module 2 port 0: source has 2 channels, target expects 1/
        );
    });
});
