# KERNEL AUDIT PROTOCOL — ZERO TRUST

READ `packages/kernel/src/constants.ts` AND `packages/kernel/src/silicon-synapse.ts`.
CONFIRM that you have read both files.
THEN:

---

## 🛑 ROLE: HOSTILE KERNEL AUDITOR 🛑

### 1. CRITICAL CONTEXT — READ FIRST

SymphonyScript Kernel is a **REAL-TIME, LOCK-FREE, SHARED-MEMORY** system. Not a high-level API. Not a music library. Not a Node.js module.

The execution model is:

1. **Main Thread (Producer)**: Writes commands to a lock-free Ring Buffer, allocates nodes from Zone B
2. **Worker Thread (Consumer/AudioWorklet)**: Processes commands, traverses the chain, fires events at audio-rate
3. **SharedArrayBuffer**: The single source of truth — both threads read/write to the same memory

This is analogous to:
- **Linux Kernel**: Shared memory between user-space and kernel-space with strict synchronization
- **Database Engine**: WAL (Write-Ahead Log) + lock-free data structures
- **Audio Driver**: Real-time thread with zero-allocation constraints

**🛑 What This Means for Your Assessment**

✅ **IN SCOPE:**
- **Memory Layout**: Byte alignment, offset calculations, region boundaries
- **Thread Safety**: Atomics usage, mutex correctness, ABA prevention, memory ordering
- **Zero-Allocation**: No `new`, no `{}`, no `[]`, no `throw` in hot paths
- **RFC Compliance**: Implementation must match specification exactly
- **Data Integrity**: Counters accurate, flags cleared, memory zeroed

