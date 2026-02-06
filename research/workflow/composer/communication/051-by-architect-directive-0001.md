# Directive: Task 051

## Task
Implement two-level arpeggio system: clip-level defaults + chord-level overrides.

## Requirements

1. **SynapticClip.ts** — Add clip-level arpeggio state:
   - `private _arpeggioPattern: ArpPattern | null = null`
   - `private _arpeggioRate: number = 0.125`
   - `private _arpeggioGate: number = 0.8`
   - `arpeggio(pattern: ArpPattern | null): this` — setter
   - `arpeggioRate(rate: number): this` — setter
   - `arpeggioGate(gate: number): this` — setter
   - `getArpeggioPattern(): ArpPattern | null` — getter
   - `getArpeggioRate(): number` — getter
   - `getArpeggioGate(): number` — getter

2. **SynapticChordCursor.ts** — Add per-chord overrides:
   - `private _arpPattern: ArpPattern | null | undefined = undefined`
   - `private _arpRate: number | undefined = undefined`
   - `private _arpGate: number | undefined = undefined`
   - `arpeggio(pattern: ArpPattern | null): this`
   - `arpeggioRate(rate: number): this`
   - `arpeggioGate(gate: number): this`

3. **SynapticChordCursor.commit()** — Resolve and apply:
   ```typescript
   const pattern = this._arpPattern !== undefined 
       ? this._arpPattern 
       : this.clip.getArpeggioPattern();
   
   if (pattern !== null) {
       const rate = this._arpRate ?? this.clip.getArpeggioRate();
       const gate = this._arpGate ?? this.clip.getArpeggioGate();
       // Emit notes sequentially using applyArpPattern()
   } else {
       // Emit block chord (current behavior)
   }
   ```

4. **types.ts** — Add if missing:
   ```typescript
   type ArpPattern = 'up' | 'down' | 'upDown' | 'downUp' | 'random' | 'converge' | 'diverge';
   ```

## Files

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[MODIFY] packages/composer/src/cursors/SynapticChordCursor.ts`
- `[MODIFY] packages/composer/src/types.ts` (if ArpPattern missing)

## Acceptance Criteria

- [ ] `clip.arpeggio('up')` affects subsequent chord commits
- [ ] `clip.arpeggioRate(0.125)` sets default rate
- [ ] `clip.arpeggioGate(0.8)` sets default gate
- [ ] `chord().arpeggio('down')` overrides clip-level pattern
- [ ] `chord().arpeggioRate(0.0625)` overrides clip-level rate
- [ ] `arpeggio(null)` at chord level disables arpeggiation for that chord
- [ ] Pattern 'up' emits notes low-to-high
- [ ] Pattern 'down' emits notes high-to-low
- [ ] Patterns 'upDown', 'downUp', 'random', 'converge', 'diverge' implemented
- [ ] Build succeeds (pre-existing errors excluded)
- [ ] Arpeggio tests updated and passing
