Cues should return object descriptors ("Virtual DOM"), instead of deferred callbacks.
Then diffing algorithm would catch differences and only apply those mutations to kernel.

add SOLO, BYPASS, LEGATO_TIE, GHOST_NOTE to EXPRESSION

add note-level humanization, swing and groove

1. Timing offset — the deeper case for it:

Here's where per-note timing_offset becomes truly powerful and NOT redundant with DSL-level humanization:

The DSL sets each note's individual swing personality at composition time. Note A is pushed 20 ticks late (swung), Note
B is 10 ticks early (rushed). These are frozen values.

Now add a global modulatable parameter SWING_DEPTH (0-1000) in the ParameterTable. The audio thread computes:

actual_tick = BASE_TICK + (timing_offset * SWING_DEPTH / 1000)
At SWING_DEPTH = 0: all notes snap perfectly to the grid — quantized. At SWING_DEPTH = 1000: full programmed groove. At
SWING_DEPTH = 500: half swing, tighter feel.

Now attach an LFO to SWING_DEPTH. The beat breathes — naturally tightening during a verse, loosening during a chorus. No
global humanization randomness can replicate this because each note has its own authored personality that scales
proportionally.

Without per-note timing_offset, you can only modulate a global random jitter amount. With it, you modulate the depth of
authored groove in real-time. That's a fundamentally different and superior capability.

Verdict: Keep timing_offset in the attribute plane.

2. Probabilistic modulation — the full picture:

Your insight about modulating weights probabilistically is brilliant and cleaner than I initially suggested. Let me
connect the dots:

The GATE ModConfig approach: A ModConfig of type GATE is just another modulator. It reads prng.next(), compares against
its amount parameter (the probability threshold), and outputs either 0 or 1000. This output modulates a synapse weight.
The kernel sees no randomness — it just processes a modulator that happens to output binary values. Clean, sparse, no
new attribute field needed.

BUT — your per-note threshold idea is also valid and complementary:

The GATE ModConfig approach works at the synapse/clip level (entire branches play or don't). Your per-note threshold
attribute works at the individual note level (this specific hi-hat plays 40% of the time).

These are different granularities:

GATE on synapse weight → "Does the entire bassline branch play?"
Per-note threshold → "Does this specific ghost note in the snare pattern play?"
Both are useful. They're not redundant.

Who changes the seed?

The developer controls it:

javascript
// Live show: seed from clock → every loop is unique
kernel.write(REG.PRNG_SEED, Date.now())
// Offline export: fixed seed → reproducible
kernel.write(REG.PRNG_SEED, 42)
One important subtlety about reproducibility:

If you use prng.next() sequentially (call it once per note encountered), adding a note at the beginning of the
composition shifts the entire PRNG sequence — every subsequent note gets a different random value. Fragile.

Better approach: hash-based PRNG. Instead of sequential next(), compute:

rust
random_value = hash(seed, node_base_tick, node_slot_index)
Each note gets a deterministic random value based on its identity, not its traversal order. Adding/removing other notes
doesn't affect this note's outcome. Games use this technique extensively for deterministic per-entity randomness.

So the question is: do you want threshold as a per-note attribute? It gives you individual note-level probability, it's
modulatable (an LFO ramping threshold from 0→1000 during a build-up means sparse hits becoming a full roll), and it
costs one i32.

Updated attribute plane if we add threshold:

# Field

0

pitch
1 velocity
2 duration
3 volume
4 channel
5 flags
6 spatial_x
7 spatial_y
8 spatial_z
9 detune
10 tick_offset
11 threshold
12 fields = 48 bytes. No reserved slot. If you want breathing room, go to 16 fields = 64 bytes with 4 reserved slots.
Your call.

here's one thing threshold does that volume and mute fundamentally cannot:

The water-level metaphor.

Imagine a 16-note hi-hat pattern where each note has a different threshold:

Note:      1 2 3 4 5 6 7 8
Threshold: 100 900 200 800 150 850 250 750
Now attach a single modulation parameter called Density to threshold comparison.

Density = 0 → no notes exceed threshold → silence
Density = 200 → only notes with threshold ≤ 200 play → sparse pattern (notes 1, 3, 5)
Density = 500 → half the notes play → medium density
Density = 1000 → all notes play → full pattern
You are controlling rhythmic density with a single knob. As you sweep Density from 0 to 1000, notes progressively "
emerge" in a deterministic, authored order. The composer decides which notes appear first (the most important beats get
low thresholds), and the single parameter sweeps through the ranking.

