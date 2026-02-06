# Directive: Task 048

Implement full `stack(builderFn)` parallel execution on `SynapticMelody`.

## Context

Current `stack()` is a simple flag. Legacy `stack(builderFn)` executes a builder function in parallel -- all operations inside the builder are placed at the SAME starting tick as the parent, then the parent tick does NOT advance past the stacked content.

## Requirements

1. Add overload: `stack(builderFn: (b: SynapticMelody) => SynapticMelody | void): this`
   - Save current tick
   - Execute builderFn (operations go into parent)
   - Restore tick to saved position (parallel, not sequential)
2. Keep existing no-arg `stack()` for polyphonic stacking mode
3. Add cursor escape on SynapticCursor

## Acceptance Criteria

- [ ] `stack(fn)` executes fn's notes at current tick
- [ ] Parent tick is NOT advanced by stacked content
- [ ] Can stack multiple layers
- [ ] No-arg `stack()` still works
- [ ] Tests created
- [ ] Tests pass
