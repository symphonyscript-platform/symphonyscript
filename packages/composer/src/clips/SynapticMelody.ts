import { SynapticClip } from './SynapticClip';
import { MelodyNoteCursor } from '../cursors/MelodyNoteCursor';
import { MelodyChordCursor } from '../cursors/MelodyChordCursor';
import { FrozenClip } from './FrozenClip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { SeededRandom } from '@symphonyscript/core';
import { ClipNode, EuclideanMelodyOptions, ArpeggioOptions, ArpPattern, ScaleMode } from '../types';
import { romanToChord } from '../utils/romanAdapter';
import { euclidean, rotatePattern } from '@symphonyscript/theory';
import { parsePitch } from '../utils/pitch';
import { parseChord } from '../utils/chord';
import { SCALE_INTERVALS } from '../utils/scales';


const OCTAVE_OFFSETS = [0, -12, 12];
const sortPitchesAsc = (a: number, b: number) => a - b;

/**
 * SynapticMelody
 * RFC-049 Section 5.1
 * Refreshed melody builder with cursor architecture.
 */
export class SynapticMelody extends SynapticClip {
    private noteCursor: MelodyNoteCursor;
    private chordCursor: MelodyChordCursor;
    private currentTick: number = 0;
    private sourceIdCounter: number = 0;

    // Task 064: Pre-allocated buffers for chord/voicing (zero-allocation)
    private readonly _chordBuffer = new Int8Array(12);
    private _chordLen = 0;
    private readonly _voicingBuffer = new Int8Array(12);
    private _voicingLen = 0;
    private readonly _prevVoicingBuffer = new Int8Array(12);
    private _prevVoicingLen = 0;
    private readonly _candidateBuffer = new Int8Array(12);
    private readonly _sortScratch = new Int8Array(12);

    constructor(bridge: SiliconBridge) {
        super(bridge);
        this.chordCursor = new MelodyChordCursor(this, bridge);
        this.noteCursor = new MelodyNoteCursor(this, bridge, this.chordCursor);
    }

    // ========================
    // SynapticClip Implementation
    // ========================

    getCurrentTick(): number {
        return this.currentTick;
    }

    advanceTick(duration: number): this {
        this.currentTick += duration;
        return this;
    }

    generateSourceId(): number {
        return this.sourceIdCounter++;
    }

    // ========================
    // Melody API Entry Points
    // ========================

    note(input: string | number, duration?: number): MelodyNoteCursor {
        return this.noteCursor.note(input, duration);
    }

    degree(deg: number, duration?: number, octaveOffset?: number, alteration?: number): MelodyNoteCursor {
        return this.noteCursor.degree(deg, duration, octaveOffset, alteration);
    }

    chord(symbol: string): MelodyChordCursor {
        return this.noteCursor.chord(symbol);
    }

