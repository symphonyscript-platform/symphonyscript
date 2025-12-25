
import { SiliconBridge, SiliconSynapse, createLinkerSAB } from '@symphonyscript/kernel';

// Type mapping for the AudioWorklet import string
// In a real app we'd use a bundler plugin or URL relative import.
// For now, we assume the host app provides the worklet URL or we bundle it.
// We will accept a workletURL in init().

export interface SymphonyEngineOptions {
    workletUrl: string;
    nodeCapacity?: number;
}

export interface PlayheadState {
    tick: number;
    bpm: number;
    isPlaying: boolean;
}

/**
 * SymphonyEngine - The High-Level Runtime Controller.
 * 
 * Responsibilities:
 * - Initialize AudioContext and AudioWorklet.
 * - Manage SiliconBridge (Shared Memory).
 * - Expose Transport Controls to UI.
 * - Provide Playhead Visualization loop.
 */
export class SymphonyEngine {
    private context: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private bridge: SiliconBridge | null = null;
    private sab: SharedArrayBuffer | null = null;

    private _workerPort: MessagePort | null = null;
    private _playheadCallback: ((state: PlayheadState) => void) | null = null;
    private _rafId: number | null = null;

    // Cache state to avoid object churn
    private _stateCache: PlayheadState = { tick: 0, bpm: 120, isPlaying: false };

    constructor() { }

    /**
     * Initialize the audio engine.
     * Must be called after a user gesture (usually).
     */
    async init(options: SymphonyEngineOptions): Promise<void> {
        if (this.context) return;

        // 1. Create AudioContext
        this.context = new AudioContext({
            latencyHint: 'interactive',
            sampleRate: 44100 // Force standard rate if possible
        });

        // 2. Load AudioWorklet
        try {
            await this.context.audioWorklet.addModule(options.workletUrl);
        } catch (e) {
            console.error('[SymphonyEngine] Failed to load worklet module:', e);
            throw e;
        }

        // 3. Create Shared Memory (Kernel)
        this.sab = createLinkerSAB({ nodeCapacity: options.nodeCapacity ?? 4096 });

        // 4. Initialize Bridge (Main Thread side)
        const linker = new SiliconSynapse(this.sab);
        this.bridge = new SiliconBridge(linker);

        // 5. Create AudioWorklet Node
        this.workletNode = new AudioWorkletNode(this.context, 'silicon-processor', {
            outputChannelCount: [2], // Stereo output
            processorOptions: {
                // We could pass SAB here, but we use postMessage for better reliability across environments
            }
        });

        this._workerPort = this.workletNode.port;
        this._workerPort.onmessage = (e) => {
            // Handle messages from processor
            console.log('[SymphonyEngine] From Processor:', e.data);
        };

        // 6. Send Shared Memory to Processor
        this._workerPort.postMessage({
            type: 'INIT',
            sab: this.sab
        });

        // 7. Connect to Destination
        this.workletNode.connect(this.context.destination);

        console.log('[SymphonyEngine] Initialized');
    }

    /**
     * Start the Transport.
     */
    async play(): Promise<void> {
        if (!this.context) return;
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }

        this._workerPort?.postMessage({ type: 'PLAY' });
        this._stateCache.isPlaying = true;
        this.startVisualizer();
    }

    /**
     * Pause the Transport.
     */
    pause(): void {
        this._workerPort?.postMessage({ type: 'PAUSE' });
        this._stateCache.isPlaying = false;
        // Keep visualizer running to show current static position? Or stop?
        // Usually stop loop to save battery if static.
        this.stopVisualizer();
    }

    /**
     * Stop the Transport and Reset.
     */
    stop(): void {
        this._workerPort?.postMessage({ type: 'STOP' });
        this._stateCache.isPlaying = false;
        this._stateCache.tick = 0;

        // Force one update to reset UI
        if (this._playheadCallback) {
            this._playheadCallback({ ...this._stateCache });
        }
        this.stopVisualizer();
    }

    /**
     * Set BPM.
     */
    setBpm(bpm: number): void {
        if (!this.bridge) return;
        this.bridge.setBpm(bpm);
    }

    /**
     * Subscribe to playhead updates.
     */
    onPlayheadUpdate(cb: (state: PlayheadState) => void): void {
        this._playheadCallback = cb;
    }

    /**
     * Access the internal Bridge for editing operations.
     */
    getBridge(): SiliconBridge | null {
        return this.bridge;
    }

    private startVisualizer(): void {
        if (this._rafId) return;

        const loop = () => {
            if (!this.bridge) return;

            // Read from SAB (Zero-Alloc / Lock-free read)
            const tick = this.bridge.getPlayheadTick();
            const bpm = this.bridge.getBpm();

            this._stateCache.tick = tick;
            this._stateCache.bpm = bpm;

            if (this._playheadCallback) {
                this._playheadCallback(this._stateCache);
            }

            if (this._stateCache.isPlaying) {
                this._rafId = requestAnimationFrame(loop);
            } else {
                this._rafId = null;
            }
        };

        this._rafId = requestAnimationFrame(loop);
    }

    private stopVisualizer(): void {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }
}
