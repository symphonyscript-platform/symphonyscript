import type { AudioBuffer, CompiledPlan, DSPModule } from './types';

export interface ExecutionContext {
    readonly plan: CompiledPlan;
    readonly modules: readonly DSPModule[];
    readonly descriptorBuffers: readonly AudioBuffer[];
    readonly stepInputBuffers: readonly (readonly AudioBuffer[])[];
    readonly stepOutputBuffers: readonly (readonly AudioBuffer[])[];
    readonly blockSize: number;
}

function assertPositiveInteger(value: number, name: string): void {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
}

function resolveDescriptorBuffers(plan: CompiledPlan): AudioBuffer[] {
    const descriptors = plan.bufferDescriptors;
    const descriptorCount = descriptors.length;
    const arena = plan.arena;
    const buffers = new Array<AudioBuffer>(descriptorCount);

    for (let i = 0; i < descriptorCount; i += 1) {
        const descriptor = descriptors[i];
        assertPositiveInteger(descriptor.channelCount, `bufferDescriptors[${i}].channelCount`);
        assertPositiveInteger(descriptor.blockSize, `bufferDescriptors[${i}].blockSize`);
        if (!Number.isInteger(descriptor.offset) || descriptor.offset < 0) {
            throw new Error(`bufferDescriptors[${i}].offset must be a non-negative integer`);
        }

        const sampleLength = descriptor.channelCount * descriptor.blockSize;
        const end = descriptor.offset + sampleLength;
        if (end > arena.length) {
            throw new Error(`buffer descriptor ${i} range exceeds arena length`);
        }

        buffers[i] = {
            channelCount: descriptor.channelCount,
            blockSize: descriptor.blockSize,
            data: arena.subarray(descriptor.offset, end),
        };
    }

    return buffers;
}

function resolveStepBuffers(
    plan: CompiledPlan,
    descriptorBuffers: readonly AudioBuffer[]
): {
    stepInputBuffers: readonly (readonly AudioBuffer[])[];
    stepOutputBuffers: readonly (readonly AudioBuffer[])[];
} {
    const stepCount = plan.steps.length;
    const stepInputBuffers = new Array<readonly AudioBuffer[]>(stepCount);
    const stepOutputBuffers = new Array<readonly AudioBuffer[]>(stepCount);

    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
        const step = plan.steps[stepIndex];
        const inputCount = step.inputBufferIndices.length;
        const outputCount = step.outputBufferIndices.length;
        const inputs = new Array<AudioBuffer>(inputCount);
        const outputs = new Array<AudioBuffer>(outputCount);

        for (let i = 0; i < inputCount; i += 1) {
            const descriptorIndex = step.inputBufferIndices[i];
            const buffer = descriptorBuffers[descriptorIndex];
            if (buffer === undefined) {
                throw new Error(
                    `steps[${stepIndex}].inputBufferIndices[${i}] out of range: ${descriptorIndex}`
                );
            }
            inputs[i] = buffer;
        }

        for (let i = 0; i < outputCount; i += 1) {
            const descriptorIndex = step.outputBufferIndices[i];
            const buffer = descriptorBuffers[descriptorIndex];
            if (buffer === undefined) {
                throw new Error(
                    `steps[${stepIndex}].outputBufferIndices[${i}] out of range: ${descriptorIndex}`
                );
            }
            outputs[i] = buffer;
        }

        stepInputBuffers[stepIndex] = inputs;
        stepOutputBuffers[stepIndex] = outputs;
    }

    return { stepInputBuffers, stepOutputBuffers };
}

function resolvePlanBlockSize(plan: CompiledPlan): number {
    if (plan.bufferDescriptors.length === 0) {
        throw new Error('compiled plan must contain at least one buffer descriptor');
    }

    const blockSize = plan.bufferDescriptors[0].blockSize;
    assertPositiveInteger(blockSize, 'blockSize');

    for (let i = 1; i < plan.bufferDescriptors.length; i += 1) {
        const descriptorBlockSize = plan.bufferDescriptors[i].blockSize;
        if (descriptorBlockSize !== blockSize) {
            throw new Error('all buffer descriptors must share the same blockSize');
        }
    }

    return blockSize;
}

export function createExecutionContext(
    plan: CompiledPlan,
    modules: readonly DSPModule[]
): ExecutionContext {
    const descriptorBuffers = resolveDescriptorBuffers(plan);
    const blockSize = resolvePlanBlockSize(plan);

    for (let i = 0; i < plan.steps.length; i += 1) {
        const moduleIndex = plan.steps[i].moduleIndex;
        if (!Number.isInteger(moduleIndex) || moduleIndex < 0 || moduleIndex >= modules.length) {
            throw new Error(`steps[${i}].moduleIndex out of range: ${moduleIndex}`);
        }
    }

    for (let i = 0; i < plan.steps.length; i += 1) {
        const step = plan.steps[i];
        const expectedId = plan.moduleIds[i];
        const actualModule = modules[step.moduleIndex];
        if (actualModule.id !== expectedId) {
            throw new Error(
                `module order mismatch: step ${i} expects module id ${expectedId} but modules[${step.moduleIndex}] has id ${actualModule.id}`
            );
        }
    }

    const { stepInputBuffers, stepOutputBuffers } = resolveStepBuffers(plan, descriptorBuffers);

    return {
        plan,
        modules,
        descriptorBuffers,
        stepInputBuffers,
        stepOutputBuffers,
        blockSize,
    };
}

export function executePlan(ctx: ExecutionContext, blockSize?: number): void {
    const effectiveBlockSize = blockSize ?? ctx.blockSize;
    assertPositiveInteger(effectiveBlockSize, 'blockSize');

    if (effectiveBlockSize !== ctx.blockSize) {
        throw new Error(
            `blockSize mismatch: plan expects ${ctx.blockSize}, received ${effectiveBlockSize}`
        );
    }

    const steps = ctx.plan.steps;
    for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const module = ctx.modules[step.moduleIndex];
        module.process(ctx.stepInputBuffers[i], ctx.stepOutputBuffers[i], effectiveBlockSize);
    }
}