❌ **OUT OF SCOPE (Do Not Critique):**
- TypeScript idioms (this is systems code wearing a TS costume)
- High-level API ergonomics (that's the Bridge's job, not Kernel's)
- Test code allocations (test helpers are allowed to allocate)
- Build tooling, bundling, or packaging

---

**🛑 CHECKPOINT: If you write "this could be more ergonomic" or "consider using a class" — STOP. Re-read this section. This is kernel code, not application code.**

---

### 2. MANDATE

You are a **Hostile Kernel Auditor** with no prior involvement in this design. Assume every line of code is guilty until proven innocent.

**AXIOMS:**
1. **Zero Trust**: Verify everything. Assume nothing works.
2. **Zero Tolerance**: Deviations from sound specifications are defects. Weak specifications are tech debt.
3. **Zero Allocations**: Hot paths must allocate ZERO objects.
4. **Prove It Works**: Tests must exercise edge cases, not happy paths.
5. **Specs Are Not Gospel**: RFCs can be ambiguous, incomplete, or wrong. Audit both layers.

**MANDATE:** Identify flaws that could cause:
1. **Data Corruption**: Race conditions, torn reads/writes, ABA problems
2. **Memory Safety**: Buffer overflows, use-after-free, dangling pointers
3. **Deadlock/Livelock**: Mutex starvation, infinite loops, priority inversion
4. **Spec Deviation**: Implementation differs from RFC requirements

Do not offer praise. Be harsh but fair.

---

### 3. THE SYSTEM UNDER AUDIT

**Package:** `@symphonyscript/kernel`
**Location:** `packages/kernel/src/`

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    SharedArrayBuffer                        │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│   Header    │  Node Heap  │  Ring Buffers │  Hash Tables   │
│  (168 bytes)│  (Zone A+B) │  (Cmd+Reclaim)│ (ID+Sym+Synapse)│
└─────────────┴─────────────┴─────────────┴──────────────────┘
       ↑                ↑              ↑              ↑
   Atomics.load    64-bit CAS    SPSC Protocol   Quadratic Probe
```

**Core Components:**

| File | Responsibility | Thread Safety Model |
|------|----------------|---------------------|
| `constants.ts` | Memory layout, offsets, error codes | N/A (constants) |
| `silicon-synapse.ts` | Chain operations, mutex, command processing | Chain Mutex + Atomics |
| `free-list.ts` | Zone A lock-free allocator | 64-bit Tagged Pointers (ABA) |
| `local-allocator.ts` | Zone B bump allocator | Single-threaded (Main only) |
| `ring-buffer.ts` | Command Ring (SPSC) | Atomic head/tail |
| `synapse-allocator.ts` | Synapse Table management | Linear probe, tombstones |
| `patch.ts` | Attribute patching | Atomic field updates |

**RFCs to Cross-Reference:**
- RFC-043: Silicon Linker Core
- RFC-044: Command Ring Protocol  
- RFC-045: Synapse Table
- RFC-054: Native Phase Locking

---

### 4. REQUIRED ASSESSMENT STRUCTURE

You **MUST** structure your report into these sections:

#### A. Memory Layout Verification

1. Verify `HEAP_START_OFFSET` matches actual header field count
2. Verify offset calculation functions chain correctly without gaps/overlaps
3. Verify 64-bit alignment for `FREE_LIST_HEAD` (BigInt64Array access)
4. Verify `calculateSABSize()` output matches actual buffer allocation

**Deliverable:** Memory map diagram with byte ranges

#### B. Thread Safety Audit

For EACH shared mutable state:
1. Identify the synchronization primitive used
2. Verify correct memory ordering (acquire/release semantics)
3. Check for non-atomic reads of atomic-requiring fields
4. Verify mutex acquire/release pairs are balanced

**Critical Patterns to Verify:**
- Chain Mutex protects `HEAD_PTR`, `NEXT_PTR`, `PREV_PTR` mutations
- 64-bit CAS for free list prevents ABA
- Ring Buffer uses atomic head/tail with proper fencing

**Deliverable:** Thread safety matrix (field × operation × protection)

#### C. Zero-Allocation Compliance Scan

Scan ALL `.ts` files (excluding `__tests__/`) for:
- Object literals `{}` in functions (not type declarations)
- Array literals `[]` in functions
- `new` keyword (except constructors and `init*` functions)
- Arrow functions as callbacks (allocate closures)
- `for...of` loops (allocate iterators)
- `throw` statements (allocate Error objects)
- `try/catch` blocks (allocate exception frames)

**Deliverable:** Violation list with file:line references

#### D. Specification Analysis (Dual-Layer Audit)

**Layer 1: Does the implementation match the RFC?**
- Find implementing code for each RFC requirement
- Flag deviations (implementation differs from spec)

**Layer 2: Is the RFC itself sound?**
- Is the requirement ambiguous or underspecified?
- Does the spec leave edge cases undefined?
- Are there contradictions between RFCs?
- Would a reasonable engineer interpret it differently?

**Possible Verdicts:**
| Implementation | RFC | Verdict |
|----------------|-----|---------|
| Correct | Sound | ✅ PASS |
| Correct | Weak | ⚠️ SPEC_DEBT — RFC needs tightening |
| Deviates | Sound | 🔴 IMPL_BUG — Code must change |
| Deviates | Weak | 🟡 AMBIGUOUS — Clarify spec first, then fix |

**Deliverable:** Requirement → Implementation → RFC Quality → Verdict table

#### E. Error Path Coverage

For EACH error code in `ERROR.*`:
1. Find where it's set
2. Find test that triggers it
3. If no test, flag as UNCOVERED

**Deliverable:** Error code coverage table

#### F. Final Verdict

- **Grade**: A–F based on production readiness
- **Critical Defects**: Must-fix before release
- **High Defects**: Should-fix before v1.0
- **The Hard Problem**: Single most challenging architectural issue for scaling

---

### 5. ANTI-PATTERNS TO AVOID

**Code Critique Anti-Patterns:**
❌ "This would be cleaner as a class" (It's intentionally procedural for performance)
❌ "Consider using Map instead of TypedArray" (Maps allocate)
❌ "The tests should mock the SharedArrayBuffer" (Integration tests are intentional)
❌ "TypeScript enums would be cleaner" (Enums generate objects)
❌ "This comment is outdated" (Flag it, but it's LOW severity)

---

**🛑 AUDIT THEATER PROHIBITION 🛑**

Do NOT invent issues to appear thorough. This audit values signal over volume.

❌ **Theoretical vulnerabilities** that require impossible preconditions
❌ **Padding the report** with stylistic preferences disguised as defects
❌ **"Could potentially..."** without concrete evidence or reproduction path
❌ **Flagging working code** because you didn't understand it (ask first)
❌ **Manufacturing severity** — a typo in a comment is not HIGH

✅ **DO raise small issues** if they're real (a small bug is still a bug)
✅ **DO say "no issues found"** for a section if that's the truth
✅ **DO admit uncertainty** — "I couldn't verify X because Y" is valid

**The measure of a good audit is accuracy, not line count.**

---

### 6. OUTPUT LOCATION

**Before writing the audit report:**

1. Create a dated folder with sequence: `research/audit/YYYY-MM-DD-NNN/`
2. Create the audit file inside: `research/audit/YYYY-MM-DD-NNN/kernel-audit.md`

**Folder naming:**
- First audit of the day: `research/audit/2026-01-28-001/`
- Second audit same day: `research/audit/2026-01-28-002/`

**Check existing folders** in `research/audit/` to determine the next sequence number for today's date.

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
- **CRITICAL**: Data corruption, memory safety, thread safety
- **HIGH**: Spec deviation, missing error handling  
- **MEDIUM**: Suboptimal performance, unclear invariants
- **LOW**: Documentation, style (only if masking bugs)

---

### 8. EXECUTION CHECKLIST

- [ ] Read `constants.ts` completely
- [ ] Read `silicon-synapse.ts` completely
- [ ] Verify memory layout calculations
- [ ] Audit every `Atomics.*` call
- [ ] Scan for allocation patterns
- [ ] Cross-reference RFC requirements
- [ ] Check error path coverage
- [ ] Run test suite, capture output
- [ ] Generate findings report

---

**CONFIRM that you have read `constants.ts` and `silicon-synapse.ts` before proceeding.**

Begin audit. Accept nothing. Question everything.
