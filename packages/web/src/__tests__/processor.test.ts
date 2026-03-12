import type { AudioBuffer, Engine } from '@symphonyscript/dsp';
import {
    FLAG,
    NODE,
    NULL_PTR,
    OPCODE,
    SiliconSynapse,
    createLinkerSAB,
} from '@symphonyscript/kernel';
import { WORKLET_MESSAGE_TYPE } from '../runtime/driver';

type WorkletInboundMessage =
    | {
          readonly type: typeof WORKLET_MESSAGE_TYPE.INIT;
          readonly sampleRate: number;
          readonly blockSize: number;
          readonly sab: SharedArrayBuffer;
      }
    | { readonly type: typeof WORKLET_MESSAGE_TYPE.PLAY }
    | { readonly type: typeof WORKLET_MESSAGE_TYPE.PAUSE }
    | { readonly type: typeof WORKLET_MESSAGE_TYPE.STOP };

interface TestProcessorInstance {
    readonly port: {
        onmessage: ((event: { data: WorkletInboundMessage }) => void) | null;
    };
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

interface RegisteredProcessor {
    readonly name: string;
    readonly ctor: new (options?: unknown) => TestProcessorInstance;
}

async function getRegisteredProcessor(): Promise<RegisteredProcessor> {
    const registerProcessorMock = jest.fn<void, [string, unknown]>();
    (globalThis as Record<string, unknown>).registerProcessor = registerProcessorMock;

    await import('../runtime/processor');

    expect(registerProcessorMock).toHaveBeenCalledTimes(1);
    const [name, ctor] = registerProcessorMock.mock.calls[0] ?? [];
    expect(typeof ctor).toBe('function');

    return {
        name: name as string,
        ctor: ctor as new (options?: unknown) => TestProcessorInstance,
    };
}

function postMessageToProcessor(
    processor: TestProcessorInstance,
    message: WorkletInboundMessage
): void {
    const onmessage = processor.port.onmessage;
    expect(typeof onmessage).toBe('function');
    onmessage?.({ data: message });
}

function createBuffer(channelCount: number, blockSize: number): Float32Array[] {
    const channels: Float32Array[] = [];
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        channels.push(new Float32Array(blockSize));
    }
    return channels;
}

function expectChannelCloseTo(
    channel: Float32Array,
    expected: readonly number[]
): void {
    expect(channel.length).toBe(expected.length);
    for (let sampleIndex = 0; sampleIndex < expected.length; sampleIndex += 1) {
        expect(channel[sampleIndex]).toBeCloseTo(expected[sampleIndex], 6);
    }
}

function createRenderedAudioBuffer(
    channelCount: number,
    blockSize: number,
    values: readonly number[]
): AudioBuffer {
    return {
        channelCount,
        blockSize,
        data: new Float32Array(values),
    };
}

type LinkerLike = {
    poll: jest.Mock<number, []>;
    getHead: jest.Mock<number, []>;
    readNodeRaw: jest.Mock<boolean, [number, Int32Array]>;
    getBpm: jest.Mock<number, []>;
    getPpq: jest.Mock<number, []>;
    getPlayheadTick: jest.Mock<number, []>;
    setPlayheadTick: jest.Mock<void, [number]>;
};

function createLinkerMock(options?: {
    head?: number;
    nodes?: Record<number, Int32Array>;
    bpm?: number;
    ppq?: number;
    playheadTick?: number;
}): LinkerLike {
    const nodeMap = options?.nodes ?? {};
    let playheadTick = options?.playheadTick ?? 0;
    return {
        poll: jest.fn(() => 0),
        getHead: jest.fn(() => options?.head ?? NULL_PTR),
        readNodeRaw: jest.fn((ptr: number, buf: Int32Array) => {
            const node = nodeMap[ptr];
            if (node === undefined) {
                return false;
            }
            for (let i = 0; i < 8; i += 1) {
                buf[i] = node[i];
            }
            return true;
        }),
        getBpm: jest.fn(() => options?.bpm ?? 120),
        getPpq: jest.fn(() => options?.ppq ?? 480),
        getPlayheadTick: jest.fn(() => playheadTick),
        setPlayheadTick: jest.fn((tick: number) => {
            playheadTick = tick;
        }),
    };
}

