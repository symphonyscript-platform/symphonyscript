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

        const bridge = createSiliconBridge({ nodeCapacity: 2048 });
        initSession(bridge);

        bridge.setBpm(120);

        Clip.melody('Demo')
            .key('C', ScaleMode.MAJOR)
            .tempo(120)
            .defaultDuration(0.5)
            .voiceLead(['I', 'IV', 'V', 'I'], 1)
            .voiceLead(['I', 'vi', 'IV', 'V'], 1);

        const sab = bridge.getSAB();
        bridge.getLinker().processCommands();

        await ctx.audioWorklet.addModule(workletUrl);

        const node = new AudioWorkletNode(ctx, 'symphonyscript-processor', {
            outputChannelCount: [2],
        });

        controls = attachEnginePort(node.port, {
            sampleRate: ctx.sampleRate,
            blockSize: BLOCK_SIZE,
            sab,
        });

        node.connect(ctx.destination);
        controls.play();
    });

    stopBtn.addEventListener('click', () => {
        controls?.stop();
    });
}

main().catch(console.error);
