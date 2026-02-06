import { SynapticClip } from './SynapticClip';
import { SynapticMelodyNoteCursor } from '../cursors/SynapticMelodyNoteCursor';
import { SynapticChordCursor } from '../cursors/SynapticChordCursor';
import { FrozenClip } from './FrozenClip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { SeededRandom } from '@symphonyscript/core';
import { ClipNode, EuclideanMelodyOptions, ArpeggioOptions, ScaleMode, OperationsSource } from '../types';
import { romanToChord } from '../utils/romanAdapter';
import { euclidean, rotatePattern } from '@symphonyscript/theory';
import { parsePitch } from '../utils/pitch';
import { parseChord } from '../utils/chord';
import { SCALE_INTERVALS } from '../utils/scales';



/**
 * SynapticMelody
 * RFC-049 Section 5.1
 * Refreshed melody builder with cursor architecture.
 */
export class SynapticMelody extends SynapticClip {
    private noteCursor: SynapticMelodyNoteCursor;
    private chordCursor: SynapticChordCursor;
    private currentTick: number = 0;
    private sourceIdCounter: number = 0;

    constructor(bridge: SiliconBridge) {
        super(bridge);
        this.chordCursor = new SynapticChordCursor(this, bridge);
        this.noteCursor = new SynapticMelodyNoteCursor(this, bridge, this.chordCursor);
    }

    // ========================
    // SynapticClip Implementation
    // ========================

    getCurrentTick(): number {
        return this.currentTick;
    }

    advanceTick(duration: number): void {
        this.currentTick += duration;
    }

    generateSourceId(): number {
        return this.sourceIdCounter++;
    }

    // ========================
    // Melody API Entry Points
    // ========================

    note(input: string | number, duration?: number): SynapticMelodyNoteCursor {
        return this.noteCursor.note(input, duration);
    }

    degree(deg: number, duration?: number, options?: import('../types').DegreeOptions): SynapticMelodyNoteCursor {
        return this.noteCursor.degree(deg, duration, options);
    }

    chord(symbol: string): SynapticChordCursor {
        return this.noteCursor.chord(symbol);
    }

    /**
     * Create a chord from scale degrees.
     * Requires scale() to be called first.
     * @param degrees - Array of scale degrees (1-7 for first octave, 8+ wraps to higher octaves)
     * @param duration - Optional chord duration
     * @returns SynapticChordCursor for further configuration
     * @throws Error if scale context is not set
     */
    degreeChord(degrees: number[], duration?: number): SynapticChordCursor {
        const ctx = this.getScaleContext();
        if (!ctx) {
            throw new Error('degreeChord() requires scale() to be called first');
        }

        if (degrees.length === 0) {
            throw new Error('degreeChord() requires at least one degree');
        }

        const intervals = SCALE_INTERVALS[ctx.mode];
        const rootPitch = parsePitch(ctx.root + ctx.octave);

        // Convert degrees to pitches
        const pitches: number[] = [];
        for (const deg of degrees) {
            const octaveShift = Math.floor((deg - 1) / 7);
            const scaleDegree = ((deg - 1) % 7 + 7) % 7; // Handle negative degrees
            const pitch = rootPitch + intervals[scaleDegree] + octaveShift * 12;
            pitches.push(pitch);
        }

        // Find the lowest pitch as the chord root
        const chordRoot = Math.min(...pitches);

        // Calculate intervals relative to the root
        let mask = 0;
        for (const pitch of pitches) {
            const interval = pitch - chordRoot;
            mask |= (1 << interval);
        }

        // Configure the chord cursor (harmony() calls bind() internally)
        const cursor = this.chordCursor.harmony(mask, chordRoot);

        if (duration !== undefined) {
            cursor.duration(duration);
        }

        return cursor;
    }

