import { SynapticMelodyBaseCursor } from './SynapticMelodyBaseCursor'
import { SynapticClip } from '../clips/SynapticClip'
import { SiliconBridge } from '@symphonyscript/kernel'
import { parseChord } from '../utils/chord'
import { ArpPattern } from '../types'

// OPCODE 1 = NOTE
const OPCODE_NOTE = 1;

/**
 * MelodyChordCursor - Task 061 parallel hierarchy
 * Phase 5: Zero-allocation, bit-mask based chord handling.
 */
export class MelodyChordCursor extends SynapticMelodyBaseCursor {
    // Config
    private readonly maxVoices: number;

    // Memory (Fixed Arrays)
    private readonly pitches: Int32Array;
    private readonly sourceIds: Int32Array;

    // State
    private chordMask: number = 0;
    private chordRoot: number = 60; // Default C4

    // Chord-level arpeggio overrides (undefined = use clip default)
    private _arpPattern: ArpPattern | null | undefined = undefined;
    private _arpRate: number | undefined = undefined;
    private _arpGate: number | undefined = undefined;

    constructor(clip: SynapticClip, bridge: SiliconBridge, maxVoices: number = 8) {
        super(clip, bridge);
        this.maxVoices = maxVoices;
        // Pre-allocate arrays once conforming to RFC-049 zero-alloc rules
        this.pitches = new Int32Array(maxVoices);
        this.sourceIds = new Int32Array(maxVoices);
    }

    /**
     * Relay: Configures a chord from symbol.
     * Example: .chord('Cmaj7')
     */
    chord(symbol: string): this {
        if (this.hasPending) {
            this.commit();
            this.clip.advanceTick(this._duration);
        }

        this.bind(this.clip.getCurrentTick());

        // Parse
        const { root, mask } = parseChord(symbol);
        this.chordRoot = root;
        this.chordMask = mask;

        // Reset chord-level overrides
        this._arpPattern = undefined;
        this._arpRate = undefined;
        this._arpGate = undefined;

        this.hasPending = true;
        return this;
    }

    /**
     * Relay: Harmony via raw mask.
     */
    harmony(mask: number, root?: number): this {
        if (this.hasPending) {
            this.commit();
            this.clip.advanceTick(this._duration);
        }
        this.bind(this.clip.getCurrentTick());

        this.chordMask = mask;
        if (root !== undefined) this.chordRoot = root;

        // Reset chord-level overrides
        this._arpPattern = undefined;
        this._arpRate = undefined;
        this._arpGate = undefined;

        this.hasPending = true;
        return this;
    }

    /**
     * Modifier: Inversion via bitwise rotation.
     * Wraps notes that exceed 24 semitone range? 
     * Simple logic: take bottom-most bit, move it +12.
     * Repeat 'steps' times.
     */
    inversion(steps: number): this {
        if (!this.hasPending || this.chordMask === 0) return this;

        for (let s = 0; s < steps; s++) {
            // Find lowest set bit
            // mask & -mask gets LSB (e.g. 0...0100)
            const lsb = this.chordMask & -this.chordMask;

            if (lsb === 0) break; // Empty mask

            // Clear LSB
            this.chordMask ^= lsb;

            // Determine interval value of LSB
            // Shift process: 1 << (interval + 12)
            const newBit = lsb << 12;
            this.chordMask |= newBit;
        }
        return this;
    }

    /**
     * Override arpeggio pattern for this chord.
     * @param pattern - Arpeggio pattern, or null to disable arpeggiation
     */
    arpeggio(pattern: ArpPattern | null): this {
        this._arpPattern = pattern;
        return this;
    }

    /**
     * Override arpeggio rate for this chord.
     * @param rate - Duration per arpeggiated note
     */
    arpeggioRate(rate: number): this {
        this._arpRate = rate;
        return this;
    }

    /**
     * Override arpeggio gate for this chord.
     * @param gate - Note duration multiplier (0-1)
     */
    arpeggioGate(gate: number): this {
        this._arpGate = gate;
        return this;
    }

    /**
     * Flushes the chord to kernel using inline bit iteration.
     * RFC-050: Delegates each voice to clip.flushNote() for transformation application.
     * Task 051: Resolves arpeggio settings and emits notes sequentially if arpeggiated.
     * STRICT ZERO-ALLOCATION. No closures.
     */
    commit(): void {
        if (!this.hasPending) return;

        let mask = this.chordMask;
        let voiceIndex = 0;

        // 1. Unpack mask to pitches array (Inline)
        let interval = 0;
        const root = this.chordRoot;

        while (mask !== 0 && voiceIndex < this.maxVoices) {
            if ((mask & 1) === 1) {
                // Found a note at this interval
                this.pitches[voiceIndex] = root + interval;
                voiceIndex++;
            }
            mask >>>= 1; // Unsigned right shift
            interval++;
        }

        // 2. Resolve arpeggio settings (chord-level override > clip-level default)
        const pattern = this._arpPattern !== undefined
            ? this._arpPattern
            : this.clip.getArpeggioPattern();

        if (pattern !== null && voiceIndex > 1) {
            // Arpeggiated: emit notes sequentially
            const rate = this._arpRate ?? this.clip.getArpeggioRate();
            const gate = this._arpGate ?? this.clip.getArpeggioGate();
            const noteDuration = rate * gate;

            // Convert Int32Array slice to regular array for pattern ordering
            const pitchArray: number[] = [];
            for (let i = 0; i < voiceIndex; i++) {
                pitchArray.push(this.pitches[i]);
            }

            // Apply pattern ordering
            const orderedPitches = this.applyArpPattern(pitchArray, pattern);

            // Emit each note with sequential timing; drain after each so identity table is ready for next
            let currentTick = this.baseTick;
            for (let i = 0; i < orderedPitches.length; i++) {
                const sourceId = this.clip.generateSourceId();
                this.clip.flushNote(
                    orderedPitches[i],
                    this._velocity,
                    noteDuration,
                    currentTick,
                    this.muted,
                    sourceId,
                    this.expressionId
                );
                const linker = this.bridge.getLinker();
                while (linker.processCommands() > 0) {}
                currentTick += rate;
            }
        } else {
            // Block chord: emit all notes at same tick (original behavior)
            // 2. Generate SourceIDs
            for (let i = 0; i < voiceIndex; i++) {
                this.sourceIds[i] = this.clip.generateSourceId();
            }

            // 3. Flush each voice via clip mediator; drain after each so identity table is ready for next
            for (let i = 0; i < voiceIndex; i++) {
                this.clip.flushNote(
                    this.pitches[i],
                    this._velocity,
                    this._duration,
                    this.baseTick,
                    this.muted,
                    this.sourceIds[i],
                    this.expressionId
                );
                const linker = this.bridge.getLinker();
                while (linker.processCommands() > 0) {}
            }
        }

        this.hasPending = false;
    }

    /**
     * Apply arpeggio pattern ordering to pitches.
     * @internal
     */
    private applyArpPattern(pitches: number[], pattern: ArpPattern): number[] {
        const sorted = [...pitches].sort((a, b) => a - b);

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
                const rng = this.clip.getSeededRng();
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
}
