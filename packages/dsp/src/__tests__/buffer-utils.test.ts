import {
    channelData,
    clearBuffer,
    copyBuffer,
    createAudioBuffer,
    mixBufferInto,
} from '../buffer-utils';
import type { AudioBuffer } from '../types';

describe('buffer utilities', () => {
    test('createAudioBuffer sets metadata and planar backing length', () => {
        const buf = createAudioBuffer(2, 64);
        expect(buf.channelCount).toBe(2);
        expect(buf.blockSize).toBe(64);
        expect(buf.data.length).toBe(128);
        expect(buf.data.every((sample) => sample === 0)).toBe(true);
    });

    test('clearBuffer zeroes all channels', () => {
        const buf = createAudioBuffer(2, 4);
        buf.data.set([1, 2, 3, 4, 5, 6, 7, 8]);

        clearBuffer(buf);

        expect(Array.from(buf.data)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    });

    test('channelData returns per-channel planar slices', () => {
        const buf = createAudioBuffer(2, 4);
        buf.data.set([1, 2, 3, 4, 10, 20, 30, 40]);

        const ch0 = channelData(buf, 0);
        const ch1 = channelData(buf, 1);

        expect(Array.from(ch0)).toEqual([1, 2, 3, 4]);
        expect(Array.from(ch1)).toEqual([10, 20, 30, 40]);

        ch0[2] = 99;
        expect(buf.data[2]).toBe(99);
    });

    test('mixBufferInto supports unity and scaled gain', () => {
        const dst = createAudioBuffer(2, 2);
        const src = createAudioBuffer(2, 2);
        dst.data.set([1, 1, 1, 1]);
        src.data.set([2, 4, 6, 8]);

        mixBufferInto(dst, src);
        expect(Array.from(dst.data)).toEqual([3, 5, 7, 9]);

        mixBufferInto(dst, src, 0.5);
        expect(Array.from(dst.data)).toEqual([4, 7, 10, 13]);
    });

    test('copyBuffer copies exact source data', () => {
        const dst = createAudioBuffer(1, 5);
        const src = createAudioBuffer(1, 5);
        src.data.set([0.25, -0.5, 0.75, -1, 1]);

        copyBuffer(dst, src);

        expect(Array.from(dst.data)).toEqual(Array.from(src.data));
    });

    test('mismatched shape/channel throws', () => {
        const dst = createAudioBuffer(2, 4);
        const srcChannelMismatch = createAudioBuffer(1, 4);
        const srcBlockMismatch = createAudioBuffer(2, 8);
        const badShape: AudioBuffer = {
            channelCount: 2,
            blockSize: 4,
            data: new Float32Array(7),
        };

        expect(() => mixBufferInto(dst, srcChannelMismatch)).toThrow();
        expect(() => copyBuffer(dst, srcBlockMismatch)).toThrow();
        expect(() => clearBuffer(badShape)).toThrow();
        expect(() => channelData(dst, 2)).toThrow();
    });
});
