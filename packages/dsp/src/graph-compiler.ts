import type {
    BufferDescriptor,
    CompiledPlan,
    GraphDefinition,
    PlanStep,
} from './types';

function assertPositiveInteger(value: number, name: string): void {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
}

function createModuleIndexById(def: GraphDefinition): Map<number, number> {
    const moduleCount = def.modules.length;
    if (moduleCount === 0) {
        throw new Error('graph must contain at least one module');
    }

    const indexById = new Map<number, number>();
    for (let i = 0; i < moduleCount; i += 1) {
        const module = def.modules[i];
        if (indexById.has(module.id)) {
            throw new Error(`duplicate module id: ${module.id}`);
        }
        indexById.set(module.id, i);
    }

    return indexById;
}

function topologicalSort(def: GraphDefinition, indexById: Map<number, number>): number[] {
    const moduleCount = def.modules.length;
    const adjacency: number[][] = Array.from({ length: moduleCount }, () => []);
    const indegree = new Int32Array(moduleCount);

    for (let i = 0; i < def.wires.length; i += 1) {
        const wire = def.wires[i];
        const sourceIndex = indexById.get(wire.sourceModuleId);
        const targetIndex = indexById.get(wire.targetModuleId);

        if (sourceIndex === undefined) {
            throw new Error(`wire references missing source module id: ${wire.sourceModuleId}`);
        }
        if (targetIndex === undefined) {
            throw new Error(`wire references missing target module id: ${wire.targetModuleId}`);
        }

        adjacency[sourceIndex].push(targetIndex);
        indegree[targetIndex] += 1;
    }

    const queue: number[] = [];
    for (let i = 0; i < moduleCount; i += 1) {
        if (indegree[i] === 0) {
            queue.push(i);
        }
    }

    const order: number[] = [];
    let queueHead = 0;
    while (queueHead < queue.length) {
        const current = queue[queueHead];
        queueHead += 1;
        order.push(current);

        const neighbors = adjacency[current];
        for (let i = 0; i < neighbors.length; i += 1) {
            const target = neighbors[i];
            indegree[target] -= 1;
            if (indegree[target] === 0) {
                queue.push(target);
            }
        }
    }

    if (order.length !== moduleCount) {
        throw new Error('graph must be acyclic');
    }

    return order;
}

export function validateGraph(def: GraphDefinition): void {
    const indexById = createModuleIndexById(def);

    for (let i = 0; i < def.wires.length; i += 1) {
        const wire = def.wires[i];
        if (!indexById.has(wire.sourceModuleId)) {
            throw new Error(`wire references missing source module id: ${wire.sourceModuleId}`);
        }
        if (!indexById.has(wire.targetModuleId)) {
            throw new Error(`wire references missing target module id: ${wire.targetModuleId}`);
        }
    }

    if (!indexById.has(def.outputPortModuleId)) {
        throw new Error(
            `outputPortModuleId references missing module id: ${def.outputPortModuleId}`
        );
    }

    topologicalSort(def, indexById);
}

// TODO(RFC-061): validate outputPortCount against module.outputs.length at context creation time
function getOutputPortCount(moduleDef: { outputPortCount?: number }): number {
    const n = moduleDef.outputPortCount;
    if (n === undefined || n < 1) {
        return 1;
    }
    if (!Number.isInteger(n)) {
        throw new Error('outputPortCount must be a positive integer');
    }
    return n;
}

export function compileGraph(def: GraphDefinition, blockSize: number): CompiledPlan {
    assertPositiveInteger(blockSize, 'blockSize');
    validateGraph(def);

    const order = topologicalSort(def, createModuleIndexById(def));
    const moduleCount = def.modules.length;

    const bufferIndexByModuleAndPort = new Map<string, number>();
    const bufferDescriptors: BufferDescriptor[] = [];
    let runningBufferIndex = 0;

    for (let i = 0; i < order.length; i += 1) {
        const moduleIndex = order[i];
        const moduleDef = def.modules[moduleIndex];
        const outputCount = getOutputPortCount(moduleDef);

        for (let portId = 0; portId < outputCount; portId += 1) {
            const key = `${moduleDef.id}:${portId}`;
            bufferIndexByModuleAndPort.set(key, runningBufferIndex);
            bufferDescriptors.push({
                channelCount: 0,
                blockSize,
                offset: 0,
            });
            runningBufferIndex += 1;
        }
    }

    const steps: PlanStep[] = [];
    for (let i = 0; i < order.length; i += 1) {
        const moduleIndex = order[i];
        const moduleDef = def.modules[moduleIndex];
        const moduleId = moduleDef.id;
        const outputCount = getOutputPortCount(moduleDef);
        const firstIndex = bufferIndexByModuleAndPort.get(`${moduleId}:0`);
        if (firstIndex === undefined) {
            throw new Error(`internal compiler error: missing buffer for module id ${moduleId}`);
        }

        const outputBufferIndices: number[] = [];
        for (let portId = 0; portId < outputCount; portId += 1) {
            outputBufferIndices.push(firstIndex + portId);
        }

        const inputBufferIndices: number[] = [];
        for (let wireIndex = 0; wireIndex < def.wires.length; wireIndex += 1) {
            const wire = def.wires[wireIndex];
            if (wire.targetModuleId !== moduleId) {
                continue;
            }
            const sourceKey = `${wire.sourceModuleId}:${wire.sourcePortId}`;
            const sourceBufferIndex = bufferIndexByModuleAndPort.get(sourceKey);
            if (sourceBufferIndex === undefined) {
                throw new Error(
                    `internal compiler error: missing source buffer for module id ${wire.sourceModuleId} port ${wire.sourcePortId}`
                );
            }
            inputBufferIndices.push(sourceBufferIndex);
        }

        steps.push({
            moduleIndex,
            inputBufferIndices,
            outputBufferIndices,
        });
    }

    const moduleIds: number[] = [];
    for (let i = 0; i < order.length; i += 1) {
        moduleIds.push(def.modules[order[i]].id);
    }

    return {
        steps,
        moduleIds,
        wires: def.wires,
        arena: new Float32Array(0),
        bufferDescriptors,
        outputChannelCount: 1,
    };
}