Why volume and mute can't do this:

Volume modulation: If you modulate volume with a single parameter, ALL notes get the same volume. You can't make note 1
play while note 2 is silent — they're all driven by the same value.
Mute modulation: Same problem. One modulator → one binary state → all connected notes are either muted or unmuted
together.
Threshold creates a per-note ranking that a single continuous parameter sweeps through. Each note has its own "
activation point." This is deterministic, reproducible, and musically powerful — it's exactly how adaptive game
soundtracks control percussion density based on a single "intensity" variable.

So threshold earns its place, but not as a probability mechanism. It's a density gate — a per-note activation level that
a modulated parameter compares against. No randomness. No PRNG. Pure determinism. The modulator provides the "water
level," and each note's threshold is its "altitude."

What I meant was: threshold's primary design justification is the density gate pattern (the water-level metaphor), which
is deterministic and doesn't require any randomness to be useful. That alone earns its place in the attribute plane.

if the musician feeds a PRNG-driven value into the same parameter, threshold instantly becomes a probability gate too. A
note with threshold(700) plays when the PRNG outputs ≥ 700, which happens ~30% of the time. That's 30% probability,
achieved without the kernel knowing anything about randomness.

So threshold serves both use cases with the exact same kernel code:

Density control (deterministic sweep) → authored note ranking
Probability (PRNG-driven parameter) → stochastic note triggering
The kernel is oblivious to the distinction. It just compares two i32 values. The semantics are entirely determined by
what the outside world writes to the parameter.

"The kernel does exactly what it already does for LFO curves: read a value from a pre-computed table, compare against
threshold. No PRNG. No randomness in the kernel. The randomness lives in the data, not the code." I love this.

but - should we have separate field for probabilities or re-use the same threshold? because your water-level metaphor I
really liked - to modulate emergence of notes() using modulation , but what if you want BOTH modulation of threshold AND
probability of note() - could there be such use-case in reality?

You have a 16-note hi-hat pattern. Each note has a threshold for the density gate — as Intensity sweeps up, more hi-hats
emerge (water level). But you ALSO want the hi-hats that passed the density gate to play only 70% of the time — adding
organic stochastic variation on top of the deterministic density control.

Two-layer filtering:

Density gate: Does the note's threshold pass against the Intensity parameter? (deterministic, water level)
Probability gate: Does the note's probability pass against the noise LUT value? (stochastic, organic)
Both must pass for the note to sound. This creates richer generative patterns than either alone.

But — the modulation system can handle this without a second field. The sparse modulation topology allows multiple
modulators on the same attribute. You attach two ModConfigs to threshold:

ModConfig A: sourced from Intensity parameter (smooth sweep)
ModConfig B: sourced from noise LUT (random perturbation)
The combined modulation effectively raises and lowers the threshold both deterministically AND stochastically. The
note's base threshold is the density ranking. The modulators push it around from both sides.

One field, two modulators. No second attribute needed. The sparse modulation system you already designed handles the
composition naturally.

So: threshold stays as a single field. If the musician wants density only — one modulator. Probability only — one noise
LUT modulator. Both — stack two modulators on the same attribute. The kernel sees no difference.

_________

the idea that we can provide some function pre-node(), some filter is good. kernel does not care what filter() is, it
just knows that it must call it.

Now, one approach is that filter() itself can be random function inside - so we hook probabilistic function into the
deterministic kernel - the kernel core stays puore, butt its runtime becomes probabilistic.

Another approach is that the filter() function doesn't not itself contain random logic, it depends on LUT. and some
other entity is responsible to update LUT with whatever it wants, random numbers or whatnot. this way probability is
completely out of the kernel and filter() just reads already written numbers to decide. this seems more refined
approach, but more complex. because we now need another lifecycle hooks: one that runs at the beginning of every clip,
one that runs at the beginning of every loop - etc, but here is very important thing - the kernel does not care about
clips and loops - those are high-level concepts, so how do we define boundaries without polluting kernel? easy: boundary
cues.

