import {
    attachEnginePort,
    WORKLET_MESSAGE_TYPE,
    type PortLike,
} from '../runtime/driver';

describe('driver', () => {
    test('attachEnginePort sends init message', () => {
        const postMessage = jest.fn();
        const port: PortLike = { postMessage };
        const sab = new SharedArrayBuffer(256);

        attachEnginePort(port, { sampleRate: 48000, blockSize: 128, sab });

        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage).toHaveBeenCalledWith({
            type: WORKLET_MESSAGE_TYPE.INIT,
            sampleRate: 48000,
            blockSize: 128,
            sab,
        });
    });

    test('control methods post messages to the port', () => {
        const postMessage = jest.fn();
        const port: PortLike = { postMessage };
        const controls = attachEnginePort(port, {
            sampleRate: 44100,
            blockSize: 64,
            sab: new SharedArrayBuffer(256),
        });

        postMessage.mockClear();

        controls.play();
        controls.pause();
        controls.stop();

        expect(postMessage).toHaveBeenCalledTimes(3);
        expect(postMessage).toHaveBeenNthCalledWith(1, {
            type: WORKLET_MESSAGE_TYPE.PLAY,
        });
        expect(postMessage).toHaveBeenNthCalledWith(2, {
            type: WORKLET_MESSAGE_TYPE.PAUSE,
        });
        expect(postMessage).toHaveBeenNthCalledWith(3, {
            type: WORKLET_MESSAGE_TYPE.STOP,
        });
        expect('noteOn' in controls).toBe(false);
        expect('noteOff' in controls).toBe(false);
        expect('cc' in controls).toBe(false);
    });
});
