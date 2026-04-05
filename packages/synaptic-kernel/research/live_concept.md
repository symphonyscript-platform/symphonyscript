// live.sym - Live Layer
// this file is hot-reloaded on every save during live-shows. ref's survive their references (i.e. they would point to the exact same clip instances)

// ref gives user ability to reference pre-defined clip and make changes in real-time
c1 = ref('c1').instrument(grand_piano)
c3 = ref('c2').instrument(guitar)
c2 = ref('c3').instrument(drums)

// simple scenario: user changes tempo and presses ctrl+c
c2.tempo(60) // user decided to slow-down drums

// complex scenario:
c2. // here is where I'm struggling

// user defines the order in which clips are played. can re-order anytime. changes will be reflected in the next cycle.
// supported internally by the synaptic kernel's ability to rewire clips in O(1).
loop {
    c1
    c2
    c3
}

//---- alternatively ---- user can even replace clip with inline clip and hit ctrl+s //
loop {
    c1
    c2
    clip {
        tempo 60,
        note F4
        note F5
        note F6
        note F7
    }
}

// clip.sym - DSL layer

use live::{ c1, c2, c3 }

/* alternative - loops sequentially * /
Clip c_sequential {
    loop {
        synapse c1
        synapse c2
        synapse c3
    }
}
/* alternative * /

/* alternative - loops parallelly * /
Clip c_parallel {
    loop {
        synapse c1 | parallel
        synapse c2 | parallel
        synapse c3 | parallel
    }
}
/* alternative * /

Clip c1 {
    live c1
    // below would be the default pattern - played initially
    tempo 120
    note A4
    note A5
    note A6
    note A7
}

Clip c2 {
    live c2
    // kicks below would be the default pattern - played initially
    tempo 120
    kick
    snare
    kick
    snare
}

Clip c3 {
    live c3
    // notes below would be the default pattern - played initially
    tempo 120
    note G4
    note G5
    note G6
    note G7
}
___


loop {          ← cycle boundary (1000)
    c1          ← gets 0..333    (1/3)
    c2          ← gets 333..667  (1/3)
    c3          ← gets 667..1000 (1/3)
}

c3 = kick kick snare snare
↓     ↓      ↓      ↓
667   750    833    917     ← each gets 333/4 = ~83.3


___
loop {
    c1(500)     ← half the cycle
    c2(250)     ← quarter
    c3(250)     ← quarter
}