    /**
     * Create a chord from a roman numeral in the current key context.
     * Requires key() to be set first.
     * @param numeral - Roman numeral (e.g., 'I', 'ii', 'V7', 'bVII')
     * @param duration - Optional chord duration
     * @returns SynapticChordCursor for further configuration
     * @throws Error if key context is not set
     */
    roman(numeral: string, duration?: number): SynapticChordCursor {
        const keyCtx = this.getKeyContext();
        if (!keyCtx) {
            throw new Error('roman() requires key() to be called first');
        }

        const chordSymbol = romanToChord(numeral, keyCtx);
        if (!chordSymbol) {
            throw new Error(`Invalid roman numeral: ${numeral}`);
        }

        const cursor = this.chord(chordSymbol);
        if (duration !== undefined) {
            cursor.duration(duration);
        }
        return cursor;
    }

    /**
     * Emit a sequence of chords from roman numerals.
     * Requires key() to be set first.
     * @param numerals - Array of roman numerals (e.g., ['I', 'IV', 'V', 'I'])
     * @param options - Optional configuration (duration per chord)
     * @returns this for chaining
     * @throws Error if key context is not set
     */
    progression(numerals: string[], options?: { duration?: number }): this {
        const keyCtx = this.getKeyContext();
        if (!keyCtx) {
            throw new Error('progression() requires key() to be called first');
        }

        const duration = options?.duration ?? 1;

        for (const numeral of numerals) {
            const chordSymbol = romanToChord(numeral, keyCtx);
            if (!chordSymbol) {
                throw new Error(`Invalid roman numeral in progression: ${numeral}`);
            }

            this.chord(chordSymbol).duration(duration).commit();
            this.advanceTick(duration);
        }

        return this;
    }

    /**
     * Emit a voice-led chord progression from roman numerals.
     * Minimizes voice movement between successive chords.
     * Requires key() to be set first.
     * @param numerals - Array of roman numerals (e.g., ['I', 'IV', 'V', 'I'])
     * @param options - Optional configuration (duration per chord)
     * @returns this for chaining
     * @throws Error if key context is not set
     */
    voiceLead(numerals: string[], options?: { duration?: number }): this {
        const keyCtx = this.getKeyContext();
        if (!keyCtx) {
            throw new Error('voiceLead() requires key() to be called first');
        }

        if (numerals.length === 0) {
            return this;
        }

        const duration = options?.duration ?? 1;

        // Convert roman numerals to chord symbols and then to pitch arrays
        const chordPitches: number[][] = [];
        for (const numeral of numerals) {
            const chordSymbol = romanToChord(numeral, keyCtx);
            if (!chordSymbol) {
                throw new Error(`Invalid roman numeral in voiceLead: ${numeral}`);
            }
            const pitches = this.chordSymbolToPitches(chordSymbol);
            chordPitches.push(pitches);
        }

        // Voice lead the progression
        let previousVoicing: number[] | null = null;

        for (const basePitches of chordPitches) {
            let voicing: number[];

            if (previousVoicing === null) {
                // First chord: use root position
                voicing = [...basePitches].sort((a, b) => a - b);
            } else {
                // Find best voicing (minimize voice movement)
                voicing = this.findBestVoicing(basePitches, previousVoicing);
            }

            // Emit the chord
            this.emitChordPitches(voicing, duration);
            this.advanceTick(duration);

            previousVoicing = voicing;
        }

        return this;
    }

    /**
     * Convert a chord symbol to an array of MIDI pitches.
     * @internal
     */
    private chordSymbolToPitches(symbol: string): number[] {
        const { root, mask } = parseChord(symbol);
        const pitches: number[] = [];

        let interval = 0;
        let m = mask;
        while (m !== 0) {
            if ((m & 1) === 1) {
                pitches.push(root + interval);
            }
            m >>>= 1;
            interval++;
        }

        return pitches;
    }

