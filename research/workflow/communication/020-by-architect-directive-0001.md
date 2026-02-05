# Directive: Task 020

## Task
Implement `Track` class for associating clips with instruments and effects.

## Requirements

1. **Define `TrackNode` type** in `packages/composer/src/types.ts`:
   - `_version: number`
   - `kind: 'track'`
   - `name: string`
   - `instrumentId: string`
   - `clip: ClipNode`
   - `tempo?: number`
   - `timeSignature?: [number, number]`
   - `inserts: InsertEffect[]`
   - `sends: SendConfig[]`

2. **Create `Track` class** in `packages/composer/src/Track.ts`:
   ```typescript
   class Track {
       private constructor(
           instrument: string,
           clip: ClipBuilder | ClipNode,
           name?: string
       )
       
       static from(clip: ClipBuilder | ClipNode, instrument: string, options?: { name?: string }): Track
       
       tempo(bpm: number): this
       timeSignature(numerator: number, denominator: number): this
       insert<T extends EffectType>(type: T, params: EffectParamsFor<T>): this
       send(busId: string, amount: number): this
       build(): TrackNode
   }
   ```

3. **Import dependencies** from `@symphonyscript/theory`:
   - `EffectType`, `EffectParamsFor`, `InsertEffect`, `SendConfig`

4. **Export Track** from `packages/composer/src/index.ts`

5. **Create tests** in `packages/composer/src/__tests__/Track.test.ts`

## Files
- `packages/composer/src/types.ts` (add TrackNode)
- `packages/composer/src/Track.ts` (create)
- `packages/composer/src/index.ts` (add export)
- `packages/composer/src/__tests__/Track.test.ts` (create)

## Acceptance
- [ ] `Track.from(clip, 'piano')` creates Track instance
- [ ] `track.tempo(120)` returns `this`
- [ ] `track.timeSignature(4, 4)` returns `this`
- [ ] `track.insert('reverb', { mix: 0.3 })` returns `this`
- [ ] `track.send('delay-bus', 0.5)` returns `this`
- [ ] Method chaining: `Track.from(...).tempo(120).timeSignature(4, 4).insert(...).build()`
- [ ] `track.build()` returns valid `TrackNode`
- [ ] Build fails
- [ ] Tests pass
- [ ] No TODO/FIXME comments
- [ ] No console.log statements