then DSL layer chooses where it calls boundary(SOMETHING) (where SOMETHING is some ID). we can be explicit - by defining
boundary(SOMETHING) wherever we want, but we can also define implicit boundaries (withing the DSL layer), for example
Clip.pipe() would implicitly define boundary(CLIP_START) and boundary(CLIP_END). loop() would implicitly define
boundary(LOOP_START) and boundary(LOOP_END).

And that's what developer would later be able to hook into. they would choose to run some probabilistic funciton that
updates LUT indexes at some boundary...

BOUNDARY is just another OPCODE. The kernel already has NOTE, REST, BARRIER, CC, BEND. Adding BOUNDARY is one more enum
variant. It's a node in the linked list like any other. When the playhead encounters it, it fires a registered function.
The kernel doesn't know what "clip start" means — it just hit a BOUNDARY node with ID 0x01 and called whatever was
registered for that ID.

The critical timing detail: For the LUT-based approach to work, the boundary callback MUST run synchronously on the
audio thread — before the kernel continues to the next nodes. If the callback runs asynchronously on the JS main thread,
the kernel has already passed the notes that needed the updated LUT. The callback must be a WASM function, not a JS
callback.

The full flow:

Playhead traversal:
→ BOUNDARY(CLIP_START)     ← kernel calls registered WASM function
← function writes fresh random values to noise LUT
→ note('G4').threshold(700) ← kernel reads LUT, compares against 700
→ note('C5').threshold(300) ← kernel reads LUT, compares against 300
→ BOUNDARY(CLIP_END)        ← kernel calls registered function (cleanup, etc.)
Every time the clip loops, the playhead hits the BOUNDARY again, the function runs again, the LUT gets fresh values, and
the subsequent notes get new probability rolls. Automatically. No setInterval. No host polling. The lifecycle event IS
the graph traversal.

What the kernel needs:

BOUNDARY opcode (one enum variant)
A registry: Map<boundary_id, fn_pointer> — maps boundary IDs to WASM function pointers
When the playhead hits a BOUNDARY node, call registry[boundary_id](context) where context gives write access to the
LUT_POOL
What the kernel does NOT need:

Knowledge of clips, loops, or musical structure
PRNG, randomization, or probability logic
Lifecycle event detection — the events ARE nodes in the graph
The kernel stays pure. Boundaries are data (nodes in the linked list). Randomization is external code (developer's WASM
function). The LUT is the communication channel between them. And the DSL implicitly inserts boundaries at clip/loop
starts so the developer doesn't have to think about it unless they want explicit control.

Yielding on every node in a JS/WASM context has a real cost. Each yield is a WASM→JS→WASM round trip. V8 typically
takes ~100-200ns per crossing. For 200 notes per audio block:

Yield every node: 200 × ~150ns = 30µs of pure overhead — just for 200 no-op process_next() calls where the developer
does nothing.
Yield only on boundaries: 2-4 yields per clip = ~600ns. 50× cheaper.
In native Rust, function call overhead is ~1-5ns, so yielding every node is essentially free. But in WASM/AudioWorklet (
your primary target), 30µs per block is ~1% of your budget wasted on bridge crossings.

The solution: yield only on boundaries by default. If the developer wants per-note control on a specific note, they
insert an explicit boundary(MY_FILTER) before that note in the DSL:

javascript
const clip1 = Clip.pipe(
// implicit boundary(CLIP_START) by Clip.pipe()
note('G4'), // no yield, processed internally
note('C5'), // no yield
boundary(PROBABILITY_GATE), // YIELD — developer handles this
note('E4').threshold(700).mod(NoiseMod), // processed after developer updates LUT
// implicit boundary(CLIP_END)                  // YIELD
)
The developer gets per-note control exactly where they need it, and pays zero overhead everywhere else. The kernel
processes notes at full speed between boundaries, and only yields when it encounters one.

Maximum control where you want it. Zero cost where you don't.

The answer is the same pattern every platform uses to wrap a low-level primitive: a Runtime layer.

The kernel exposes the raw process_next() / yield API. A platform-specific Runtime class wraps it and gives the
developer a simple callback interface:

