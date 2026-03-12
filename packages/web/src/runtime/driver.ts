export const WORKLET_MESSAGE_TYPE = {
    INIT: 'INIT',
    PLAY: 'PLAY',
    PAUSE: 'PAUSE',
    STOP: 'STOP',
} as const;

export type WorkletMessageType =
    (typeof WORKLET_MESSAGE_TYPE)[keyof typeof WORKLET_MESSAGE_TYPE];

export interface WorkletInitMessage {
    readonly type: typeof WORKLET_MESSAGE_TYPE.INIT;
    readonly sampleRate: number;
    readonly blockSize: number;
    readonly sab: SharedArrayBuffer;
}

export interface WorkletPlayMessage {
    readonly type: typeof WORKLET_MESSAGE_TYPE.PLAY;
}

export interface WorkletPauseMessage {
    readonly type: typeof WORKLET_MESSAGE_TYPE.PAUSE;
}

export interface WorkletStopMessage {
    readonly type: typeof WORKLET_MESSAGE_TYPE.STOP;
}

export type WorkletControlMessage =
    | WorkletPlayMessage
    | WorkletPauseMessage
    | WorkletStopMessage;

export type WorkletOutboundMessage = WorkletInitMessage | WorkletControlMessage;

export interface AttachEnginePortOptions {
    readonly sampleRate: number;
    readonly blockSize: number;
    readonly sab: SharedArrayBuffer;
}

export interface EnginePortControls {
    play(): void;
    pause(): void;
    stop(): void;
}

export interface PortLike {
    postMessage(message: WorkletOutboundMessage): void;
}

export function attachEnginePort(
    port: PortLike,
    options: AttachEnginePortOptions
): EnginePortControls {
    port.postMessage({
        type: WORKLET_MESSAGE_TYPE.INIT,
        sampleRate: options.sampleRate,
        blockSize: options.blockSize,
        sab: options.sab,
    });

    return {
        play(): void {
            port.postMessage({ type: WORKLET_MESSAGE_TYPE.PLAY });
        },
        pause(): void {
            port.postMessage({ type: WORKLET_MESSAGE_TYPE.PAUSE });
        },
        stop(): void {
            port.postMessage({ type: WORKLET_MESSAGE_TYPE.STOP });
        },
    };
}
