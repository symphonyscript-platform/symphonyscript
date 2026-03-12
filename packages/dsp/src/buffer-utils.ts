import type { AudioBuffer } from './types';

function assertPositiveInteger(value: number, name: string): void {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
}

function assertBufferShape(buf: AudioBuffer, name: string): void {
    assertPositiveInteger(buf.channelCount, `${name}.channelCount`);
    assertPositiveInteger(buf.blockSize, `${name}.blockSize`);
    if (buf.data.length !== buf.channelCount * buf.blockSize) {
        throw new Error(`${name}.data length does not match channelCount * blockSize`);
    }
}

function assertCompatibleBuffers(dst: AudioBuffer, src: AudioBuffer): void {
    assertBufferShape(dst, 'dst');
    assertBufferShape(src, 'src');
    if (dst.channelCount !== src.channelCount) {
        throw new Error('channelCount mismatch between dst and src');
    }
    if (dst.blockSize !== src.blockSize) {
        throw new Error('blockSize mismatch between dst and src');
    }
}

export function createAudioBuffer(channelCount: number, blockSize: number): AudioBuffer {
    assertPositiveInteger(channelCount, 'channelCount');
    assertPositiveInteger(blockSize, 'blockSize');
    return {
        channelCount,
        blockSize,
        data: new Float32Array(channelCount * blockSize),
    };
}

export function clearBuffer(buf: AudioBuffer): void {
    assertBufferShape(buf, 'buf');
    const data = buf.data;
    const total = data.length;
    for (let i = 0; i < total; i += 1) {
        data[i] = 0;
    }
}

export function channelData(buf: AudioBuffer, ch: number): Float32Array {
    assertBufferShape(buf, 'buf');
    if (!Number.isInteger(ch) || ch < 0 || ch >= buf.channelCount) {
        throw new Error('channel index out of range');
    }
    const start = ch * buf.blockSize;
    return buf.data.subarray(start, start + buf.blockSize);
}

export function mixBufferInto(dst: AudioBuffer, src: AudioBuffer, gain = 1): void {
    assertCompatibleBuffers(dst, src);
    if (!Number.isFinite(gain)) {
        throw new Error('gain must be a finite number');
    }

    const dstData = dst.data;
    const srcData = src.data;
    const total = dstData.length;
    for (let i = 0; i < total; i += 1) {
        dstData[i] += srcData[i] * gain;
    }
}

export function copyBuffer(dst: AudioBuffer, src: AudioBuffer): void {
    assertCompatibleBuffers(dst, src);
    const dstData = dst.data;
    const srcData = src.data;
    const total = dstData.length;
    for (let i = 0; i < total; i += 1) {
        dstData[i] = srcData[i];
    }
}
