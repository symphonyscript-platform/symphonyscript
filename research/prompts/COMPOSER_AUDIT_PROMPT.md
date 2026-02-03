# COMPOSER AUDIT PROTOCOL — ZERO TRUST

READ `packages/composer/src/clips/SynapticClip.ts` AND `packages/composer/src/cursors/ComposerCursor.ts`.
CONFIRM that you have read both files.
THEN:

---

## ROLE: HOSTILE COMPOSER AUDITOR

### 1. CRITICAL CONTEXT — READ FIRST

The `@symphonyscript/composer` package is the **HIGH-LEVEL DSL LAYER** of SymphonyScript. It sits at the top of the stack, above `@symphonyscript/synaptic` and `@symphonyscript/kernel`, providing the user-facing composition API.

The execution model is:

1. **SymphonyEngine (Main Thread)**: Initializes AudioContext, loads AudioWorklet, manages transport (play/pause/stop), provides SharedArrayBuffer to worklet
2. **SynapticClip (Main Thread)**: Abstract base extending `SynapticNode`, manages escape state (tempo, swing, groove), mediates note flushing with transformations
3. **Cursors (Main Thread)**: Mutable cursor pattern for configuring notes before kernel insertion. Pending-state pattern prevents premature kernel writes.
4. **GrooveBuilder (Main Thread)**: Constructs groove templates with pre-allocated Float32Arrays

**Architectural Position:**

```
┌─────────────────────────────────────────────────────────────┐
│                    User Application                          │
├─────────────────────────────────────────────────────────────┤
│                 @symphonyscript/composer                     │
│  ┌──────────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  SymphonyEngine  │  │ SynapticClip│  │     Cursors     │ │
│  │  - AudioWorklet  │  │ - Escapes   │  │ - Pending-state │ │
│  │  - Transport     │  │ - Flush     │  │ - Modifiers     │ │
│  └──────────────────┘  └─────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                   @symphonyscript/synaptic                   │
│                     (SynapticNode base)                      │
├─────────────────────────────────────────────────────────────┤
│                   @symphonyscript/kernel                     │
│                (SiliconBridge, SharedArrayBuffer)            │
└─────────────────────────────────────────────────────────────┘
```

**What This Means for Your Assessment**

IN SCOPE:
- **Import Integrity**: No broken imports, no phantom legacy references
- **Test Health**: All tests should pass; broken tests indicate broken code
- **Synaptic Contract**: Correct extension of `SynapticNode`, proper topology management
- **Kernel Contract**: Correct use of `SiliconBridge` APIs (insertAsync, connect, etc.)
- **RFC-049 Compliance**: Cursor architecture must match specification
- **State Consistency**: Escape state, pending state, topology IDs must stay coherent
- **Zero-Allocation in Cursors**: Pending-state pattern must avoid allocation in hot paths
- **Theory Integration**: Correct use of `@symphonyscript/theory` for pitch/chord parsing

OUT OF SCOPE (Do Not Critique):
- Kernel internals (audited separately)
- Synaptic internals (audited separately)
- UI/UX design decisions
- Build tooling, bundling, or packaging

---

**CHECKPOINT: The composer layer IS allowed to allocate in setup/configuration. Zero-allocation is only required in cursor hot paths (the `commit()` / `flush()` methods that write to kernel).**

---

### 2. MANDATE

You are a **Hostile Composer Auditor** with no prior involvement in this design. Assume every line of code is guilty until proven innocent.

**AXIOMS:**
1. **Zero Trust**: Verify everything. Assume nothing works.
2. **Zero Tolerance**: Broken imports, failing tests, and spec deviations are defects.
3. **State Integrity**: Escape state and topology must never become inconsistent.
4. **Layer Contracts**: Calls to synaptic/kernel must follow their API contracts.
5. **Prove It Works**: Tests must pass. If they don't, the package is not production-ready.

**MANDATE:** Identify flaws that could cause:
1. **Build Failures**: Broken imports, missing dependencies, phantom references
2. **Test Failures**: Tests that fail indicate broken functionality
3. **State Corruption**: Escape state, pending state, or topology IDs become invalid
4. **Contract Violations**: Incorrect use of kernel/synaptic APIs
5. **Spec Deviation**: Implementation differs from RFC-049 requirements
6. **Silent Failures**: Errors swallowed without propagation

Do not offer praise. Be harsh but fair.

---

### 3. THE SYSTEM UNDER AUDIT

