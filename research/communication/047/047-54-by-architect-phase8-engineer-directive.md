# RFC-047 Phase 8: ENGINEER DIRECTIVE

**Date**: 2025-12-25T21:30:00+04:00  
**From**: The Architect  
**To**: The Engineer  
**RFC**: 047  
**Document**: 047-54-by-architect-phase8-engineer-directive.md

---

## STATUS: EXECUTE

RFC-047 Phases 1-7 are **VERIFIED COMPLETE**. You are now tasked with completing Phase 8: Composer Polyphony.

---

## COMMUNICATION PROTOCOL

All communication MUST be via documents in:
```
/Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/research/communication/
```

Document naming format:
```
<rfc>-<increment>-by-<author>-<description>.md
```

After completing EACH task, submit a completion report. Before starting EACH task, submit an implementation plan.

---

## OUTSTANDING TASKS

The following features are **NOT IMPLEMENTED** and must be completed:

### Task 1: String Voice Names

**Current**: `.voice(number, fn)` accepts only numeric expressionId  
**Required**: `.voice(string | number, fn)` accepts both

**Implementation Requirements**:
- If string provided, hash to numeric ID (use consistent hashing)
- Maintain type safety (union type in signature)
- Update JSDoc with examples for both

**Files to modify**:
- `packages/composer/src/SynapticClip.ts`

**Tests to add**:
- `packages/composer/src/__tests__/voice.test.ts` - add string name tests

---

### Task 2: Groove Integration (`.use()`)

**Current**: `GrooveBuilder` exists but is not integrated with `SynapticClip`  
**Required**: `.use(groove)` applies groove to downstream notes

**API**:
```typescript
const mpc = Clip.groove().swing(0.55).steps(4).build();
clip.use(mpc).note('C4').note('D4');
```

**Implementation Requirements**:
- Store groove template in clip state
- Apply swing offset to notes based on step position
- Swing formula: `offset = groove.swing * stepDuration` for odd steps (1, 3, 5...)
- Must be zero-allocation after init (store as primitives, not objects in hot path)

**Files to modify**:
- `packages/composer/src/SynapticClip.ts` - add `.use()` method and groove application logic

**Tests to add**:
- `packages/composer/src/__tests__/groove-integration.test.ts`

---

### Task 3: Wait Method (`.wait()`)

**Current**: Not implemented  
**Required**: `.wait(duration)` sets clip start delay

**API**:
```typescript
clip.wait(480).note('C4');  // Clip starts 480 ticks late
```

**Implementation Requirements**:
- Store `startDelay` in clip state
- Add to baseTick for all notes in clip
- Different from `.shift()` which is per-note

**Files to modify**:
- `packages/composer/src/SynapticClip.ts`

**Tests to add**:
- `packages/composer/src/__tests__/timing.test.ts`

---

### Task 4: Playback Offset (`.playbackOffset()`)

**Current**: Not implemented, `REG.PLAYBACK_OFFSET` not defined  
**Required**: `.playbackOffset(ms)` writes latency compensation to SAB

**API**:
```typescript
clip.playbackOffset(10);  // 10ms hardware latency compensation
```

**Implementation Requirements**:

1. **Kernel**: Add `REG.PLAYBACK_OFFSET` constant to `packages/kernel/src/constants.ts`
2. **Kernel**: Add setter method to `SiliconSynapse` or `SiliconBridge`
3. **Composer**: Add `.playbackOffset(ms)` to `SynapticClip`

**Files to modify**:
- `packages/kernel/src/constants.ts` - add REG.PLAYBACK_OFFSET
- `packages/kernel/src/silicon-synapse.ts` - add setter
- `packages/composer/src/SynapticClip.ts` - add method

**Tests to add**:
- `packages/composer/src/__tests__/timing.test.ts`

---

## EXECUTION ORDER

1. Task 1: String Voice Names
2. Task 2: Groove Integration
3. Task 3: Wait Method
4. Task 4: Playback Offset

---

## DELIVERABLES

For **EACH task**:

### Before Implementation

Submit implementation plan as:
```
047-<N>-by-engineer-task<X>-plan.md
```

Plan MUST include:
- Exact file changes with line numbers
- Code snippets showing the change
- Test cases to be added
- Any concerns or questions

### After Implementation

Submit completion report as:
```
047-<N>-by-engineer-task<X>-complete.md
```

Report MUST include:
- Summary of changes made
- Files modified (with diffs or key snippets)
- Tests added and results
- Any deviations from plan (with justification)

---

## CONSTRAINTS

1. **Zero-Allocation in Hot Paths**: `.note()` and traversal must not allocate
2. **Type Safety**: No `any`, all parameters fully typed
3. **Fluent API**: All methods return `this`
4. **Immutability**: If returning new instances, state must be copied correctly
5. **Test Coverage**: Every new method must have unit tests

---

## NON-NEGOTIABLE RULES

1. **DO NOT IMPROVISE** — Follow the plan exactly
2. **DO NOT START** without submitting implementation plan
3. **DO NOT SKIP TESTS** — Every feature requires tests
4. **RAISE CONCERNS** in reports if you encounter issues
5. **USE ATOMICS** for all SAB operations (playbackOffset)

---

**Execute.**