function createPacked(
    opcode: number,
    pitch: number,
    velocity: number,
    flags: number
): number {
    return (opcode << 24) | (pitch << 16) | (velocity << 8) | flags;
}

function createNode(
    packed: number,
    baseTick: number,
    duration: number,
    nextPtr: number
): Int32Array {
    const buf = new Int32Array(8);
    buf[NODE.PACKED_A] = packed;
    buf[NODE.BASE_TICK] = baseTick;
    buf[NODE.DURATION] = duration;
    buf[NODE.NEXT_PTR] = nextPtr;
    return buf;
}

function createEngineMock(rendered: AudioBuffer): jest.Mocked<Pick<
    Engine,
    'render' | 'reset' | 'noteOn' | 'noteOff' | 'controlChange'
>> {
    return {
        render: jest.fn(() => rendered),
        reset: jest.fn(),
        noteOn: jest.fn(),
        noteOff: jest.fn(),
        controlChange: jest.fn(),
    };
}

function createValidLinkerSAB(): SharedArrayBuffer {
    const sab = createLinkerSAB({ nodeCapacity: 32 });
    expect(sab).not.toBeNull();
    return sab as SharedArrayBuffer;
}

describe('processor', () => {
    beforeEach(() => {
        jest.resetModules();
        delete (globalThis as Record<string, unknown>).__SYMPHONYSCRIPT_ENGINE_FACTORY__;
        delete (globalThis as Record<string, unknown>).__SYMPHONYSCRIPT_LINKER_FACTORY__;
    });

    test('registers under symphonyscript-processor', async () => {
        const registered = await getRegisteredProcessor();
        expect(registered.name).toBe('symphonyscript-processor');
    });

    test('outputs silence while uninitialized', async () => {
        const registered = await getRegisteredProcessor();
        const processor = new registered.ctor();
        const output = createBuffer(2, 4);

        output[0].fill(1);
        output[1].fill(-1);
        const keepAlive = processor.process([], [output]);

        expect(keepAlive).toBe(true);
        expect(Array.from(output[0])).toEqual([0, 0, 0, 0]);
        expect(Array.from(output[1])).toEqual([0, 0, 0, 0]);
    });

    test('after INIT and PLAY, render output is copied to channels', async () => {
        const linker = createLinkerMock();
        const rendered = createRenderedAudioBuffer(2, 4, [
            0.1, 0.2, 0.3, 0.4, -0.1, -0.2, -0.3, -0.4,
        ]);
        const engine = createEngineMock(rendered);
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_ENGINE_FACTORY__?: (
                    sampleRate: number,
                    blockSize: number
                ) => Engine;
            }
        ).__SYMPHONYSCRIPT_ENGINE_FACTORY__ = (sampleRate, blockSize) => {
            expect(sampleRate).toBe(48000);
            expect(blockSize).toBe(4);
            return engine as unknown as Engine;
        };
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_LINKER_FACTORY__?: (
                    sab: SharedArrayBuffer
                ) => LinkerLike | null;
            }
        ).__SYMPHONYSCRIPT_LINKER_FACTORY__ = (sab) => {
            expect(sab).toBeInstanceOf(SharedArrayBuffer);
            return linker;
        };

        const registered = await getRegisteredProcessor();
        const processor = new registered.ctor();
        const output = createBuffer(2, 4);

        postMessageToProcessor(processor, {
            type: WORKLET_MESSAGE_TYPE.INIT,
            sampleRate: 48000,
            blockSize: 4,
            sab: new SharedArrayBuffer(256),
        });
        postMessageToProcessor(processor, { type: WORKLET_MESSAGE_TYPE.PLAY });

        processor.process([], [output]);

        expect(linker.poll).toHaveBeenCalledTimes(1);
        expect(engine.render).toHaveBeenCalledTimes(1);
        expect(linker.setPlayheadTick).toHaveBeenCalledTimes(1);
        expectChannelCloseTo(output[0], [0.1, 0.2, 0.3, 0.4]);
        expectChannelCloseTo(output[1], [-0.1, -0.2, -0.3, -0.4]);
    });

    test('PAUSE and STOP gate playback, and STOP resets engine', async () => {
        const linker = createLinkerMock();
        const rendered = createRenderedAudioBuffer(1, 4, [0.5, 0.25, 0.75, 1]);
        const engine = createEngineMock(rendered);
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_ENGINE_FACTORY__?: (
                    sampleRate: number,
                    blockSize: number
                ) => Engine;
            }
        ).__SYMPHONYSCRIPT_ENGINE_FACTORY__ = () => engine as unknown as Engine;
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_LINKER_FACTORY__?: (
                    sab: SharedArrayBuffer
                ) => LinkerLike | null;
            }
        ).__SYMPHONYSCRIPT_LINKER_FACTORY__ = () => linker;

        const registered = await getRegisteredProcessor();
        const processor = new registered.ctor();
        const output = createBuffer(1, 4);

        postMessageToProcessor(processor, {
            type: WORKLET_MESSAGE_TYPE.INIT,
            sampleRate: 48000,
            blockSize: 4,
            sab: new SharedArrayBuffer(256),
        });
        postMessageToProcessor(processor, { type: WORKLET_MESSAGE_TYPE.PLAY });
        processor.process([], [output]);
        expect(engine.render).toHaveBeenCalledTimes(1);
        expect(linker.poll).toHaveBeenCalledTimes(1);
        expect(linker.setPlayheadTick).toHaveBeenCalledTimes(1);

        postMessageToProcessor(processor, { type: WORKLET_MESSAGE_TYPE.PAUSE });
        processor.process([], [output]);
        expect(engine.render).toHaveBeenCalledTimes(1);
        expect(linker.poll).toHaveBeenCalledTimes(2);
        expect(Array.from(output[0])).toEqual([0, 0, 0, 0]);

        postMessageToProcessor(processor, { type: WORKLET_MESSAGE_TYPE.STOP });
        expect(engine.reset).toHaveBeenCalledTimes(1);
        processor.process([], [output]);
        expect(engine.render).toHaveBeenCalledTimes(1);
        expect(linker.poll).toHaveBeenCalledTimes(3);
        expect(Array.from(output[0])).toEqual([0, 0, 0, 0]);
    });

    test('in-window NOTE node triggers engine.noteOn', async () => {
        const nodePtr = 64;
        const linker = createLinkerMock({
            head: nodePtr,
            playheadTick: 0,
            nodes: {
                [nodePtr]: createNode(
                    createPacked(
                        OPCODE.NOTE,
                        64,
                        127,
                        (3 << FLAG.EXPRESSION_SHIFT) | FLAG.ACTIVE
                    ),
                    2,
                    8,
                    NULL_PTR
                ),
            },
        });
        const rendered = createRenderedAudioBuffer(1, 256, new Array(256).fill(0));
        const engine = createEngineMock(rendered);
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_ENGINE_FACTORY__?: (
                    sampleRate: number,
                    blockSize: number
                ) => Engine;
            }
        ).__SYMPHONYSCRIPT_ENGINE_FACTORY__ = () => engine as unknown as Engine;
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_LINKER_FACTORY__?: (
                    sab: SharedArrayBuffer
                ) => LinkerLike | null;
            }
        ).__SYMPHONYSCRIPT_LINKER_FACTORY__ = () => linker;

        const registered = await getRegisteredProcessor();
        const processor = new registered.ctor();
        const output = createBuffer(1, 256);

        postMessageToProcessor(processor, {
            type: WORKLET_MESSAGE_TYPE.INIT,
            sampleRate: 48000,
            blockSize: 256,
            sab: new SharedArrayBuffer(256),
        });
        postMessageToProcessor(processor, { type: WORKLET_MESSAGE_TYPE.PLAY });

        processor.process([], [output]);

        expect(engine.noteOn).toHaveBeenCalledTimes(1);
        expect(engine.noteOn).toHaveBeenCalledWith(3, 64, 1, 100, 3);
    });

    test('in-window note end triggers engine.noteOff', async () => {
        const nodePtr = 128;
        const linker = createLinkerMock({
            head: nodePtr,
            playheadTick: 0,
            nodes: {
                [nodePtr]: createNode(
                    createPacked(
                        OPCODE.NOTE,
                        60,
                        100,
                        (2 << FLAG.EXPRESSION_SHIFT) | FLAG.ACTIVE
                    ),
                    1,
                    2,
                    NULL_PTR
                ),
            },
        });
        const rendered = createRenderedAudioBuffer(1, 256, new Array(256).fill(0));
        const engine = createEngineMock(rendered);
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_ENGINE_FACTORY__?: (
                    sampleRate: number,
                    blockSize: number
                ) => Engine;
            }
        ).__SYMPHONYSCRIPT_ENGINE_FACTORY__ = () => engine as unknown as Engine;
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_LINKER_FACTORY__?: (
                    sab: SharedArrayBuffer
                ) => LinkerLike | null;
            }
        ).__SYMPHONYSCRIPT_LINKER_FACTORY__ = () => linker;

        const registered = await getRegisteredProcessor();
        const processor = new registered.ctor();
        const output = createBuffer(1, 256);

        postMessageToProcessor(processor, {
            type: WORKLET_MESSAGE_TYPE.INIT,
            sampleRate: 48000,
            blockSize: 256,
            sab: new SharedArrayBuffer(256),
        });
        postMessageToProcessor(processor, { type: WORKLET_MESSAGE_TYPE.PLAY });

        processor.process([], [output]);

        expect(engine.noteOff).toHaveBeenCalledTimes(1);
        expect(engine.noteOff).toHaveBeenCalledWith(2, 60, 2);
    });

    test('in-window CC node triggers engine.controlChange', async () => {
        const nodePtr = 160;
        const linker = createLinkerMock({
            head: nodePtr,
            playheadTick: 0,
            nodes: {
                [nodePtr]: createNode(
                    createPacked(
                        OPCODE.CC,
                        74,
                        64,
                        (5 << FLAG.EXPRESSION_SHIFT) | FLAG.ACTIVE
                    ),
                    2,
                    0,
                    NULL_PTR
                ),
            },
        });
        const rendered = createRenderedAudioBuffer(1, 256, new Array(256).fill(0));
        const engine = createEngineMock(rendered);
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_ENGINE_FACTORY__?: (
                    sampleRate: number,
                    blockSize: number
                ) => Engine;
            }
        ).__SYMPHONYSCRIPT_ENGINE_FACTORY__ = () => engine as unknown as Engine;
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_LINKER_FACTORY__?: (
                    sab: SharedArrayBuffer
                ) => LinkerLike | null;
            }
        ).__SYMPHONYSCRIPT_LINKER_FACTORY__ = () => linker;

        const registered = await getRegisteredProcessor();
        const processor = new registered.ctor();
        const output = createBuffer(1, 256);

        postMessageToProcessor(processor, {
            type: WORKLET_MESSAGE_TYPE.INIT,
            sampleRate: 48000,
            blockSize: 256,
            sab: new SharedArrayBuffer(256),
        });
        postMessageToProcessor(processor, { type: WORKLET_MESSAGE_TYPE.PLAY });

        processor.process([], [output]);

        expect(engine.controlChange).toHaveBeenCalledTimes(1);
        expect(engine.controlChange).toHaveBeenCalledWith(5, 74, 64 / 127);
    });

    test('out-of-window events do not trigger engine callbacks', async () => {
        const nodePtr = 192;
        const linker = createLinkerMock({
            head: nodePtr,
            playheadTick: 0,
            nodes: {
                [nodePtr]: createNode(
                    createPacked(
                        OPCODE.NOTE,
                        72,
                        90,
                        (1 << FLAG.EXPRESSION_SHIFT) | FLAG.ACTIVE
                    ),
                    16,
                    2,
                    NULL_PTR
                ),
            },
        });
        const rendered = createRenderedAudioBuffer(1, 256, new Array(256).fill(0));
        const engine = createEngineMock(rendered);
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_ENGINE_FACTORY__?: (
                    sampleRate: number,
                    blockSize: number
                ) => Engine;
            }
        ).__SYMPHONYSCRIPT_ENGINE_FACTORY__ = () => engine as unknown as Engine;
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_LINKER_FACTORY__?: (
                    sab: SharedArrayBuffer
                ) => LinkerLike | null;
            }
        ).__SYMPHONYSCRIPT_LINKER_FACTORY__ = () => linker;

        const registered = await getRegisteredProcessor();
        const processor = new registered.ctor();
        const output = createBuffer(1, 256);

        postMessageToProcessor(processor, {
            type: WORKLET_MESSAGE_TYPE.INIT,
            sampleRate: 48000,
            blockSize: 256,
            sab: new SharedArrayBuffer(256),
        });
        postMessageToProcessor(processor, { type: WORKLET_MESSAGE_TYPE.PLAY });

        processor.process([], [output]);

        expect(engine.noteOn).not.toHaveBeenCalled();
        expect(engine.noteOff).not.toHaveBeenCalled();
        expect(engine.controlChange).not.toHaveBeenCalled();
    });

    test('playhead advances to endTick after process while playing', async () => {
        const linker = createLinkerMock({
            head: NULL_PTR,
            playheadTick: 0,
        });
        const rendered = createRenderedAudioBuffer(1, 256, new Array(256).fill(0));
        const engine = createEngineMock(rendered);
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_ENGINE_FACTORY__?: (
                    sampleRate: number,
                    blockSize: number
                ) => Engine;
            }
        ).__SYMPHONYSCRIPT_ENGINE_FACTORY__ = () => engine as unknown as Engine;
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_LINKER_FACTORY__?: (
                    sab: SharedArrayBuffer
                ) => LinkerLike | null;
            }
        ).__SYMPHONYSCRIPT_LINKER_FACTORY__ = () => linker;

        const registered = await getRegisteredProcessor();
        const processor = new registered.ctor();
        const output = createBuffer(1, 256);

        postMessageToProcessor(processor, {
            type: WORKLET_MESSAGE_TYPE.INIT,
            sampleRate: 48000,
            blockSize: 256,
            sab: new SharedArrayBuffer(256),
        });
        postMessageToProcessor(processor, { type: WORKLET_MESSAGE_TYPE.PLAY });

        processor.process([], [output]);

        expect(linker.setPlayheadTick).toHaveBeenCalledTimes(1);
        expect(linker.setPlayheadTick).toHaveBeenCalledWith(5.12);
    });

    test('INIT creates linker via factory with provided SAB', async () => {
        const linker = createLinkerMock();
        const createLinker = jest.fn((sab: SharedArrayBuffer) => {
            expect(sab.byteLength).toBe(512);
            return linker;
        });
        (
            globalThis as Record<string, unknown> & {
                __SYMPHONYSCRIPT_LINKER_FACTORY__?: (
                    sab: SharedArrayBuffer
                ) => LinkerLike | null;
            }
        ).__SYMPHONYSCRIPT_LINKER_FACTORY__ = createLinker;

        const registered = await getRegisteredProcessor();
        const processor = new registered.ctor();

        postMessageToProcessor(processor, {
            type: WORKLET_MESSAGE_TYPE.INIT,
            sampleRate: 48000,
            blockSize: 128,
            sab: new SharedArrayBuffer(512),
        });

        expect(createLinker).toHaveBeenCalledTimes(1);
    });

    test('INIT without linker factory uses default SiliconSynapse and polls in process', async () => {
        const registered = await getRegisteredProcessor();
        const processor = new registered.ctor();
        const output = createBuffer(1, 4);

        delete (globalThis as Record<string, unknown>)
            .__SYMPHONYSCRIPT_LINKER_FACTORY__;

        expect(() => {
            postMessageToProcessor(processor, {
                type: WORKLET_MESSAGE_TYPE.INIT,
                sampleRate: 48000,
                blockSize: 4,
                sab: createValidLinkerSAB(),
            });
        }).not.toThrow();

        const linker = (
            processor as unknown as { linker: SiliconSynapse | null }
        ).linker;
        expect(linker).not.toBeNull();
        expect(
            (linker as { constructor?: { name?: string } }).constructor?.name
        ).toBe('SiliconSynapse');
        const pollSpy = jest.spyOn(linker as SiliconSynapse, 'poll');

        processor.process([], [output]);
        expect(pollSpy).toHaveBeenCalledTimes(1);
    });
});