    /**
     * Find the voicing of a chord that minimizes total voice movement from previous chord.
     * Tries all inversions and picks the one with smallest sum of absolute pitch differences.
     * @internal
     */
    private findBestVoicing(basePitches: number[], previousVoicing: number[]): number[] {
        const numVoices = basePitches.length;
        const sorted = [...basePitches].sort((a, b) => a - b);

        // Generate all inversions
        const inversions: number[][] = [];
        for (let inv = 0; inv < numVoices; inv++) {
            const voicing: number[] = [];
            for (let i = 0; i < numVoices; i++) {
                const idx = (i + inv) % numVoices;
                let pitch = sorted[idx];
                // If this note is below the first note of the inversion, move it up an octave
                if (i > 0 && pitch <= voicing[i - 1]) {
                    pitch += 12;
                }
                voicing.push(pitch);
            }
            inversions.push(voicing);
        }

        // Also try inversions shifted up/down an octave
        const allVoicings: number[][] = [];
        for (const inv of inversions) {
            allVoicings.push(inv);
            allVoicings.push(inv.map(p => p - 12));
            allVoicings.push(inv.map(p => p + 12));
        }

        // Find voicing with minimum voice movement
        let bestVoicing = allVoicings[0];
        let bestCost = this.voiceMovementCost(previousVoicing, bestVoicing);

        for (let i = 1; i < allVoicings.length; i++) {
            const cost = this.voiceMovementCost(previousVoicing, allVoicings[i]);
            if (cost < bestCost) {
                bestCost = cost;
                bestVoicing = allVoicings[i];
            }
        }

        return bestVoicing;
    }

    /**
     * Calculate the total voice movement cost between two voicings.
     * Uses sum of absolute pitch differences.
     * 
     * INTENTIONAL DIVERGENCE FROM THEORY PACKAGE:
     * - Theory version uses `HarmonyMask` (pitch-class only) for scale degree analysis.
     * - Composer version uses `number[]` (absolute pitch) for octave-aware voice leading.
     * - This distinction is intentional and critical for minimizing physical interval distance.
     * 
     * @internal
     */
    private voiceMovementCost(from: number[], to: number[]): number {
        // If different number of voices, use a simple metric
        const minLen = Math.min(from.length, to.length);
        let cost = 0;

        // Sort both to compare by register
        const fromSorted = [...from].sort((a, b) => a - b);
        const toSorted = [...to].sort((a, b) => a - b);

        for (let i = 0; i < minLen; i++) {
            cost += Math.abs(fromSorted[i] - toSorted[i]);
        }

        // Penalize voice count mismatch
        cost += Math.abs(from.length - to.length) * 12;

        return cost;
    }

    /**
     * Emit a chord from an array of pitches.
     * @internal
     */
    private emitChordPitches(pitches: number[], duration: number): void {
        // Build a mask from the pitches
        const root = Math.min(...pitches);
        let mask = 0;
        for (const pitch of pitches) {
            const interval = pitch - root;
            mask |= (1 << interval);
        }

        // Use the chord cursor to emit
        this.chordCursor.harmony(mask, root).duration(duration).commit();
    }

    /**
     * Execute a builder function multiple times, or loop an OperationsSource.
     * Each iteration adds operations at the current tick position.
     * @param count - Number of repetitions
     * @param source - Builder function or OperationsSource to loop
     */
    loop(count: number, source: ((clip: SynapticMelody) => void) | OperationsSource): this {
        if (typeof source === 'function') {
            // Builder function
            for (let i = 0; i < count; i++) {
                source(this);
            }
        } else {
            // OperationsSource - play it count times
            for (let i = 0; i < count; i++) {
                this.play(source);
            }
        }
        return this;
    }

