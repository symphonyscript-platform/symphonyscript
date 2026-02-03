# SYNAPTIC AUDIT PROTOCOL — ZERO TRUST

READ `packages/synaptic/src/SynapticNode.ts` AND `packages/synaptic/src/SynapticCursor.ts`.
CONFIRM that you have read both files.
THEN:

---

## 🛑 ROLE: HOSTILE SYNAPTIC AUDITOR 🛑

### 1. CRITICAL CONTEXT — READ FIRST

The `@symphonyscript/synaptic` package is the **NEURAL TOPOLOGY LAYER** of SymphonyScript. It sits between the low-level kernel (`@symphonyscript/kernel`) and the high-level DSL/user-facing APIs.

The execution model is:

1. **SynapticNode (Main Thread)**: Abstract base for topology construction. Manages entry/exit IDs, phase barriers, synapse connections. Allocation is acceptable here.
2. **SynapticCursor (Audio Thread)**: Playback cursor with stochastic branching. Traverses the Synapse Table at audio-rate. **ZERO-ALLOCATION is MANDATORY** in hot paths.

**Architectural Position:**

```
┌─────────────────────────────────────────────────────────────┐
│                     User DSL / API                          │
├─────────────────────────────────────────────────────────────┤
│                 @symphonyscript/synaptic                    │
│  ┌──────────────────────┐  ┌──────────────────────────────┐│
│  │   SynapticNode       │  │   SynapticCursor             ││
│  │   (Main Thread)      │  │   (Audio Thread)             ││
│  │   - Topology mgmt    │  │   - Stochastic selection     ││
│  │   - Phase barriers   │  │   - Jitter application       ││
│  │   - Synapse creation │  │   - Quota enforcement        ││
│  └──────────────────────┘  └──────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                   @symphonyscript/kernel                    │
│                 (SharedArrayBuffer, Atomics)                │
└─────────────────────────────────────────────────────────────┘
```

**🛑 What This Means for Your Assessment**

✅ **IN SCOPE:**
- **State Consistency**: Entry/Exit IDs correctly track topology
- **Kernel Integration**: Correct use of SiliconBridge APIs
- **Audio Thread Safety**: SynapticCursor must be zero-allocation
- **PRNG Correctness**: Deterministic, reproducible randomness
- **Error Handling**: Failures propagate correctly, no silent corruption
- **RFC Compliance**: Implementation matches RFC-045, RFC-054

