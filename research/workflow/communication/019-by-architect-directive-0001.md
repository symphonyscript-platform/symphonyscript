# Directive: Task 019

## Task
Implement scale context for `degree()` method.

## Requirements

1. Add `ScaleContext` type to `types.ts`
2. Add scale state to `SynapticClip`
3. Implement `scale(root, mode, octave?)` on `SynapticMelody`
4. Update `degree()` to use scale context
5. Support options: `octaveOffset`, `alteration`

## Type Definition

Add to `packages/composer/src/types.ts`:

```typescript
export type ScaleMode = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian';

export interface ScaleContext {
    root: string;      // 'C', 'G', 'F#', etc.
    mode: ScaleMode;
    octave: number;    // Base octave (4 = middle C octave)
}

export interface DegreeOptions {
    octaveOffset?: number;   // Shift octaves (+1 = up, -1 = down)
    alteration?: number;     // Semitone alteration (+1 = sharp, -1 = flat)
}
```

## Scale Intervals

```typescript
const SCALE_INTERVALS: Record<ScaleMode, number[]> = {
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    phrygian:   [0, 1, 3, 5, 7, 8, 10],
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian:    [0, 1, 3, 5, 6, 8, 10]
};
```

## Implementation

Add to `SynapticClip`:

```typescript
protected scaleContext: ScaleContext | null = null;

setScale(root: string, mode: ScaleMode, octave: number = 4): this {
    this.scaleContext = { root, mode, octave };
    return this;
}

getScaleContext(): ScaleContext | null {
    return this.scaleContext;
}
```

Update `SynapticMelodyNoteCursor.degree()`:

```typescript
degree(deg: number, duration?: number, options?: DegreeOptions): this {
    const ctx = (this.clip as SynapticMelody).getScaleContext();
    if (!ctx) {
        throw new Error('degree() requires scale() to be called first');
    }
    
    const intervals = SCALE_INTERVALS[ctx.mode];
    const octaveShift = Math.floor((deg - 1) / 7);
    const scaleDegree = ((deg - 1) % 7 + 7) % 7; // Handle negative degrees
    
    const rootPitch = parsePitch(ctx.root + ctx.octave);
    const octaveOffset = options?.octaveOffset ?? 0;
    const alteration = options?.alteration ?? 0;
    
    this.pitch = rootPitch 
        + intervals[scaleDegree] 
        + (octaveShift + octaveOffset) * 12 
        + alteration;
    
    // ... rest of method
}
```

## Files

- `packages/composer/src/types.ts` (add types)
- `packages/composer/src/clips/SynapticClip.ts` (add scale state)
- `packages/composer/src/clips/SynapticMelody.ts` (add scale method, expose getScaleContext)
- `packages/composer/src/cursors/SynapticMelodyNoteCursor.ts` (update degree)
- `packages/composer/src/__tests__/scale.test.ts` (create)

## Acceptance

- [ ] `ScaleContext` type defined
- [ ] `scale('G', 'major')` sets context
- [ ] `degree(1)` returns root in current scale
- [ ] `degree(3)` returns major/minor third correctly
- [ ] `degree(1, 0.5, { octaveOffset: 1 })` shifts octave
- [ ] `degree(2, 0.5, { alteration: 1 })` adds sharp
- [ ] Error if degree() without scale()
- [ ] Tests pass
