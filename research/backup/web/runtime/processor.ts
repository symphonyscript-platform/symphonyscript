import { PolyOscillator, StereoBus } from '@symphonyscript/dsp';
import { SiliconSynapse, HDR, NODE, OPCODE } from '@symphonyscript/kernel'; // Need NODE constants for flags/opcode
import { TimeKeeper } from './time-keeper';
import { VoiceManager } from './voice-manager';

export class SiliconProcessor extends AudioWorkletProcessor {
    private oscillator: PolyOscillator;
    private voiceManager: VoiceManager;
    private timeKeeper: TimeKeeper;
    private linker: SiliconSynapse | null = null;

    // Audio Graph
    private mainBus: StereoBus;
    private voiceBuffer: Float32Array; // Temp buffer for oscillator output

    // Playback State
    private currentTick: number = 0;
    private processStartTick: number = 0;
    private processEndTick: number = 0;

    private isPlaying: boolean = false;

    constructor() {
        super();
        // Standard sample rate usually 44100 or 48000, available globally in AudioWorkletScope (sampleRate)
        this.oscillator = new PolyOscillator(sampleRate);
        this.voiceManager = new VoiceManager(this.oscillator);
        this.timeKeeper = new TimeKeeper(sampleRate);

        // DSP Graph
        this.mainBus = new StereoBus(128);
        this.voiceBuffer = new Float32Array(128);

        // Hoist traversal callback to prevent allocation in hot loop
        this.traverseCallback = this.traverseCallback.bind(this);

        this.port.onmessage = (event) => {
            const msg = event.data;
            switch (msg.type) {
                case 'INIT':
                    if (msg.sab) {
                        try {
                            this.linker = new SiliconSynapse(msg.sab);
                            this.linker.setAudioContext(true);
                            console.log('[SiliconProcessor] Kernel Linked');
                        } catch (e) {
                            console.error('[SiliconProcessor] Failed to link Kernel', e);
                        }
                    }
                    break;
                case 'PLAY':
                    this.isPlaying = true;
                    break;
                case 'PAUSE':
                    this.isPlaying = false;
                    this.voiceManager.allNotesOff();
                    break;
                case 'STOP':
                    this.isPlaying = false;
                    this.currentTick = 0;
                    this.voiceManager.allNotesOff();
                    if (this.linker) this.linker.setPlayheadTick(0);
                    break;
                case 'SET_BUS_VOLUME':
                    // TODO: Message handling for volume
                    break;
            }
        };
    }

    // Zero-allocation callback for graph traversal
    private traverseCallback(
        ptr: number,
        opcode: number,
        pitch: number,
        velocity: number,
        duration: number,
        baseTick: number,
        flags: number,
        sourceId: number,
        seq: number
    ): void {
        // Only process NOTES for now
        if (opcode !== OPCODE.NOTE) return;

        // Check for Note On
        if (baseTick >= this.processStartTick && baseTick < this.processEndTick) {
            // Calculate sample offset
            const offset = this.timeKeeper.getSampleOffset(baseTick, this.processStartTick);
            // Ensure offset is within bounds (0..127 typically)
            // It should be by definition, but clamp for safety? 
            // PolyOscillator probably assumes positive index.

            this.voiceManager.noteOn(pitch, velocity / 127, Math.floor(offset)); // Velocity 0-127 -> 0.0-1.0
        }

        // Check for Note Off
        const endTick = baseTick + duration;
        if (endTick >= this.processStartTick && endTick < this.processEndTick) {
            this.voiceManager.noteOff(pitch);
        }
    }

    override process(_inputs: Float32Array[][], outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
        // 0. Safety Check
        const outputChannelL = outputs[0]?.[0];
        const outputChannelR = outputs[0]?.[1];
        if (!this.linker || !outputChannelL) return true;

        // 1. Active Driver Loop (Poll Kernel)
        this.linker.poll();

        // 2. Sync BPM
        // TODO: Optimize to not load every block if costly? atomic load is fast.
        const bpm = this.linker.getBpm();
        if (bpm > 0) this.timeKeeper.updateBpm(bpm);

        // 3. Playback Logic
        if (!this.isPlaying) {
            // Silence
            outputChannelL.fill(0);
            if (outputChannelR) outputChannelR.fill(0);
            return true;
        }

        // 4. Calculate Ticks for this Block
        const bufferSize = outputChannelL.length;

        // Resize DSP buffers if needed (dynamic block size support)
        if (bufferSize !== this.voiceBuffer.length) {
            this.voiceBuffer = new Float32Array(bufferSize);
            this.mainBus.resize(bufferSize);
        }

        const ticksInBlock = this.timeKeeper.getTicksForSamples(bufferSize);

        this.processStartTick = this.currentTick;
        this.processEndTick = this.currentTick + ticksInBlock;

        // 5. Traverse the Graph (Zero-Alloc)
        // This fires noteOn/Off events into the VoiceManager
        this.linker.traverse(this.traverseCallback);

        // Advance time
        this.currentTick += ticksInBlock;
        this.linker.setPlayheadTick(this.currentTick);

        // 6. Render DSP

        // A. Render Voices to Temp Buffer
        this.voiceBuffer.fill(0);
        this.oscillator.process(this.voiceBuffer);

        // B. Clear Bus
        this.mainBus.clear();

        // C. Mix Voices to Bus (Unity Gain, Center Pan for now)
        this.mainBus.input(this.voiceBuffer, 0.0, 1.0);

        // D. Process Bus to Output
        // If output is mono, we might lose Right channel content? 
        // AudioWorklet outputs are usually stereo if configured so.
        // We handle mono output gracefully by passing a dummy buffer if R is missing?
        // Or just let process handle it if we pass undefined? No, types say Float32Array.

        const dummyR = outputChannelR || new Float32Array(bufferSize);
        this.mainBus.process(outputChannelL, dummyR);

        return true;
    }
}

registerProcessor('silicon-processor', SiliconProcessor);
