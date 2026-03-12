import { ModuleType, PortRate, StealPolicy, VoiceState } from '../constants';
import type {
    AudioBuffer,
    GraphDefinition,
    ModuleDefinition,
    ParameterValue,
    PortDescriptor,
} from '../types';

describe('dsp interface scaffolding', () => {
    test('exports numeric runtime constants', () => {
        expect(PortRate.AUDIO).toBe(0);
        expect(VoiceState.RELEASE).toBe(2);
        expect(ModuleType.OUTPUT).toBe(12);
        expect(StealPolicy.NONE).toBe(4);
    });

    test('supports compile-safe object literal shape', () => {
        const inputPort: PortDescriptor = {
            id: 0,
            rate: PortRate.AUDIO,
            channelCount: 1,
            name: 'in',
        };

        const params: readonly ParameterValue[] = [{ paramId: 0, value: 440 }];
        const moduleDefinition: ModuleDefinition = {
            id: 1,
            type: ModuleType.OSCILLATOR,
            initialParameters: params,
        };
        const graph: GraphDefinition = {
            modules: [moduleDefinition],
            wires: [],
            outputPortModuleId: 1,
            outputPortId: 0,
        };
        const buffer: AudioBuffer = {
            channelCount: 1,
            blockSize: 64,
            data: new Float32Array(64),
        };

        expect(inputPort.channelCount).toBe(1);
        expect(graph.modules[0]?.type).toBe(ModuleType.OSCILLATOR);
        expect(buffer.data.length).toBe(64);
    });
});
