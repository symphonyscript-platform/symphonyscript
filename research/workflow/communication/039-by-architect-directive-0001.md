# Directive: Task 039

Implement `isolate()` for scope isolation per `research/workflow/tasks/039-2026-02-03-implement-isolate.md`

## Expectations

- Add types to `types.ts`:
  ```typescript
  interface ScopeIsolation {
      tempo?: boolean;
      dynamics?: boolean;
      timeSignature?: boolean;
  }
  
  interface ScopeOp {
      kind: 'scope';
      isolate: ScopeIsolation;
      operations: (NoteOperation | CCOperation | ...)[];
  }
  ```
- Implement `isolate(options: ScopeIsolation, builderFn: (b: this) => this): this` on SynapticClip
- Create clone with isolated state
- Execute builderFn
- Wrap operations in ScopeOp
- Parent state unchanged after scope
- Update `ClipNode.operations` union to include `ScopeOp`
- Add cursor escape method

## Files

- `packages/composer/src/types.ts` (add types, update union)
- `packages/composer/src/clips/SynapticClip.ts` (add isolate method)
- `packages/composer/src/cursors/ComposerCursor.ts` (add escape)
- `packages/composer/src/index.ts` (export types)
- `packages/composer/src/__tests__/Isolate.test.ts` (create)
