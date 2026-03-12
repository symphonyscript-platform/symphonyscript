import { VoiceState, ModuleType } from '../constants';
import type { VoiceState as VoiceStateValue } from '../constants';
import { executePlan, createExecutionContext, type ExecutionContext } from '../plan-executor';
import { EnvelopeParam } from '../modules/envelope';
import { OscillatorParam } from '../modules/oscillator';
import type { AudioBuffer, CompiledPlan, DSPModule, Voice } from '../types';

const SILENT_SAMPLE_THRESHOLD = 1e-4;

function resolveDefaultOutputBufferIndex(plan: CompiledPlan): number {
    const steps = plan.steps;
    if (steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        const outputBufferIndices = lastStep.outputBufferIndices;
        if (outputBufferIndices.length > 0) {
            return outputBufferIndices[outputBufferIndices.length - 1];
        }
    }

    const descriptors = plan.bufferDescriptors;
    if (descriptors.length === 0) {
        throw new Error('compiled plan must contain at least one output buffer');
    }
    return descriptors.length - 1;
}

function assertOutputBufferIndex(plan: CompiledPlan, outputBufferIndex: number): void {
    if (
        !Number.isInteger(outputBufferIndex) ||
        outputBufferIndex < 0 ||
        outputBufferIndex >= plan.bufferDescriptors.length
    ) {
        throw new Error(`outputBufferIndex out of range: ${outputBufferIndex}`);
    }
}

function zeroBuffer(buffer: AudioBuffer): void {
    const data = buffer.data;
    for (let i = 0; i < data.length; i += 1) {
        data[i] = 0;
    }
}

function isNearSilent(buffer: AudioBuffer): boolean {
    const data = buffer.data;
    for (let i = 0; i < data.length; i += 1) {
        if (Math.abs(data[i]) > SILENT_SAMPLE_THRESHOLD) {
            return false;
        }
    }
    return true;
}

export class BasicVoice implements Voice {
    public readonly modules: readonly DSPModule[];
    public readonly context: ExecutionContext;
    public readonly outputBufferIndex: number;

    public state: VoiceStateValue = VoiceState.IDLE;
    public pitch = -1;
    public frequency = 0;
    public velocity = 0;
    public gateOffset = 0;
    public expressionId = -1;

    public constructor(
        compiledPlan: CompiledPlan,
        modules: DSPModule[],
        outputBufferIndex = resolveDefaultOutputBufferIndex(compiledPlan)
    ) {
        assertOutputBufferIndex(compiledPlan, outputBufferIndex);
        this.modules = modules;
        this.context = createExecutionContext(compiledPlan, modules);
        this.outputBufferIndex = outputBufferIndex;
    }

    public noteOn(frequency: number, velocity: number, gateOffset: number): void {
        this.frequency = frequency;
        this.velocity = velocity;
        this.gateOffset = gateOffset;
        this.state = VoiceState.ACTIVE;

        for (let i = 0; i < this.modules.length; i += 1) {
            const module = this.modules[i];
            if (module.type === ModuleType.OSCILLATOR) {
                module.setParameter(OscillatorParam.FREQUENCY, frequency);
                continue;
            }
            if (module.type === ModuleType.ENVELOPE) {
                module.setParameter(EnvelopeParam.GATE, 1);
            }
        }
    }

    public noteOff(): void {
        this.state = VoiceState.RELEASE;
        for (let i = 0; i < this.modules.length; i += 1) {
            const module = this.modules[i];
            if (module.type === ModuleType.ENVELOPE) {
                module.setParameter(EnvelopeParam.GATE, 0);
            }
        }
    }

    public prepareStealRetrigger(): void {
        for (let i = 0; i < this.modules.length; i += 1) {
            const module = this.modules[i];
            if (module.type === ModuleType.ENVELOPE) {
                module.reset();
            }
        }
        zeroBuffer(this.context.descriptorBuffers[this.outputBufferIndex]);
    }

    public setParameter(paramId: number, value: number): void {
        for (let i = 0; i < this.modules.length; i += 1) {
            this.modules[i].setParameter(paramId, value);
        }
    }

    public render(blockSize: number): AudioBuffer {
        const outputBuffer = this.context.descriptorBuffers[this.outputBufferIndex];
        if (this.state === VoiceState.IDLE) {
            zeroBuffer(outputBuffer);
            return outputBuffer;
        }

        executePlan(this.context, blockSize);

        if (this.state === VoiceState.RELEASE && isNearSilent(outputBuffer)) {
            this.state = VoiceState.IDLE;
            this.pitch = -1;
            this.frequency = 0;
            this.velocity = 0;
            this.gateOffset = 0;
            this.expressionId = -1;
            zeroBuffer(outputBuffer);
        }

        return outputBuffer;
    }

    public reset(): void {
        for (let i = 0; i < this.modules.length; i += 1) {
            this.modules[i].reset();
        }
        this.state = VoiceState.IDLE;
        this.pitch = -1;
        this.frequency = 0;
        this.velocity = 0;
        this.gateOffset = 0;
        this.expressionId = -1;
        zeroBuffer(this.context.descriptorBuffers[this.outputBufferIndex]);
    }
}
