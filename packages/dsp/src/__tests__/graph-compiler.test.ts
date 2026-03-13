import { ModuleType } from '../constants';
import { compileGraph } from '../graph-compiler';
import type { GraphDefinition } from '../types';

function createGraph(
    moduleIds: readonly number[],
    wires: GraphDefinition['wires'],
    outputPortModuleId: number
): GraphDefinition {
    return {
        modules: moduleIds.map((id) => ({
            id,
            type: ModuleType.GAIN,
            initialParameters: [],
        })),
        wires,
        outputPortModuleId,
        outputPortId: 0,
    };
}

describe('graph compiler', () => {
    test('compile simple chain A->B->C produces 3 steps in topo order', () => {
        const graph = createGraph(
            [1, 2, 3],
            [
                { sourceModuleId: 1, sourcePortId: 0, targetModuleId: 2, targetPortId: 0 },
                { sourceModuleId: 2, sourcePortId: 0, targetModuleId: 3, targetPortId: 0 },
            ],
            3
        );

        const plan = compileGraph(graph, 64);

        expect(plan.steps).toHaveLength(3);
        expect(plan.steps.map((step) => step.moduleIndex)).toEqual([0, 1, 2]);
        expect(plan.moduleIds).toEqual([1, 2, 3]);
        expect(plan.steps[0]?.inputBufferIndices).toEqual([]);
        expect(plan.steps[1]?.inputBufferIndices).toEqual([0]);
        expect(plan.steps[2]?.inputBufferIndices).toEqual([1]);
        expect(plan.bufferDescriptors).toHaveLength(3);
        expect(plan.arena.length).toBe(3 * 64);
        expect(plan.outputChannelCount).toBe(1);
    });

    test('compile fan-out/fan-in shape has valid inputBufferIndices', () => {
        const graph = createGraph(
            [10, 20, 30, 40],
            [
                { sourceModuleId: 10, sourcePortId: 0, targetModuleId: 20, targetPortId: 0 },
                { sourceModuleId: 10, sourcePortId: 0, targetModuleId: 30, targetPortId: 0 },
                { sourceModuleId: 20, sourcePortId: 0, targetModuleId: 40, targetPortId: 0 },
                { sourceModuleId: 30, sourcePortId: 0, targetModuleId: 40, targetPortId: 0 },
            ],
            40
        );

        const plan = compileGraph(graph, 32);
        const moduleBufferIndex = new Map<number, number>();

        for (let i = 0; i < plan.steps.length; i += 1) {
            const step = plan.steps[i];
            moduleBufferIndex.set(graph.modules[step.moduleIndex].id, step.outputBufferIndices[0]);
        }

        const mergeStep = plan.steps.find(
            (step) => graph.modules[step.moduleIndex].id === 40
        );

        expect(mergeStep).toBeDefined();
        expect(mergeStep?.inputBufferIndices).toEqual([
            moduleBufferIndex.get(20),
            moduleBufferIndex.get(30),
        ]);
    });

    test('duplicate module ID throws', () => {
        const graph = createGraph([1, 1], [], 1);
        expect(() => compileGraph(graph, 64)).toThrow(/duplicate module id/i);
    });

    test('wire to missing module throws', () => {
        const graph = createGraph(
            [1],
            [{ sourceModuleId: 1, sourcePortId: 0, targetModuleId: 999, targetPortId: 0 }],
            1
        );
        expect(() => compileGraph(graph, 64)).toThrow(/missing target module/i);
    });

    test('cycle throws', () => {
        const graph = createGraph(
            [1, 2],
            [
                { sourceModuleId: 1, sourcePortId: 0, targetModuleId: 2, targetPortId: 0 },
                { sourceModuleId: 2, sourcePortId: 0, targetModuleId: 1, targetPortId: 0 },
            ],
            2
        );
        expect(() => compileGraph(graph, 64)).toThrow(/acyclic/i);
    });

    test('invalid blockSize throws', () => {
        const graph = createGraph([1], [], 1);
        expect(() => compileGraph(graph, 0)).toThrow(/blockSize/i);
        expect(() => compileGraph(graph, -1)).toThrow(/blockSize/i);
        expect(() => compileGraph(graph, 1.5)).toThrow(/blockSize/i);
    });
});
