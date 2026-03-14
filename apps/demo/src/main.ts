/**
 * Demo app - wires Clip composer, kernel, and web processor.
 */
import { initSession, Clip, ScaleMode } from '@symphonyscript/composer';
import { createSiliconBridge } from '@symphonyscript/kernel';
import { attachEnginePort } from '@symphonyscript/web';
import workletUrl from './worklet?url';

const BLOCK_SIZE = 128;

async function main(): Promise<void> {
    const playBtn = document.getElementById('play');
    const stopBtn = document.getElementById('stop');
    if (!playBtn || !stopBtn) return;

    let controls: ReturnType<typeof attachEnginePort> | null = null;

    playBtn.addEventListener('click', async () => {
        if (controls) {
            controls.play();
            return;
        }

        const ctx = new AudioContext();
        await ctx.resume();
        console.log('[Demo] AudioContext ready, sampleRate:', ctx.sampleRate);

        const bridge = createSiliconBridge({ nodeCapacity: 2048 });
        initSession(bridge);
        console.log('[Demo] Bridge created, initSession done');

        bridge.setBpm(120);

        Clip.melody('Demo')
            .key('C', ScaleMode.MAJOR)
            .tempo(120)
            .defaultDuration(0.5)
            .voiceLead(['I', 'IV', 'V', 'I'], 1)
            .voiceLead(['I', 'vi', 'IV', 'V'], 1);
        console.log('[Demo] Clip composed');

        const sab = bridge.getSAB();
        const linker = bridge.getLinker();
        while (linker.processCommands() > 0) {}
        const nodeCount = bridge.getMappingCount();
        const head = linker.getHead();
        const expectedNodes = 8 * 3; // 8 chords × 3 notes each
        console.log('[Demo] processCommands done, nodeCount:', nodeCount, 'expected:', expectedNodes, 'head:', head);

        await ctx.audioWorklet.addModule(workletUrl);
        console.log('[Demo] Worklet loaded');

        const node = new AudioWorkletNode(ctx, 'symphonyscript-processor', {
            outputChannelCount: [2],
        });

        controls = attachEnginePort(node.port, {
            sampleRate: ctx.sampleRate,
            blockSize: BLOCK_SIZE,
            sab,
        });
        console.log('[Demo] INIT sent, sampleRate:', ctx.sampleRate, 'blockSize:', BLOCK_SIZE);

        node.connect(ctx.destination);
        controls.play();
        console.log('[Demo] Node connected, PLAY sent');
    });

    stopBtn.addEventListener('click', () => {
        controls?.stop();
    });
}

main().catch(console.error);
