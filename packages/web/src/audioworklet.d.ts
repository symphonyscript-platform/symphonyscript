/// <reference lib="webworker" />

declare var sampleRate: number;
declare var currentFrame: number;
declare var currentTime: number;

declare function registerProcessor(
    name: string,
    processorCtor: (new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor) & {
        parameterDescriptors?: AudioParamDescriptor[];
    }
): void;

declare class AudioWorkletProcessor {
    protected readonly port: MessagePort;
    constructor(options?: AudioWorkletNodeOptions);
    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean;
}

interface AudioWorkletNodeOptions {
    processorOptions?: any;
    numberOfInputs?: number;
    numberOfOutputs?: number;
    outputChannelCount?: number[];
    parameterData?: { [name: string]: number };
}

interface AudioParamDescriptor {
    name: string;
    defaultValue?: number;
    minValue?: number;
    maxValue?: number;
    automationRate?: 'a-rate' | 'k-rate';
}