    /**
     * Insert operations from another clip at current tick position.
     * @param clip - Source clip (SynapticMelody, ClipNode, FrozenClip, or OperationsSource)
     */
    play(clip: SynapticMelody | ClipNode | FrozenClip | OperationsSource): this {
        // Get operations from source
        let operations: ClipNode['operations'];

        if (clip instanceof FrozenClip) {
            operations = clip.clipNode.operations;
        } else if ('toOperations' in clip && typeof clip.toOperations === 'function') {
            // OperationsSource interface
            operations = clip.toOperations();
        } else if ('build' in clip && typeof clip.build === 'function') {
            // ClipBuilder (SynapticMelody, etc.)
            operations = clip.build().operations;
        } else {
            // ClipNode
            operations = (clip as ClipNode).operations;
        }

        // Replay each operation at current tick offset
        const tickOffset = this.getCurrentTick();
        for (const op of operations) {
            if (op.kind === 'note') {
                this.operations.push({
                    ...op,
                    tick: op.tick + tickOffset,
                    sourceId: this.generateSourceId()
                });
            }
        }

        // Advance tick by source clip duration
        const maxTick = operations.reduce(
            (max, op) => op.kind === 'note' ? Math.max(max, op.tick + op.duration) : max,
            0
        );
        this.advanceTick(maxTick);

        return this;
    }

    /**
     * Generate a Euclidean rhythm pattern with melodic notes.
     * @param options - Euclidean rhythm options
     * @returns this for chaining
     */
    euclidean(options: EuclideanMelodyOptions): this {
        const {
            hits,
            steps,
            notes,
            stepDuration,
            velocity = 0.8,
            rotation = 0,
            repeat = 1
        } = options;

        // Generate the Euclidean pattern
        let pattern = euclidean(hits, steps);
        if (!pattern) {
            throw new Error(`Invalid Euclidean parameters: hits=${hits}, steps=${steps}`);
        }

        // Apply rotation if specified
        if (rotation !== 0) {
            pattern = rotatePattern(pattern, rotation);
        }

        // Cycle through notes for each hit
        let noteIndex = 0;

        for (let r = 0; r < repeat; r++) {
            for (const isHit of pattern) {
                if (isHit) {
                    const currentNote = notes[noteIndex % notes.length];
                    this.note(currentNote, stepDuration).velocity(velocity).commit();
                    noteIndex++;
                }
                this.advanceTick(stepDuration);
            }
        }

        return this;
    }

    /**
     * Play an arpeggio pattern over the given pitches.
     * @param pitches - Array of pitches (note names or MIDI numbers)
     * @param rate - Duration for each arpeggiated note
     * @param options - Arpeggio options (pattern, velocity, gate, octaves, seed)
     * @returns this for chaining
     */
    arpeggiate(pitches: (string | number)[], rate: number, options?: ArpeggioOptions): this {
        const {
            pattern = 'up',
            velocity = 0.8,
            gate = 0.8,
            octaves = 1,
            seed
        } = options ?? {};

        // Convert pitches to MIDI numbers
        let midiPitches = pitches.map(p =>
            typeof p === 'string' ? parsePitch(p) : p
        );

        // Expand pitches across octaves
        if (octaves > 1) {
            const expanded: number[] = [];
            for (let oct = 0; oct < octaves; oct++) {
                for (const pitch of midiPitches) {
                    expanded.push(pitch + oct * 12);
                }
            }
            midiPitches = expanded;
        }

        // Apply pattern ordering
        const orderedPitches = this.applyArpPattern(midiPitches, pattern, seed);

        // Calculate actual note duration
        const noteDuration = rate * gate;

        // Play the arpeggio
        for (const pitch of orderedPitches) {
            this.note(pitch, noteDuration).velocity(velocity).commit();
            this.advanceTick(rate);
        }

        return this;
    }

