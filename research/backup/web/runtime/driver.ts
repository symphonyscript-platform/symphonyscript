import processorUrl from './processor?worker&url';
import type { SiliconBridge } from '@symphonyscript/kernel';

export async function createSymphonyWorklet(
    context: AudioContext,
    bridge: SiliconBridge
): Promise<AudioWorkletNode> {
    try {
        await context.audioWorklet.addModule(processorUrl);
        const node = new AudioWorkletNode(context, 'silicon-processor');

        // Active Driver Pattern: Send SharedArrayBuffer availability to Worklet
        node.port.postMessage({
            type: 'INIT',
            sab: bridge.getSAB()
        });

        return node;
    } catch (e) {
        console.error('Failed to load SiliconProcessor', e);
        throw e;
    }
}
