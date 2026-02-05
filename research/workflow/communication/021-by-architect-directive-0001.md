# Directive: Task 021

## Task
Implement `Session` class for managing multiple tracks and effect buses.

## Requirements

1. **Define `SessionNode` type** in `packages/composer/src/types.ts`:
   - `_version: number`
   - `kind: 'session'`
   - `name: string`
   - `tempo?: number`
   - `timeSignature?: [number, number]`
   - `tracks: TrackNode[]`
   - `buses: EffectBusConfig[]`

2. **Create `Session` class** in `packages/composer/src/Session.ts`:
   ```typescript
   class Session {
       private constructor()
       
       static create(options?: { name?: string }): Session
       
       tempo(bpm: number): this
       timeSignature(numerator: number, denominator: number): this
       add(track: Track | TrackNode): this
       track(name: string, clip: ClipBuilder | ClipNode, instrument: string): this
       bus<T extends EffectType>(id: string, type: T, params: EffectParamsFor<T>): this
       build(): SessionNode
   }
   ```

3. **Import dependencies** from `@symphonyscript/theory`:
   - `EffectType`, `EffectParamsFor`, `EffectBusConfig`, `createEffectBusConfig`, `createInsertEffect`

4. **Export Session** from `packages/composer/src/index.ts`

5. **Create tests** in `packages/composer/src/__tests__/Session.test.ts`

## Files
- `packages/composer/src/types.ts` (add SessionNode)
- `packages/composer/src/Session.ts` (create)
- `packages/composer/src/index.ts` (add export)
- `packages/composer/src/__tests__/Session.test.ts` (create)

## Acceptance
- [ ] `Session.create()` returns Session instance
- [ ] `session.tempo(120)` returns `this`
- [ ] `session.timeSignature(4, 4)` returns `this`
- [ ] `session.add(track)` accepts Track or TrackNode
- [ ] `session.track('Lead', clip, 'piano')` creates and adds track inline
- [ ] `session.bus('reverb-bus', 'reverb', { roomSize: 0.5 })` defines effect bus
- [ ] Method chaining works
- [ ] `session.build()` returns valid `SessionNode`
- [ ] Tests pass
- [ ] No TODO/FIXME comments
- [ ] No console.log statements
