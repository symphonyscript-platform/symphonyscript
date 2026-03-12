import type { AudioBuffer, Engine } from '@symphonyscript/dsp';
import {
    FLAG,
    NODE,
    NULL_PTR,
    OPCODE,
    SiliconSynapse,
} from '@symphonyscript/kernel';
import {
    WORKLET_MESSAGE_TYPE,
    type WorkletControlMessage,
    type WorkletInitMessage,
} from './driver';

type WorkletInboundMessage = WorkletInitMessage | WorkletControlMessage;

type EngineFactory = (sampleRate: number, blockSize: number) => Engine;
type KernelLinker = {
    poll(): number;
    getHead(): number;
    readNodeRaw(ptr: number, buf: Int32Array): boolean;
    getBpm(): number;
    getPpq(): number;
    getPlayheadTick(): number;
    setPlayheadTick(tick: number): void;
};
type LinkerFactory = (sab: SharedArrayBuffer) => KernelLinker | null;
const MIDI_MAX_VALUE = 127;
const SECONDS_PER_MINUTE = 60;
const OPCODE_SHIFT = 24;
const PITCH_SHIFT = 16;
const VELOCITY_SHIFT = 8;
const BYTE_MASK = 0xff;

declare abstract class AudioWorkletProcessor {
    public readonly port: MessagePort;
    public constructor(options?: unknown);
}
declare function registerProcessor(
    name: string,
    processorCtor: new (options?: unknown) => AudioWorkletProcessor
): void;

interface GlobalWithEngineFactory {
    __SYMPHONYSCRIPT_ENGINE_FACTORY__?: EngineFactory;
    __SYMPHONYSCRIPT_LINKER_FACTORY__?: LinkerFactory;
}

class SymphonyScriptProcessor extends AudioWorkletProcessor {
    private engine: Engine | null = null;
    private linker: KernelLinker | null = null;
    private isInitialized = false;
    private isPlaying = false;
    private hostSampleRate = 0;
    private readonly nodeBuf = new Int32Array(8);

    public constructor(options?: unknown) {
        super(options);

        this.port.onmessage = (event: MessageEvent<WorkletInboundMessage>) => {
            this.handleMessage(event.data);
        };
    }

    public process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        const output = outputs[0];
        if (output === undefined) {
            return true;
        }

        this.clearOutput(output);
        if (!this.isInitialized) {
            return true;
        }

        const linker = this.linker;
        if (linker !== null) {
            linker.poll();
        }

        const engine = this.engine;
        if (!this.isPlaying || engine === null || linker === null) {
            return true;
        }

        const frameCount =
            output.length === 0 || output[0] === undefined ? 0 : output[0].length;
        const startTick = linker.getPlayheadTick();
        const bpm = linker.getBpm();
        const ppq = linker.getPpq();
        const sampleRate = this.hostSampleRate;
        let samplesPerTick = 0;
        if (bpm > 0 && ppq > 0 && sampleRate > 0) {
            samplesPerTick = (sampleRate * SECONDS_PER_MINUTE) / (bpm * ppq);
        }
        const ticksInBlock = samplesPerTick > 0 ? frameCount / samplesPerTick : 0;
        const endTick = startTick + ticksInBlock;

        let ptr = linker.getHead();
        while (ptr !== NULL_PTR) {
            const ok = linker.readNodeRaw(ptr, this.nodeBuf);
            const nextPtr = this.nodeBuf[NODE.NEXT_PTR];
            if (ok) {
                this.routeNodeEvents(engine, startTick, endTick, frameCount, samplesPerTick);
            }
            ptr = nextPtr;
        }

        const rendered = engine.render();
        this.copyRenderedBuffer(rendered, output);
        linker.setPlayheadTick(endTick);