javascript
// Developer writes this — no knowledge of process_next() needed
const runtime = new SymphonyRuntime(kernel)
runtime.on(CLIP_START, (ctx) => {
fillNoiseLut(ctx.lut, NOISE_SLOT)
})
runtime.on(LOOP_START, (ctx) => {
ctx.writeParam(INTENSITY, midiController.value)
})
// AudioWorklet process() — handled by the runtime
runtime.start()
Under the hood, SymphonyRuntime runs the yield loop:

javascript
// Inside runtime.start() → called from AudioWorklet.process()
process(outputs) {
while (kernel.process_next()) {
const signal = kernel.readSignal()
if (signal !== 0) {
const handler = this.handlers[signal]
if (handler) handler(this.context)
}
}
outputs[0].set(kernel.getAudioBuffer())
}
Two layers, clean separation:

Layer Responsibility Platform-specific?
Kernel SAB traversal, yield on boundary, emit signal ID No
Runtime Yield loop, callback dispatch, developer API Yes
Developer who doesn't care about boundaries: runtime.start() — the loop calls process_next() continuously, ignores
signals. Zero friction.
Developer who wants probability: registers one callback on CLIP_START. The runtime handles everything else.
Advanced developer: accesses the raw process_next() API directly for full control.
The kernel stays pure SAB math. The Runtime is the ergonomic wrapper that makes it feel like a simple event-driven API.
Same pattern as Express over http, Three.js over WebGL, or React over DOM.

Yes. audioWorklet.addModule() is the mechanism. It loads JavaScript modules directly into the AudioWorklet's scope.

javascript
// my-boundary-handlers.js (developer's file)
registerHandler('onClipStart', (ctx) => {
for (let i = 0; i < 256; i++) {
ctx.writeLut(NOISE_SLOT, i, Math.random() * 1000)
}
})
javascript
// main.js — developer's setup code
const runtime = new SymphonyRuntime(kernel)
// Dynamic import INTO the AudioWorklet context
await runtime.loadHandlers('./my-boundary-handlers.js')
// Wire boundary → handler by name
runtime.on(CLIP_START, 'onClipStart')
runtime.start()
Under the hood, runtime.loadHandlers() calls audioContext.audioWorklet.addModule('./my-boundary-handlers.js'). The
module self-registers its functions on a global handler registry inside the worklet scope. The main thread then sends
string references via postMessage to tell the processor which handler name to call for which boundary ID.

The flow:

Developer writes handler functions in a separate file
runtime.loadHandlers() loads that file into the AudioWorklet via addModule()
runtime.on(CLIP_START, 'onClipStart') sends a string mapping via postMessage
The AudioWorklet processor resolves the string to the registered function and calls it when the kernel yields on that
boundary
No function serialization. The code physically lives in the worklet thread. The main thread only passes strings.
Math.random(), Date.now(), and any pure computation work perfectly inside the worklet scope.

The only thing that won't work inside the worklet: DOM access, fetch(), and main-thread APIs. But for LUT filling, param
writing, and mathematical operations — the worklet has everything you need.

NoiseMod is one modulator definition, but the kernel reads a different LUT value for each node it evaluates. The
per-note uniqueness comes from the LUT read index, not from having separate parameters.

When the kernel evaluates NoiseMod for node at slot 42, tick 1920:

read_index = (1920 + 42) % 256 = 170 → lut[170] = 683
When it evaluates the same NoiseMod for node at slot 43, tick 2400:

read_index = (2400 + 43) % 256 = 131 → lut[131] = 294
One NoiseMod. One LUT. Different values per node — because each node is at a different

(tick, slot)
position.

So threshold(700) with NoiseMod means: the noise LUT (filled with uniform 0-1000 values) produces a different number for
each note. If that number is < 700, the note plays. ~70% of LUT entries are < 700, so it plays ~70% of the time. That's
not magic — it's just positioning in a table of pre-distributed values.

javascript
const NoiseMod = Mod.lut(NOISE_LUT_SLOT, { target: 'threshold' })
const clip1 = Clip.pipe(
note('G4'), // always plays (no threshold)
note('C5').threshold(700).mod(NoiseMod), // ~70% chance
note('E4').threshold(300).mod(NoiseMod), // ~30% chance
note('A4').threshold(500).mod(NoiseMod), // ~50% chance
)
One NoiseMod shared across all three notes. Zero additional parameters. The kernel's existing LUT read logic (which
already uses node identity for the read index) provides the per-note differentiation automatically.