    /**
     * Create a chord from scale degrees.
     * Requires scale() to be called first.
     * @param degrees - Array of scale degrees (1-7 for first octave, 8+ wraps to higher octaves)
     * @param duration - Optional chord duration
     * @returns MelodyChordCursor for further configuration
     * @throws Error if scale context is not set
     */
    degreeChord(degrees: number[], duration?: number): MelodyChordCursor {
        const ctx = this.getScaleContext();
        if (!ctx) {
            throw new Error('degreeChord() requires scale() to be called first');
        }

        if (degrees.length === 0) {
            throw new Error('degreeChord() requires at least one degree');
        }

        const intervals = SCALE_INTERVALS[ctx.mode];
        const rootPitch = parsePitch(ctx.root + ctx.octave);

        // Find the lowest pitch as the chord root (zero-allocation)
        let chordRoot = 127;
        for (let i = 0; i < degrees.length; i++) {
            const deg = degrees[i];
            const octaveShift = Math.floor((deg - 1) / 7);
            const scaleDegree = ((deg - 1) % 7 + 7) % 7; // Handle negative degrees
            const pitch = rootPitch + intervals[scaleDegree] + octaveShift * 12;
            if (pitch < chordRoot) chordRoot = pitch;
        }

        // Calculate intervals relative to the root
        let mask = 0;
        for (let i = 0; i < degrees.length; i++) {
            const deg = degrees[i];
            const octaveShift = Math.floor((deg - 1) / 7);
            const scaleDegree = ((deg - 1) % 7 + 7) % 7;
            const pitch = rootPitch + intervals[scaleDegree] + octaveShift * 12;
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
     * @returns MelodyChordCursor for further configuration
     * @throws Error if key context is not set
     */
    roman(numeral: string, duration?: number): MelodyChordCursor {
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
     * No options objects - use duration param directly.
     * @param numerals - Array of roman numerals (e.g., ['I', 'IV', 'V', 'I'])
     * @param duration - Duration per chord in beats (default 1)
     * @returns this for chaining
     * @throws Error if key context is not set
     */
    progression(numerals: string[], duration: number = 1): this {
        const keyCtx = this.getKeyContext();
        if (!keyCtx) {
            throw new Error('progression() requires key() to be called first');
        }

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
    voiceLead(numerals: string[], duration: number = 1): this {
        const keyCtx = this.getKeyContext();
        if (!keyCtx) {
            throw new Error('voiceLead() requires key() to be called first');
        }

        if (numerals.length === 0) {
            return this;
        }
        this._prevVoicingLen = 0;

        for (const numeral of numerals) {
            const chordSymbol = romanToChord(numeral, keyCtx);
            if (!chordSymbol) {
                throw new Error(`Invalid roman numeral in voiceLead: ${numeral}`);
            }

            this._chordLen = this.chordSymbolToBuffer(chordSymbol);

            if (this._prevVoicingLen === 0) {
                this.copySortToVoicing(this._chordBuffer, this._chordLen);
            } else {
                this.findBestVoicingToBuffer();
            }

            this.emitChordFromBuffer(this._voicingBuffer, this._voicingLen, duration);
            this.copyBuffer(this._voicingBuffer, this._voicingLen, this._prevVoicingBuffer);
            this._prevVoicingLen = this._voicingLen;
            this.advanceTick(duration);
        }

        return this;
    }

    /** Task 064: Write chord pitches to _chordBuffer, return length. */
    private chordSymbolToBuffer(symbol: string): number {
        const { root, mask } = parseChord(symbol);
        let len = 0;
        let interval = 0;
        let m = mask;
        while (m !== 0 && len < 12) {
            if ((m & 1) === 1) {
                this._chordBuffer[len++] = root + interval;
            }
            m >>>= 1;
            interval++;
        }
        return len;
    }

    /** Task 064: Copy src to _voicingBuffer, sort in place, set _voicingLen. */
    private copySortToVoicing(src: Int8Array, len: number): void {
        for (let i = 0; i < len; i++) this._voicingBuffer[i] = src[i];
        // Insertion sort (zero allocation)
        for (let i = 1; i < len; i++) {
            const v = this._voicingBuffer[i];
            let j = i;
            while (j > 0 && this._voicingBuffer[j - 1] > v) {
                this._voicingBuffer[j] = this._voicingBuffer[j - 1];
                j--;
            }
            this._voicingBuffer[j] = v;
        }
        this._voicingLen = len;
    }

    /** Task 064: Copy src to dst. */
    private copyBuffer(src: Int8Array, len: number, dst: Int8Array): void {
        for (let i = 0; i < len; i++) dst[i] = src[i];
    }

    /** Task 064: Find best voicing using _chordBuffer, _prevVoicingBuffer; write to _voicingBuffer. */
    private findBestVoicingToBuffer(): void {
        const baseLen = this._chordLen;
        const prevLen = this._prevVoicingLen;

        // Sort chord into _sortScratch
        for (let i = 0; i < baseLen; i++) this._sortScratch[i] = this._chordBuffer[i];
        for (let i = 1; i < baseLen; i++) {
            const v = this._sortScratch[i];
            let j = i;
            while (j > 0 && this._sortScratch[j - 1] > v) {
                this._sortScratch[j] = this._sortScratch[j - 1];
                j--;
            }
            this._sortScratch[j] = v;
        }

        let bestCost = Infinity;

        for (let inv = 0; inv < baseLen; inv++) {
            for (let oIdx = 0; oIdx < 3; oIdx++) {
                const octOffset = OCTAVE_OFFSETS[oIdx];
                for (let i = 0; i < baseLen; i++) {
                    const idx = (i + inv) % baseLen;
                    let pitch = this._sortScratch[idx] + octOffset;
                    if (i > 0 && pitch <= this._candidateBuffer[i - 1]) pitch += 12;
                    this._candidateBuffer[i] = pitch;
                }
                const cost = this.voiceMovementCostBuffers(prevLen, baseLen);
                if (cost < bestCost) {
                    bestCost = cost;
                    this.copyBuffer(this._candidateBuffer, baseLen, this._voicingBuffer);
                    this._voicingLen = baseLen;
                }
            }
        }
    }

    /** Task 064: Voice movement cost between _prevVoicingBuffer and _candidateBuffer. */
    private voiceMovementCostBuffers(prevLen: number, candLen: number): number {
        const minLen = Math.min(prevLen, candLen);
        let cost = 0;
        for (let i = 0; i < minLen; i++) {
            cost += Math.abs(this._prevVoicingBuffer[i] - this._candidateBuffer[i]);
        }
        cost += Math.abs(prevLen - candLen) * 12;
        return cost;
    }

    /** Task 064: Emit chord from buffer. */
    private emitChordFromBuffer(buf: Int8Array, len: number, duration: number): void {
        if (len === 0) return;
        let root = 127;
        for (let i = 0; i < len; i++) if (buf[i] < root) root = buf[i];
        let mask = 0;
        for (let i = 0; i < len; i++) mask |= (1 << (buf[i] - root));
        this.chordCursor.harmony(mask, root).duration(duration).commit();
    }

    /**
     * Execute a builder function multiple times, or loop another clip source.
     * Each iteration adds operations at the current tick position.
     *
     * @design-time Called during clip composition only. Closure allocations
     * are acceptable. Do not call during playback hot paths.
     *
     * @param count - Number of repetitions
     * @param source - Builder function or clip source to loop
     */
    loop(count: number, source: ((clip: SynapticMelody) => void) | SynapticClip | FrozenClip | ClipNode): this {
        if (typeof source === 'function') {
            // Builder function
            for (let i = 0; i < count; i++) {
                source(this);
            }
        } else {
            // Clip source - play it count times
            for (let i = 0; i < count; i++) {
                this.play(source);
            }
        }
        return this;
    }

    /**
     * Insert notes from another clip at current tick position.
     *
     * @design-time Called during clip composition only. Do not call during
     * playback hot paths.
     *
     * @param clip - Source clip (SynapticClip or FrozenClip). ClipNode is rejected.
     */
    play(clip: SynapticClip | FrozenClip | ClipNode): this {
        if (!(clip instanceof SynapticClip) && !(clip instanceof FrozenClip)) {
            throw new Error('SynapticMelody.play() only accepts SynapticClip or FrozenClip; ClipNode is not supported');
        }

        const tickOffset = this.getCurrentTick();
        let maxTick = 0;

        if (clip instanceof FrozenClip) {
            clip.visitNotes((_sourceId, pitch, velocity, duration, tick, muted) => {
                this.flushNote(
                    pitch,
                    velocity / 127,
                    duration,
                    tick + tickOffset,
                    muted,
                    this.generateSourceId()
                );

                const end = tick + duration;
                if (end > maxTick) {
                    maxTick = end;
                }
            });
        } else {
            clip.visitKernelNotes((_sourceId, pitch, velocity, duration, tick, muted) => {
                this.flushNote(
                    pitch,
                    velocity / 127,
                    duration,
                    tick + tickOffset,
                    muted,
                    this.generateSourceId()
                );

                const end = tick + duration;
                if (end > maxTick) {
                    maxTick = end;
                }
            });
        }

        // Advance tick by source clip duration.
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
            pattern = ArpPattern.UP,
            velocity = 0.8,
            gate = 0.8,
            octaves = 1,
            seed
        } = options ?? {};

        // Convert pitches to MIDI numbers
        let midiPitches: number[] = new Array(pitches.length);
        for (let i = 0; i < pitches.length; i++) {
            const p = pitches[i];
            midiPitches[i] = typeof p === 'string' ? parsePitch(p) : p;
        }

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
    private applyArpPattern(pitches: number[], pattern: ArpPattern, seed?: number): number[] {
        const sorted = new Array<number>(pitches.length);
        for (let i = 0; i < pitches.length; i++) sorted[i] = pitches[i];
        sorted.sort(sortPitchesAsc);

        switch (pattern) {
            case ArpPattern.UP:
                return sorted;

            case ArpPattern.DOWN:
                return [...sorted].reverse();

            case ArpPattern.UP_DOWN: {
                const down = [...sorted].reverse().slice(1);
                return [...sorted, ...down];
            }

            case ArpPattern.DOWN_UP: {
                const up = [...sorted].slice(1);
                return [...[...sorted].reverse(), ...up];
            }

            case ArpPattern.RANDOM: {
                const rng = new SeededRandom(seed ?? Date.now());
                const shuffled = [...sorted];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(rng.next() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
            }

            case ArpPattern.CONVERGE: {
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

            case ArpPattern.DIVERGE: {
                const result: number[] = [];
                const mid = Math.floor(sorted.length / 2);
                let left = mid;
                let right = mid + 1;

                if (sorted.length % 2 === 1) {
                    result.push(sorted[mid]);
                    left = mid - 1;
                } else {
                    left = mid - 1;
                    right = mid;
                }

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
    voice(id: number, builderFn: (v: SynapticMelody) => SynapticMelody | MelodyNoteCursor | void): this {
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
    override stack(builderFn?: (b: SynapticMelody) => SynapticMelody | MelodyNoteCursor | void): this {
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