        return true;
    }

    private handleMessage(message: WorkletInboundMessage): void {
        switch (message.type) {
            case WORKLET_MESSAGE_TYPE.INIT: {
                const scope = globalThis as typeof globalThis & GlobalWithEngineFactory;
                const engineFactory = scope.__SYMPHONYSCRIPT_ENGINE_FACTORY__;
                const linkerFactory = scope.__SYMPHONYSCRIPT_LINKER_FACTORY__;
                this.linker =
                    typeof linkerFactory === 'function'
                        ? linkerFactory(message.sab)
                        : (new SiliconSynapse(message.sab) as unknown as KernelLinker);
                if (typeof engineFactory === 'function') {
                    this.engine = engineFactory(message.sampleRate, message.blockSize);
                } else {
                    this.engine = null;
                }
                this.hostSampleRate = message.sampleRate;
                this.isInitialized = this.linker !== null;
                break;
            }
            case WORKLET_MESSAGE_TYPE.PLAY:
                this.isPlaying = true;
                break;
            case WORKLET_MESSAGE_TYPE.PAUSE:
                this.isPlaying = false;
                break;
            case WORKLET_MESSAGE_TYPE.STOP:
                this.isPlaying = false;
                if (this.engine !== null) {
                    this.engine.reset();
                }
                break;
            default:
                break;
        }
    }

    private routeNodeEvents(
        engine: Engine,
        startTick: number,
        endTick: number,
        frameCount: number,
        samplesPerTick: number
    ): void {
        const packed = this.nodeBuf[NODE.PACKED_A];
        const opcode = (packed >>> OPCODE_SHIFT) & BYTE_MASK;
        const flags = packed & BYTE_MASK;
        if ((flags & FLAG.MUTED) !== 0) {
            return;
        }

        const channelId =
            (flags & FLAG.EXPRESSION_MASK) >>> FLAG.EXPRESSION_SHIFT;
        const baseTick = this.nodeBuf[NODE.BASE_TICK];
        const duration = this.nodeBuf[NODE.DURATION];

        if (opcode === OPCODE.NOTE) {
            if (baseTick >= startTick && baseTick < endTick) {
                const velocity = this.normalizeMidi(
                    (packed >>> VELOCITY_SHIFT) & BYTE_MASK
                );
                const pitch = (packed >>> PITCH_SHIFT) & BYTE_MASK;
                const gateOffset = this.tickToGateOffset(
                    baseTick - startTick,
                    frameCount,
                    samplesPerTick
                );
                engine.noteOn(channelId, pitch, velocity, gateOffset, channelId);
            }

            const noteEndTick = baseTick + duration;
            if (noteEndTick >= startTick && noteEndTick < endTick) {
                const pitch = (packed >>> PITCH_SHIFT) & BYTE_MASK;
                engine.noteOff(channelId, pitch, channelId);
            }
            return;
        }

        if (opcode === OPCODE.CC && baseTick >= startTick && baseTick < endTick) {
            const controller = (packed >>> PITCH_SHIFT) & BYTE_MASK;
            const value = this.normalizeMidi(
                (packed >>> VELOCITY_SHIFT) & BYTE_MASK
            );
            engine.controlChange(channelId, controller, value);
        }
    }

    private normalizeMidi(value: number): number {
        if (value <= 0) {
            return 0;
        }
        if (value >= MIDI_MAX_VALUE) {
            return 1;
        }
        return value / MIDI_MAX_VALUE;
    }

    private tickToGateOffset(
        tickDelta: number,
        frameCount: number,
        samplesPerTick: number
    ): number {
        if (frameCount <= 0 || samplesPerTick <= 0 || tickDelta <= 0) {
            return 0;
        }
        const offset = Math.floor(tickDelta * samplesPerTick);
        if (offset >= frameCount) {
            return frameCount - 1;
        }
        return offset;
    }

    private clearOutput(output: Float32Array[]): void {
        for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
            output[channelIndex].fill(0);
        }
    }

    private copyRenderedBuffer(
        rendered: AudioBuffer,
        output: Float32Array[]
    ): void {
        const frameCount =
            output.length === 0 || output[0] === undefined ? 0 : output[0].length;
        const channelCount = output.length;
        const renderedChannels = rendered.channelCount;
        const renderedFrameCount = rendered.blockSize;
        const data = rendered.data;

        for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
            const sourceChannel =
                channelIndex < renderedChannels ? channelIndex : renderedChannels - 1;
            if (sourceChannel < 0) {
                continue;
            }
            const sourceOffset = sourceChannel * renderedFrameCount;
            const destination = output[channelIndex];
            const copyCount =
                frameCount < renderedFrameCount ? frameCount : renderedFrameCount;
            for (let sampleIndex = 0; sampleIndex < copyCount; sampleIndex += 1) {
                destination[sampleIndex] = data[sourceOffset + sampleIndex];
            }
        }
    }
}

registerProcessor('symphonyscript-processor', SymphonyScriptProcessor);
