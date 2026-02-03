# RFC-048-01: ARCHITECT DIRECTIVE - PLUGGABLE ID RESOLUTION

**Date**: 2025-12-25T20:21:00+04:00  
**To**: The Engineer  
**From**: The Architect

---

## STATUS: DIRECTIVE - COMPLIANCE MANDATORY

This directive initiates RFC-048 implementation: **Pluggable ID Resolution Strategy**.

You have successfully delivered RFC-047 Phases 1-7 with exceptional performance (417ms for 5000 notes). This RFC builds upon that foundation to provide **user choice** between proven (ID Table) and cutting-edge (Generational Handles) approaches.

---

## SCOPE

**Package**: `@symphonyscript/kernel`

**Objective**: Implement the Strategy Pattern for ID resolution, allowing users to choose between:
1. **ID Table** (current, 80µs per-op)
2. **Generational Handles** (new, 0.5µs per-op, 160x faster)

---

## COMPLIANCE PROTOCOL

### ✅ MANDATORY CHECKPOINTS

1. **Before Starting**: Submit `048-02-by-engineer-implementation-plan.md`
   - Detailed file inventory (which files will be created/modified)
   - Interface signatures (exact TypeScript definitions)
   - Test plan (unit tests, benchmarks, integration tests)

2. **After Each Phase**: Submit progress report `048-XX-by-engineer-phaseN-report.md`
   - What was completed
   - Any deviations from plan (must be justified)
   - Current test status (passing/failing)

3. **Upon Completion**: Submit `048-ZZ-by-engineer-completion-walkthrough.md`
   - Benchmark results (both strategies, side-by-side)
   - Code walkthrough (key implementation decisions)
   - Verification proof (all tests passing)

### ❌ ZERO-TOLERANCE VIOLATIONS

- **No cowboy coding**: Every change must be in the approved plan
- **No silent deviations**: If you discover a better approach mid-implementation, STOP and request approval
- **No "trust me" benchmarks**: All performance claims must have reproducible standalone scripts

---

## REQUIRED DELIVERABLES

### 1. Implementation Plan (`048-02-by-engineer-implementation-plan.md`)

**Format**:
```markdown
# RFC-048 Implementation Plan

## File Inventory
### New Files
- [ ] `src/id-resolver.ts` - Interface definition
- [ ] `src/id-table-resolver.ts` - Hash map implementation
- [ ] `src/generational-resolver.ts` - Arena implementation
- [ ] `benchmark-id-strategies.cjs` - Standalone benchmark

### Modified Files
- [ ] `src/silicon-synapse.ts` - Integrate IdResolver interface
- [ ] `src/index.ts` - Export new symbols
- [ ] `src/__tests__/id-resolver.spec.ts` - Strategy tests

## Interface Signatures
(Exact TypeScript interface definitions)

## Test Plan
### Unit Tests
- [ ] ID Table: insert, lookup, remove, collisions
- [ ] Generational: insert, lookup, stale handle detection
- [ ] Strategy equivalence: both produce same results

### Benchmarks
- [ ] 5000 inserts with ID Table
- [ ] 5000 inserts with Generational Handles
- [ ] Side-by-side comparison table

## Timeline
- Phase 1: Interface extraction (X hours)
- Phase 2: Generational implementation (Y hours)
- Phase 3: Configuration wiring (Z hours)
```

**Approval Required**: Yes. I will review and either approve or request changes.

---

### 2. Phase Reports (`048-XX-by-engineer-phaseN-report.md`)

**Format**:
```markdown
# RFC-048 Phase N Report

## Completed Work
- [x] Task A
- [x] Task B

## Deviations from Plan
(If any. Must be justified.)

## Test Status
- Unit tests: X/Y passing
- Benchmarks: Attached as `benchmark-output.txt`

## Next Steps
Phase N+1 objectives...
```

**Frequency**: After completing each phase in your plan.

---

### 3. Completion Walkthrough (`048-ZZ-by-engineer-completion-walkthrough.md`)

**Format**:
```markdown
# RFC-048 Completion Walkthrough

## Benchmark Results
| Strategy | 5000 Inserts | Per-Op | Speedup |
|----------|--------------|--------|---------|
| ID Table | Xms | Yµs | 1.0x |
| Generational | Xms | Yµs | ZZZx |

## Implementation Highlights
### IdResolver Interface
(Code snippet + explanation)

### Generational Handle Packing
(Code snippet + bitwise diagram)

## Verification
- All unit tests: ✅ PASS
- Benchmarks: ✅ Attached
- Integration: ✅ SynapticClip works with both strategies
```

**Approval Required**: Yes. Final sign-off before merge.

---

## STRICT REQUIREMENTS

### Performance Targets

| Strategy | Insert | Lookup | Delete |
|----------|--------|--------|--------|
| ID Table | < 100µs | < 100µs | < 20µs |
| Generational | < 2µs | < 2µs | < 2µs |

**If benchmarks show worse performance, STOP and report immediately.**

---

### Code Quality

1. **Zero-Allocation**: No `new` or `[]` in hot paths (after init)
2. **Thread-Safety**: All multi-threaded access uses `Atomics`
3. **Type Safety**: No `any`, no `@ts-ignore`
4. **Documentation**: Every public method has JSDoc with examples

---

### Testing

1. **Unit Tests**: 100% coverage of `IdResolver` interface
2. **Benchmarks**: Standalone scripts (no Jest overhead)
3. **Integration**: Existing `SiliconSynapse` tests must pass unchanged

---

## COMMUNICATION PROTOCOL

### When to Report

| Scenario | Action | Document |
|----------|--------|----------|
| Starting work | Submit plan | `048-02-by-engineer-implementation-plan.md` |
| Phase complete | Submit report | `048-XX-by-engineer-phaseN-report.md` |
| Found issue | STOP, report | `048-XX-by-engineer-issue-report.md` |
| All done | Submit walkthrough | `048-ZZ-by-engineer-completion-walkthrough.md` |

### How to Report

- **Format**: Markdown, strict structure (see templates above)
- **Location**: `/Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/research/communication/`
- **Naming**: `048-XX-by-engineer-<title>.md` (XX = sequential ID)

---

## ARCHITECT EXPECTATIONS

I expect:
- **Clarity**: Your plan should be detailed enough that another engineer could execute it
- **Honesty**: If you hit a blocker, report it immediately
- **Precision**: Benchmark numbers to 2 decimal places, no rounding
- **Discipline**: Follow the plan. No "I'll just quickly try this" deviations.

---

## AUTHORIZATION

You are **AUTHORIZED** to proceed **ONLY AFTER**:
1. You submit `048-02-by-engineer-implementation-plan.md`
2. I review and approve (send `048-03-by-architect-approval.md`)

**DO NOT WRITE CODE UNTIL PLAN IS APPROVED.**

---

## FINAL NOTE

This is not bureaucracy. This is **engineering discipline**.

The kernel is production-ready. We are adding a performance optimization layer. Every change must be measured, justified, and verified.

**Trust is earned through process, not bypassed by speed.**

Stand by for my approval of your implementation plan.

**—The Architect**
