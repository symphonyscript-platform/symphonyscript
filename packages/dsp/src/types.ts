import type {
    ModuleType,
    PortRate,
    StealPolicy,
    VoiceState,
} from './constants';

export interface AudioBuffer {
    readonly channelCount: number;
    readonly blockSize: number;
    readonly data: Float32Array;
}

export interface PortDescriptor {
    readonly id: number;
    readonly rate: PortRate;
    readonly channelCount: number;
    readonly name: string;
}

export interface DSPModule {
    readonly type: ModuleType;
    readonly id: number;
    readonly inputs: readonly PortDescriptor[];
    readonly outputs: readonly PortDescriptor[];
    process(
        inputBuffers: readonly AudioBuffer[],
        outputBuffers: readonly AudioBuffer[],
        blockSize: number
    ): void;
    setParameter(paramId: number, value: number): void;
    getParameter(paramId: number): number;
    reset(): void;
}

export interface Wire {
    readonly sourceModuleId: number;
    readonly sourcePortId: number;
    readonly targetModuleId: number;
    readonly targetPortId: number;
}

export interface ParameterValue {
    readonly paramId: number;
    readonly value: number;
}

export interface ModuleDefinition {
    readonly id: number;
    readonly type: ModuleType;
    readonly initialParameters: readonly ParameterValue[];
}

export interface GraphDefinition {
    readonly modules: readonly ModuleDefinition[];
    readonly wires: readonly Wire[];
    readonly outputPortModuleId: number;
    readonly outputPortId: number;
}

export interface BufferDescriptor {
    readonly offset: number;
    readonly channelCount: number;
    readonly blockSize: number;
}

export interface PlanStep {
    readonly moduleIndex: number;
    readonly inputBufferIndices: readonly number[];
    readonly outputBufferIndices: readonly number[];
}

export interface CompiledPlan {
    readonly steps: readonly PlanStep[];
    readonly moduleIds: readonly number[];
    readonly arena: Float32Array;
    readonly bufferDescriptors: readonly BufferDescriptor[];
    readonly outputChannelCount: number;
}

export interface Voice {
    readonly state: VoiceState;
    noteOn(frequency: number, velocity: number, gateOffset: number): void;
    noteOff(): void;
    setParameter(paramId: number, value: number): void;
    render(blockSize: number): AudioBuffer;
    reset(): void;
}

export interface Instrument {
    readonly name: string;
    readonly maxVoices: number;
    readonly stealPolicy: StealPolicy;
    noteOn(
        pitch: number,
        velocity: number,
        gateOffset: number,
        expressionId: number
    ): number;
    noteOff(pitch: number, expressionId: number): void;
    allNotesOff(): void;
    setParameter(paramId: number, value: number): void;
    getParameter(paramId: number): number;
    render(blockSize: number): AudioBuffer;
    getActiveVoiceCount(): number;
    reset(): void;
}

export interface MixerChannel {
    instrument: Instrument | null;
    volume: number;
    pan: number;
    muted: boolean;
    sendLevels: Float32Array;
}

export interface SendBus {
    readonly id: number;
    readonly effect: DSPModule;
    readonly outputChannelCount: number;
    addInput(input: AudioBuffer, level: number): void;
    render(blockSize: number): AudioBuffer;
    clear(): void;
}

export interface Mixer {
    readonly masterChannelCount: number;
    readonly channels: readonly MixerChannel[];
    readonly sends: readonly SendBus[];
    masterVolume: number;
    masterPan: number;
    render(blockSize: number): AudioBuffer;
    reset(): void;
}

export interface Engine {
    readonly mixer: Mixer;
    readonly sampleRate: number;
    readonly blockSize: number;
    noteOn(
        channelId: number,
        pitch: number,
        velocity: number,
        gateOffset: number,
        expressionId: number
    ): void;
    noteOff(channelId: number, pitch: number, expressionId: number): void;
    controlChange(channelId: number, controller: number, value: number): void;
    render(): AudioBuffer;
    reset(): void;
}