**Package:** `@symphonyscript/composer`
**Location:** `packages/composer/src/`

**Core Components:**

| File/Folder | Responsibility | Allocation Context |
|-------------|----------------|-------------------|
| `SymphonyEngine.ts` | AudioContext, AudioWorklet, Transport | Setup (allocation OK) |
| `Clip.ts` | DSL factory, session singleton | Setup (allocation OK) |
| `clips/SynapticClip.ts` | Base clip, escapes, note flushing | Mixed (flush must be careful) |
| `clips/SynapticMelody.ts` | Melody-specific clip | Setup |
| `clips/SynapticDrums.ts` | Drums-specific clip | Setup |
| `cursors/ComposerCursor.ts` | Abstract cursor base, modifiers | Hot path (`commit()`) |
| `cursors/SynapticNoteCursor.ts` | Single note cursor | Hot path (`commit()`) |
| `cursors/SynapticChordCursor.ts` | Chord cursor (multi-voice) | Hot path (`commit()`) |
| `cursors/SynapticMelodyBaseCursor.ts` | Expression modifiers base | Hot path |
| `cursors/SynapticMelodyNoteCursor.ts` | Melody note cursor | Hot path |
| `cursors/SynapticDrumHitCursor.ts` | Drum hit cursor | Hot path |
| `groove/SynapticGrooveBuilder.ts` | Groove template builder | Setup (pre-allocated arrays) |
| `groove/GrooveStepCursor.ts` | Groove step configuration | Setup |
| `utils/pitch.ts` | Pitch parsing utilities | Allocation OK |
| `utils/chord.ts` | Chord parsing utilities | Allocation OK |

**Key Abstractions:**

| Concept | Description | Critical Invariant |
|---------|-------------|-------------------|
| Pending-State | Note configured before kernel write | `hasPending` must track correctly |
| Escape State | tempo, swing, groove, transpose, etc. | Must persist across notes |
| Topology | Entry/Exit IDs from SynapticNode | Must stay coherent after flush |
| Mediator Pattern | Clip mediates all kernel writes | Cursors MUST NOT call bridge directly |

**RFCs to Cross-Reference:**
- RFC-049: Synaptic Cursor Architecture (cursor hierarchy, pending-state pattern)
- RFC-050: Clip-Mediated Flush Architecture (if exists)
- RFC-053: Generic Synaptic Node (inherited by SynapticClip)
- RFC-054: Native Phase Locking (loop/cycle behavior)

---

### 4. REQUIRED ASSESSMENT STRUCTURE

You **MUST** structure your report into these sections:

#### A. Build Health Audit

1. **Run** `pnpm build` in the composer package
2. **Check** for TypeScript compilation errors
3. **Identify** any broken imports (especially phantom legacy references)
4. **Verify** all dependencies in `package.json` are valid

**Known Risk:** `Clip.ts` imports from `../../../../legacy/symphonyscript/...` which may not exist.

**Deliverable:** Build status with error list (if any)

#### B. Test Health Audit

1. **Run** `pnpm test` in the composer package
2. **Capture** test results (pass/fail counts)
3. **Categorize** failing tests by root cause:
   - Broken imports
   - Missing implementations
   - Incorrect assertions
   - External dependency issues
4. **Assess** test coverage adequacy

**Deliverable:** Test status matrix (test file × status × root cause)

#### C. Import Dependency Audit

For EACH source file:
1. **Verify** all imports resolve correctly
2. **Flag** any imports from `legacy/` paths (these are likely broken)
3. **Verify** cross-package imports (`@symphonyscript/kernel`, `@symphonyscript/synaptic`, `@symphonyscript/theory`, `@symphonyscript/core`)

**Deliverable:** Import health matrix (file × imports × status)

#### D. RFC-049 Compliance Audit

For EACH requirement in RFC-049:

1. **Pending-State Pattern**: Does calling `.note()` avoid immediate kernel write?
2. **Single Mutable Cursor**: Is cursor reused (not reallocated)?
3. **Relay Methods**: Do relays commit previous pending state?
4. **Escape Methods**: Do escapes commit and return clip?
5. **Cursor Hierarchy**: Are all cursor types implemented per spec?

**Deliverable:** RFC-049 compliance matrix (requirement × implementation × verdict)

#### E. State Consistency Audit

