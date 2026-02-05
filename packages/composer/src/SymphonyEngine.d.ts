import { SiliconBridge } from '@symphonyscript/kernel';
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
export declare class SymphonyEngine {
    private context;
    private workletNode;
    private bridge;
    private sab;
    private _workerPort;
    private _playheadCallback;
    private _rafId;
    private _stateCache;
    constructor();
    /**
     * Initialize the audio engine.
     * Must be called after a user gesture (usually).
     */
    init(options: SymphonyEngineOptions): Promise<void>;
    /**
     * Start the Transport.
     */
    play(): Promise<void>;
    /**
     * Pause the Transport.
     */
    pause(): void;
    /**
     * Stop the Transport and Reset.
     */
    stop(): void;
    /**
     * Set BPM.
     */
    setBpm(bpm: number): void;
    /**
     * Subscribe to playhead updates.
     */
    onPlayheadUpdate(cb: (state: PlayheadState) => void): void;
    /**
     * Access the internal Bridge for editing operations.
     */
    getBridge(): SiliconBridge | null;
    private startVisualizer;
    private stopVisualizer;
}
//# sourceMappingURL=SymphonyEngine.d.ts.map