    /**
     * Apply arpeggio pattern ordering to pitches.
     * @internal
     */
    private applyArpPattern(pitches: number[], pattern: string, seed?: number): number[] {
        const sorted = [...pitches].sort((a, b) => a - b);

        switch (pattern) {
            case 'up':
                return sorted;

            case 'down':
                return [...sorted].reverse();

            case 'upDown': {
                // Up then down (excluding duplicate at peak)
                const down = [...sorted].reverse().slice(1);
                return [...sorted, ...down];
            }

            case 'downUp': {
                // Down then up (excluding duplicate at bottom)
                const up = [...sorted].slice(1);
                return [...[...sorted].reverse(), ...up];
            }

            case 'random': {
                const rng = new SeededRandom(seed ?? Date.now());
                const shuffled = [...sorted];
                // Fisher-Yates shuffle
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(rng.next() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
            }

            case 'converge': {
                // Outer → inner: first, last, second, second-last, ...
                const result: number[] = [];
                let left = 0;
                let right = sorted.length - 1;
                while (left <= right) {
                    result.push(sorted[left]);
                    if (left !== right) {
                        result.push(sorted[right]);
                    }
                    left++;
                    right--;
                }
                return result;
            }

            case 'diverge': {
                // Inner → outer: middle outward
                const result: number[] = [];
                const mid = Math.floor(sorted.length / 2);
                let left = mid;
                let right = mid + 1;

                // Add middle element(s)
                if (sorted.length % 2 === 1) {
                    result.push(sorted[mid]);
                    left = mid - 1;
                } else {
                    left = mid - 1;
                    right = mid;
                }

                // Expand outward
                while (left >= 0 || right < sorted.length) {
                    if (right < sorted.length) {
                        result.push(sorted[right]);
                        right++;
                    }
                    if (left >= 0) {
                        result.push(sorted[left]);
                        left--;
                    }
                }
                return result;
            }

            default:
                return sorted;
        }
    }

    /**
     * Execute a builder function within an MPE voice scope.
     * All notes created inside the builder will be tagged with the expressionId.
     * @param id - Voice ID (1-15, MPE channel range)
     * @param builderFn - Builder function that creates notes for this voice
     * @returns this for chaining
     * @throws Error if id is out of range (1-15)
     */
    voice(id: number, builderFn: (v: SynapticMelody) => SynapticMelody | SynapticMelodyNoteCursor | void): this {
        // Validate MPE channel range
        if (id < 1 || id > 15) {
            throw new Error(`Voice ID must be 1-15 (MPE range), got ${id}`);
        }

        // Store current expression ID
        const previousExpressionId = this._expressionId;

        // Set expression ID for this voice scope
        this._expressionId = id;

        // Execute the builder function
        const result = builderFn(this);

        // If result is a cursor, commit it
        if (result && result !== this && 'commit' in result) {
            result.commit();
        }

        // Restore previous expression ID
        this._expressionId = previousExpressionId;

        return this;
    }

    /**
     * Get the current expression ID (for voice scoping).
     */
    getExpressionId(): number | null {
        return this._expressionId;
    }

    /**
     * Set the expression ID directly (for advanced use cases).
     * @param id - Expression ID (1-15) or null to clear
     */
    setExpressionId(id: number | null): this {
        if (id !== null && (id < 1 || id > 15)) {
            throw new Error(`Expression ID must be 1-15, got ${id}`);
        }
        this._expressionId = id;
        return this;
    }

    /**
     * Execute a builder function in parallel (stacked) mode.
     * All operations inside the builder are placed at the SAME starting tick,
     * and the parent tick does NOT advance past the stacked content.
     * 
     * Overloads:
     * - `stack()` - Enable polyphonic stacking mode (inherited from SynapticClip)
     * - `stack(builderFn)` - Execute builder in parallel
     * 
     * @param builderFn - Builder function to execute in parallel
     * @returns this for chaining
     */
    stack(builderFn?: (b: SynapticMelody) => SynapticMelody | SynapticMelodyNoteCursor | void): this {
        if (builderFn === undefined) {
            // No-arg version: enable polyphonic stacking mode
            return super.stack() as this;
        }

        // Save current tick position
        const savedTick = this.getCurrentTick();

        // Execute the builder function
        const result = builderFn(this);

        // If result is a cursor, commit it
        if (result && result !== this && 'commit' in result) {
            result.commit();
        }

        // Restore tick to saved position (parallel, not sequential)
        this.currentTick = savedTick;

        return this;
    }

    // Note: All escape methods (tempo, swing, transpose, etc.) are inherited from SynapticClip.
    // No empty overrides. SynapticClip base implementation handles state storage.
}
