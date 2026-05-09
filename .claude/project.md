SymphonyScript is going to be a code-first music development platform, powered by lock-free and wait-free Kernel,
written in Rust, enabling not only high quality offline export, but near-zero-latency live shows as well.

It aims to provide a language that is readable not only by skilled engineers, but also by musicians, hobbyists, and
professionals in music industry.

SymphonyScript proposes distinct mental model in music production, where music is an end result of composable clips
forming a synaptic graph.

Instead of standard UI-driven sequencer, SymphonyScript proposes
reusable clips as building blocks for music. Synaptic, because each clip can be connected to N other clips and
vice-versa, forming a graph, where the connections themselves carry important data, such as velocity scaling (weight),
tempo scaling, timing offset, etc.

Clip itself, internally, is a reactive container of musical events.
Clip can contain sequence and combination of notes, chords, rests, controls and most importantly - connections to other
clips: either synchronous (connected clip finishes, the original clip continues) or parallel (connected clip plays on
the background WHILE the original clip continues). Each Clip has its own identity, may define its own tempo, musical
events and ultimately represents a digital, and reactive fragment of sheet music. It knows not about who plays it with
what instrument. Clip is reactive, because it is modulated, fully modulated: Continuous pitch, tempo, note velocity,
volume, and many other properties of music are modulated using Curves and Params. Params can be driven by either user OR
by automated system, such as game engine or sensors. Params can be bipolar ([-1.0, 1.0]) or unipolar ([0.0,1.0]). They
may define curve function and smoothing. Modulation is just a reactive expression, such as: C5/4 | vel: 100 +
sine_wobble(Intensity) * 40 where 100 is a base value, 40 is depth, sine_wobble is modulation curve and Intensity is a
parameter. Modulation can absolutely have its own curve, as shown in this simple example, but can also defer to the
curve (or lack thereof) of the parameter. The moment Intensity changes, the clip that contains the modulated property (
either directly or indirectly through note) is updated in real-time. As an ambitious goal, SymphonyScript is also aims
to define a live format, where exported file, supported by Kernel, would contain not a static recording of music, but
the reactive live music, with modulation parameters exposed. It would enable audio players to host such format, and
provide controls for the music.