No .filter() callback needed. No per-node parameters. No user code on the audio thread. Just one shared LUT modulator
and per-note thresholds.

________

JITTER

so jitter and tick_offset are really the same?

Thought for 13s

They're different musical concepts but the same kernel mechanism.

tick_offset with no modulation = authored groove. The composer set it to +20 ticks. Deterministic. The note always drags
by exactly 20 ticks.
tick_offset modulated by NoiseMod = jitter. The noise LUT adds a random deviation to tick_offset on each clip iteration.
The note drags by a different amount each time.
So jitter is just tick_offset + noise modulation. You don't need a separate field. The architecture we just designed (
noise LUT + boundary refresh + threshold/modulation) handles jitter for free:

javascript
const TimingNoise = Mod.lut(NOISE_LUT_SLOT, { target: 'tick_offset', amount: 50 })
const clip1 = Clip.pipe(
note('G4').mod(TimingNoise), // ±50 ticks of random timing jitter
note('C5').mod(TimingNoise), // different jitter value (different LUT position)
)
Per-synapse jitter in the SYNAPSE.WEIGHT_DATA is a separate concept — it jitters when a clip starts, not individual
notes within the clip. That could also be expressed as tick_offset + noise modulation on the first node of the target
clip, which would make synapse-level jitter redundant too.

So: one field (tick_offset), multiple behaviors depending on what modulates it. Jitter as a separate concept disappears
from the kernel.

in that case should we have tick_offset not only on node-s, but also connections? clip1.pipe(
use(clip2).tickOffset(20, TimingNoise)
)

?

Thought for 20s

Yes. Per-synapse tick_offset replaces the packed jitter bits currently in SYNAPSE.WEIGHT_DATA. Same concept, cleaner
implementation.

Two levels of tick_offset, both modulatable:

Node level: Individual note timing within a clip
Connection level: When the triggered clip starts relative to the trigger point
javascript
const clip1 = Clip.pipe(
note('G4').tickOffset(10).mod(TimingNoise), // per-note groove
use(clip2).tickOffset(20, TimingNoise), // per-connection jitter
)
This does raise one architectural question though: synapse weight and tick_offset are both modulatable values that need
instant atomic writes. But the synapse struct currently lives in the structural plane (triple-buffered). If you want
instant modulation of synapse weight and tick_offset without a

publish()
cycle, those fields need to be in an attribute plane — similar to how we moved node attributes out of the structural
plane.

So you might need a SynapseAttributePlane alongside the NodeAttributePlane. Each synapse slot gets its own flat, atomic
attribute array: [weight, tick_offset, _reserved, ...].

fn noise(seed: u32, tick: u32, slot: u32) -> u32 {
let mut h = seed ^ tick.wrapping_mul(0x9E3779B9) ^ slot.wrapping_mul(0x517CC1B7);
h ^= h >> 16;
h = h.wrapping_mul(0x85EBCA6B);
h ^= h >> 13;
h = h.wrapping_mul(0xC2B2AE35);
h ^= h >> 16;
h % 1000
}

___

4. Quasi-random (low-discrepancy sequences): Van der Corput, Halton sequences. Pure function per index, no seed needed.
   Mathematically guaranteed to cover the value space more evenly than random. vanDerCorput(slot_index) produces 0.5,
   0.25, 0.75, 0.125, 0.625... — perfectly distributed.
___

Scores



Thought for 38s















You're right — those creative possibilities are real and worth exploring. Let me map each one to the existing architecture to see what's already solved and where the genuine gap is:

Already solved by synapses (no channel needed)
1. Single note → multiple instruments simultaneously:

typescript
// One clip, two synapses. All-fire model. Both play.
parent.linkTo(clip, Piano)
parent.linkTo(clip, Guitar)
// Weight modulation controls the mix — this is the crossfade pattern.
2. Modulated routing (even/odd turns):

typescript
parent.linkTo(clip, Piano).mod(LoopCounter).base(500).amount(-1000)  // fires on even
parent.linkTo(clip, Guitar).mod(LoopCounter).base(500).amount(1000)  // fires on odd
These work because synapse weight is already modulatable. The creative routing falls out of existing architecture.