❌ **OUT OF SCOPE (Do Not Critique):**
- Kernel internals (that's audited separately)
- High-level API ergonomics (unless causing correctness issues)
- Test code allocations (test helpers are allowed to allocate)
- Build tooling, bundling, or packaging

---

**🛑 CHECKPOINT: SynapticNode is ALLOWED to allocate. SynapticCursor is NOT. Do not conflate their constraints.**

---

### 2. MANDATE

You are a **Hostile Synaptic Auditor** with no prior involvement in this design. Assume every line of code is guilty until proven innocent.

**AXIOMS:**
1. **Zero Trust**: Verify everything. Assume nothing works.
2. **Zero Tolerance**: Deviations from sound specifications are defects.
3. **Audio Thread Purity**: SynapticCursor hot paths must allocate ZERO objects.
4. **State Integrity**: Topology state must never become inconsistent.
5. **Kernel Contract**: All SiliconBridge calls must follow the kernel's API contract.

**MANDATE:** Identify flaws that could cause:
1. **State Corruption**: Entry/Exit IDs out of sync, dangling barriers
2. **Audio Glitches**: Allocations in SynapticCursor hot paths
3. **Non-Determinism**: PRNG producing unpredictable sequences
4. **Silent Failures**: Errors swallowed without propagation
5. **Kernel Contract Violations**: Incorrect use of SiliconBridge APIs

Do not offer praise. Be harsh but fair.

---

### 3. THE SYSTEM UNDER AUDIT

**Package:** `@symphonyscript/synaptic`
**Location:** `packages/synaptic/src/`

**Core Components:**

| File | Responsibility | Thread Context | Allocation Allowed |
|------|----------------|----------------|-------------------|
| `SynapticNode.ts` | Abstract topology node, manages entry/exit IDs, phase barriers | Main Thread | ✅ YES |
| `SynapticCursor.ts` | Playback cursor, stochastic selection, jitter | Audio Thread | ❌ NO (hot paths) |
| `index.ts` | Public exports | N/A | N/A |

**Key Abstractions:**

| Concept | Description | Critical Invariant |
|---------|-------------|-------------------|
| Entry ID | First node's sourceId (input/dendrite) | Must be set when content exists |
| Exit ID | Last node's sourceId (output/axon) | Must track chain tail correctly |
| Barrier ID | OPCODE.BARRIER node for phase locking | Must be removed when cycle disabled |
| Write ID | Last content node (for splicing) | Used for BARRIER insertion point |
| Candidate Arrays | SoA storage for synapse resolution | Pre-allocated, fixed size (64) |

**RFCs to Cross-Reference:**
- RFC-045: Synapse Table (Section 4.1 - Synaptic Resolution)
- RFC-054: Native Phase Locking (BARRIER opcode, setCycle semantics)

---

### 4. REQUIRED ASSESSMENT STRUCTURE

You **MUST** structure your report into these sections:

#### A. State Consistency Audit (SynapticNode)

1. Verify `entryId` is set on first content addition
2. Verify `exitId` always tracks the chain tail
3. Verify `barrierId`/`barrierPtr` are cleaned up when cycle is disabled
4. Verify `writeId` correctly tracks insertion point
5. Check for states where IDs can become undefined unexpectedly

**Deliverable:** State transition diagram with invariant verification

#### B. Kernel Integration Audit

For EACH SiliconBridge call:
1. Verify correct method is used (sync vs async)
2. Verify error handling for negative return codes
3. Verify pointer validity before use
4. Verify sourceId validity before use

**Critical Methods to Verify:**
- `bridge.connect()` / `bridge.connectAsync()`
- `bridge.disconnect()` / `bridge.disconnectAsync()`
- `bridge.insertAsync()`
- `bridge.deleteAsync()`
- `bridge.patchDirect()`
- `bridge.getNodePtr()`
- `bridge.generateSourceId()`

**Deliverable:** Bridge call audit table (method × error handling × correctness)

#### C. Audio Thread Safety (SynapticCursor)

Scan `SynapticCursor.ts` for:
- Object literals `{}` in methods (not constructor)
- Array literals `[]` in methods (not constructor)
- `new` keyword after constructor
- Arrow functions as callbacks in hot paths
- `for...of` loops (allocate iterators)
- `throw` statements in hot paths
- `try/catch` blocks in hot paths

**Hot Path Methods:**
- `resolveSynapseWithCallback()`
- `collectCandidates()`
- `selectWinner()`
- `findHeadSlot()`
- `nextRandom()`

**Deliverable:** Zero-allocation compliance matrix

#### D. PRNG Correctness

1. Verify xorshift32 implementation is correct
2. Verify seed handling (zero seed → 1)
3. Verify determinism (same seed → same sequence)
4. Verify distribution is reasonably uniform

**Deliverable:** PRNG correctness verdict

#### E. Specification Analysis (Dual-Layer Audit)

**Layer 1: Does the implementation match the RFC?**
- RFC-045 Section 4.1: Synaptic Resolution algorithm
- RFC-054: BARRIER semantics, setCycle behavior

**Layer 2: Is the RFC itself sound?**
- Are edge cases defined?
- Are failure modes specified?
- Are timing guarantees clear?

**Possible Verdicts:**
| Implementation | RFC | Verdict |
|----------------|-----|---------|
| Correct | Sound | ✅ PASS |
| Correct | Weak | ⚠️ SPEC_DEBT — RFC needs tightening |
| Deviates | Sound | 🔴 IMPL_BUG — Code must change |
| Deviates | Weak | 🟡 AMBIGUOUS — Clarify spec first, then fix |

**Deliverable:** Requirement → Implementation → RFC Quality → Verdict table

#### F. Error Handling Coverage

For EACH potential failure point:
1. What happens on failure?
2. Is the error propagated or swallowed?
3. Is state left consistent after failure?

**Deliverable:** Error handling audit table

#### G. Final Verdict

- **Grade**: A–F based on production readiness
- **Critical Defects**: Must-fix before release
- **High Defects**: Should-fix before v1.0
- **The Hard Problem**: Single most challenging issue for this layer

---

### 5. ANTI-PATTERNS TO AVOID

**Code Critique Anti-Patterns:**
❌ "SynapticNode should be more functional" (It's intentionally stateful)
❌ "The cursor should use a class for candidates" (SoA is intentional for zero-alloc)
❌ "This could be more TypeScript-idiomatic" (Performance trumps idioms)
❌ "Consider using async/await" (Audio thread cannot await)

---

**🛑 AUDIT THEATER PROHIBITION 🛑**

Do NOT invent issues to appear thorough. This audit values signal over volume.

❌ **Theoretical vulnerabilities** that require impossible preconditions
❌ **Padding the report** with stylistic preferences disguised as defects
❌ **"Could potentially..."** without concrete evidence or reproduction path
❌ **Flagging working code** because you didn't understand it (ask first)
❌ **Conflating SynapticNode and SynapticCursor constraints**

✅ **DO raise small issues** if they're real (a small bug is still a bug)
✅ **DO say "no issues found"** for a section if that's the truth
✅ **DO admit uncertainty** — "I couldn't verify X because Y" is valid

**The measure of a good audit is accuracy, not line count.**

---

### 6. OUTPUT LOCATION

**Before writing the audit report:**

1. Create a dated folder with sequence: `research/audit/YYYY-MM-DD-NNN/`
2. Create the audit file inside: `research/audit/YYYY-MM-DD-NNN/synaptic-audit.md`

**Folder naming:**
- First audit of the day: `research/audit/2026-01-30-001/`
- If folder exists, increment: `research/audit/2026-01-30-002/`

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
- **CRITICAL**: State corruption, audio glitches, kernel contract violation
- **HIGH**: Spec deviation, missing error handling
- **MEDIUM**: Suboptimal patterns, unclear invariants
- **LOW**: Documentation, style (only if masking bugs)

---

### 8. EXECUTION CHECKLIST

- [ ] Read `SynapticNode.ts` completely
- [ ] Read `SynapticCursor.ts` completely
- [ ] Read test files for coverage understanding
- [ ] Verify state consistency in SynapticNode
- [ ] Audit every SiliconBridge call
- [ ] Scan SynapticCursor for allocations
- [ ] Verify PRNG implementation
- [ ] Cross-reference RFC-045, RFC-054
- [ ] Check error handling completeness
- [ ] Run test suite, capture output
- [ ] Generate findings report

---

**CONFIRM that you have read `SynapticNode.ts` and `SynapticCursor.ts` before proceeding.**

Begin audit. Accept nothing. Question everything.
