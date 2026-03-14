
Here’s the RFC-061 completeness assessment:

---

## **Phase 1: Foundation** — ✅ Complete

| # | Item | Status |
|---|------|--------|
| 1 | Define interfaces (`@symphonyscript/dsp`) | Done — `types.ts`, `constants.ts` |
| 2 | AudioBuffer utilities | Done — create, clear, mix, channelData, copyBuffer, mixBufferInto |
| 3 | Graph compiler | Done — validate, topological sort, buffer allocation, plan emit |
| 4 | Plan executor | Done |
| 5 | Oscillator module | Done — sine, saw, square, triangle (non–band-limited) |
| 6 | Envelope module | Done — ADSR |
| 7 | Amplifier module | Done |
| 8 | Voice + Instrument (StealPolicy.OLDEST) | Done |
| 9 | Mixer | Done — stereo + 5.1/7.1 |
| 10 | Engine | Done |
| 11 | Web adapter wired | Done — kernel-driven traversal, control-only `postMessage` |
| 12 | **Milestone**: sine melody from kernel through full pipeline | Done |

---

## **Phase 2: Subtractive Complete** — ⚠️ Partial

| # | Item | Status |
|---|------|--------|
| 1 | Filter module | Done — state-variable (LP/HP/BP) |
| 2 | LFO module | Done |
| 3 | Panner module | Not done — mixer has pan logic only |
| 4 | NoiseGenerator | Not done |
| 5 | Split / Merge utility modules | Not done — only in `ModuleType` |
| 6 | Channel adapters (up/down-mix) | Not done — graph compiler has TODO, mono-only |
| 7 | SendBus | Done |
| 8 | `createSubtractiveSynth()` | Done, but **no Filter in graph** — OSC → AMP only |
| 9 | **Milestone**: full subtractive synth | **Not reached** — no filter envelope, no LFO modulation, no filter in graph |

RFC §13.1 default subtractive graph:

```
Oscillator → Filter → Amplifier
                ↑           ↑
        Envelope (Flt)   Envelope (Amp)
```

Current graph:

```
Oscillator → Amplifier
                 ↑
            Envelope (Amp)
```

---

## **Phase 3: FM + Effects** — ⚠️ Partial

| # | Item | Status |
|---|------|--------|
| 1 | FMOperator module | Implemented via Oscillator with FM input instead of dedicated FMOperator |
| 2 | `createFMSynth()` | Done |
| 3 | Delay effect | Not done |
| 4 | Reverb effect | Not done |
| 5 | Chorus effect | Not done |
| 6 | Distortion effect | Not done |
| 7 | **Milestone**: FM + send-bus effects | FM done; effects not |

---

## **Phase 4: Modulation + Polish** — ❌ Not Started

- ModulationBus
- Synapsis parameter integration (RFC-050)
- Preset library

---

## **Other gaps**

| Item | RFC | Implementation |
|------|-----|----------------|
| Buffer arena offset | §5.7: byte offset | Float-sample units (`offset = bufferIndex * blockSize`) |
| PlanStep parameterOffsets | §4.4, §5.7 | Not in current PlanStep |
| Module channel metadata | §6.2 | TODO in graph compiler; mono-only |
| Buffer reuse / arena recycling | §6.2 step 4 | TODO; one buffer per module |
| StealPolicy.QUIETEST/LOWEST/HIGHEST | §5.9 | Only OLDEST implemented in `selectVoiceToSteal` |

---

## **Summary**

- Phase 1: complete; kernel → engine → WebAudio pipeline works.
- Phase 2: filter and LFO exist, but subtractive graph omits filter and has no filter envelope or LFO modulation.
- Phase 3: FM synth done; effect modules (Delay, Reverb, Chorus, Distortion) missing.
- Phase 4: not started.

**Practical next steps**

1. Add filter (and filter envelope) to the subtractive graph.
2. Optionally wire LFO to filter cutoff.
3. Add channel adapters and multi-channel support in the graph compiler.
4. Implement effect modules for send buses.
5. 