The genuine gap: per-NOTE routing within a single clip
The cases above route the entire clip — all notes go to Piano or all go to Guitar (or both). But what about:

"Note C4 goes to Piano, note G4 goes to Guitar, within the same clip"

Gate modulators are evaluated per-node, but the result applies to ALL outgoing synapses equally. There's no way to say "this note fires through synapse A but not synapse B." That IS a gap.

Three ways to solve it
A. Channel in attribute plane (coupling)

Kernel routes notes by channel. Maximum flexibility, minimum verbosity.
But: clip knows about instruments, reusability drops, semantic conflict with synapses, kernel gets routing logic.
B. Separate clips (pure separation)

One clip per instrument. Clean, but verbose for the ping-pong case.
C. DSL sugar that decomposes to B (best of both)

typescript
Score.pipe(
note('G4').to(Piano),
note('C4').to(Guitar),
note('E4').to(Piano, Guitar),              // fan-out: both play
note('A4').to(PARAM.InstrumentSelector),   // modulated!
)
The compiler splits this into separate clips at composition time:

Clip_Piano: [G4, E4, A4(gated)]
Clip_Guitar: [C4, E4, A4(gated)]
Synapse routing created automatically
.to(PARAM.X) becomes opposing GATE modulators on two synapses
Kernel sees nothing special. No channel field, no routing logic. Just clips + synapses + gates (which already exist).

Where this gets interesting
The Score sugar could compose with existing modulation:

typescript
Score.pipe(
note('G4').to(Piano).probability(70),        // per-note gating + routing
note('C4').to(Guitar).humanize(30),           // per-note humanization + routing
note('E4').to(lut([Piano, Guitar]).rotate()),  // round-robin instrument!
)
The creative ping-pong, modulated routing, multi-instrument cases all become DSL-level transforms over the clean kernel primitives. You get the playfulness without the coupling.

The principle: instrument routing = graph topology. Creative routing patterns = creative graph topology. The DSL makes the topology easy to express. The kernel doesn't need to know about instruments at all.

So: remove channel from attribute plane, and when the time comes, design Score as a composition-time DSL that expands to clips + synapses. The RFC doesn't need to spec Score now — it just needs to NOT have channel polluting the kernel.

_______



Thought for 19s












How much to shorten: There's no universal rule. It's tempo-dependent and style-dependent:

Normal articulation: ~90% of written duration (small gap)
Staccato: ~50%
Legato/tenuto: 100% (no gap)
At 120 BPM, a quarter note is 500ms. Normal articulation might shorten to 450ms (50ms gap). At 60 BPM that same quarter note is 1000ms — 50ms gap sounds different than at 120. So it could be tempo-aware.

Does it only apply to keyboards? No — it applies to any instrument where notes are discrete events. But the DEFAULT differs by instrument:

Piano: percussive, notes naturally decay. Default ~90% duration makes sense.
Strings (violin): continuous bow, legato by default. Default 100% (or even slight overlap).
Winds: breath-based, similar to strings. Default ~100%.
Drums: hits, no meaningful "duration" for most drums.
This is a builder-level default, not a kernel concern. A string builder would default to 100% duration ("legato by default"), a piano builder to 90%.

How does a clip express violin-style continuous melody?

Durations that touch or overlap:

typescript
// Contiguous: each note starts exactly when the previous ends
note('A4', 4)   // ticks 0-4
note('B4', 4)   // ticks 4-8
note('C5', 2)   // ticks 8-10
The kernel fires noteOn(B4) at the same tick as noteOff(A4). No gap = continuous. For true legato (slight overlap):

typescript
note('A4', 5)   // ticks 0-5
note('B4', 4)   // ticks 4-8  ← overlaps by 1 tick
The DSP layer handles the transition: a monophonic string patch receives noteOn(B4) while A4 is still active → glides to B4 instead of re-attacking. That's the DSP's glide_mode / portamento setting — not a kernel concern.

So the builder controls the default gap, which in turn controls whether the instrument sounds "continuous" or "articulated." Kernel is oblivious — it just sends noteOn/noteOff at the computed ticks.