1. **Pending State**: Can `hasPending` become out of sync with actual state?
2. **Escape State**: Is escape state properly initialized and maintained?
3. **Topology IDs**: After `flushNote()`, are `entryId`/`exitId` updated correctly?
4. **Tick Tracking**: Does `getCurrentTick()` / `advanceTick()` stay accurate?

**Deliverable:** State consistency risk matrix

#### F. Kernel/Synaptic Contract Audit

For EACH call to kernel or synaptic APIs:

1. **SiliconBridge calls**: Are error codes checked?
2. **SynapticNode extension**: Is `super()` called correctly? Are abstract methods implemented?
3. **OPCODE usage**: Are opcodes used correctly per kernel spec?
4. **Pointer/ID handling**: Are return values validated before use?

**Deliverable:** Contract compliance matrix

#### G. Zero-Allocation Compliance (Cursor Hot Paths)

Scan cursor `commit()` and `flush()` methods for:
- Object literals `{}`
- Array literals `[]`
- `new` keyword (after construction)
- Arrow functions as callbacks
- `for...of` loops
- `throw` statements
- `try/catch` blocks

**Note:** Allocation is acceptable in constructor and setup methods. Only audit `commit()`, `flush()`, and their callees.

**Deliverable:** Cursor hot path allocation violations (if any)

#### H. Final Verdict

- **Grade**: A–F based on production readiness
- **Critical Defects**: Must-fix before any usage
- **High Defects**: Must-fix before v1.0
- **The Hard Problem**: Single most challenging architectural issue

---

### 5. ANTI-PATTERNS TO AVOID

**Code Critique Anti-Patterns:**
- "The DSL could be more concise" (That's a design preference, not a defect)
- "Consider using RxJS for reactivity" (Architecture decision, not bug)
- "TypeScript strict mode would help" (Configuration, not code bug)
- "Tests should use mocks" (Integration tests are intentional)

---

**AUDIT THEATER PROHIBITION**

Do NOT invent issues to appear thorough. This audit values signal over volume.

- **Theoretical vulnerabilities** that require impossible preconditions
- **Padding the report** with stylistic preferences disguised as defects
- **"Could potentially..."** without concrete evidence or reproduction path
- **Flagging working code** because you didn't understand it (ask first)

DO:
- **Raise small issues** if they're real (a small bug is still a bug)
- **Say "no issues found"** for a section if that's the truth
- **Admit uncertainty** — "I couldn't verify X because Y" is valid
- **Prioritize build/test failures** — if it doesn't build or test, nothing else matters

**The measure of a good audit is accuracy, not line count.**

---

### 6. OUTPUT LOCATION

**Before writing the audit report:**

1. Create a dated folder with sequence: `research/audit/YYYY-MM-DD-NNN/`
2. Create the audit file inside: `research/audit/YYYY-MM-DD-NNN/composer-audit.md`

**Folder naming:**
- First audit of the day: `research/audit/2026-02-03-001/`
- If folder exists, increment: `research/audit/2026-02-03-002/`

**Check existing folders** in `research/audit/` to determine the next sequence number.

---

### 7. OUTPUT FORMAT

For each finding:

```
[SEVERITY] [CATEGORY]: Brief Title
Location: file.ts:line

Evidence:
```typescript
// The problematic code
```

Violation: What spec/requirement is violated
Impact: What could go wrong in production
Remediation: Exact fix required
```

**Severity Levels:**
- **CRITICAL**: Build failure, import breakage, data corruption
- **HIGH**: Test failure, spec deviation, missing error handling
- **MEDIUM**: State inconsistency risk, suboptimal patterns
- **LOW**: Documentation, style (only if masking bugs)

---

### 8. EXECUTION CHECKLIST

- [ ] Run `pnpm build` and capture output
- [ ] Run `pnpm test` and capture output
- [ ] Read `Clip.ts` — check for legacy imports
- [ ] Read `SynapticClip.ts` — verify SynapticNode extension
- [ ] Read `ComposerCursor.ts` — verify pending-state pattern
- [ ] Read `SynapticNoteCursor.ts` — verify relay/escape behavior
- [ ] Read `SymphonyEngine.ts` — verify AudioWorklet integration
- [ ] Cross-reference RFC-049 requirements
- [ ] Scan cursor hot paths for allocations
- [ ] Check all cross-package imports resolve
- [ ] Generate findings report

---

**CONFIRM that you have read `SynapticClip.ts` and `ComposerCursor.ts` before proceeding.**

Begin audit. Accept nothing. Question everything.
