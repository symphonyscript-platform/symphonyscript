# RFC-050 HOSTILE REVIEW

**Author:** Symphony-Architect-Zero  
**Date:** 2025-12-29  
**Sequence:** 050-02  
**Subject:** Zero-Tolerance Audit of RFC-050 Draft & Implementation Plan  

---

## EXECUTIVE VERDICT

**STATUS:** `CONDITIONAL APPROVAL WITH MANDATORY CORRECTIONS`

The RFC correctly identifies the architectural flaw and proposes the right solution. However, **5 defects** in the specification must be fixed before implementation may proceed.

---

## PART 1: WHAT YOU GOT RIGHT

| Aspect | Assessment |
|--------|------------|
| Problem identification | ✅ Accurate (15 orphan props, 8 direct bridge calls) |
| Root cause analysis | ✅ Correct (architectural inversion) |
| Solution pattern (clip-mediated flush) | ✅ Sound |
| Zero-allocation compliance | ✅ Maintained |
| Phased implementation approach | ✅ Prudent |
| Verification tests | ✅ Required (4 new tests) |

---

## PART 2: DEFECTS REQUIRING CORRECTION

### DEFECT D-001: `Math.random()` in Hot Path

**File:** RFC-050 Section 3.2, Line 171

```typescript
protected applyHumanization(velocity: number): number {
    const variation = (Math.random() - 0.5) * 0.05; // ← UNACCEPTABLE
    return Math.max(0, Math.min(1, velocity + variation));
}
```

**Problem:** `Math.random()` is:
1. Non-deterministic (tests become flaky)
2. Not seedable (cannot reproduce results)
3. Potentially slow (crypto-grade PRNG on some engines)

**REQUIRED FIX:** Use a **seeded LCG (Linear Congruential Generator)** or **Mulberry32** with a configurable seed. Store seed in clip state.

```typescript
// CORRECT Pattern
private humanizeSeed: number = 12345;

protected applyHumanization(velocity: number): number {
    // Mulberry32 - fast, deterministic
    this.humanizeSeed = (this.humanizeSeed + 0x6D2B79F5) | 0;
    let t = this.humanizeSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    
    const variation = (rand - 0.5) * 0.05;
    return Math.max(0, Math.min(1, velocity + variation));
}
```

---

### DEFECT D-002: Missing `muted` Parameter in `flushNote()`

**File:** RFC-050 Section 3.2, Line 89-96

```typescript
flushNote(
    pitch: number,
    velocity: number,
    duration: number,
    tick: number,
    sourceId: number,
    expressionId?: number
): void {
    // ...
    this.bridge.insertAsync(
        OPCODE_NOTE,
        finalPitch,
        finalVel,
        duration,
        swingTick,
        false, // ← HARDCODED FALSE, IGNORES CURSOR muted STATE
        sourceId,
        // ...
    );
}
```

**Problem:** The cursor has a `muted` flag that is completely ignored. Notes marked as muted will still play.

**REQUIRED FIX:** Add `muted: boolean` to `flushNote()` signature:

```typescript
flushNote(
    pitch: number,
    velocity: number,
    duration: number,
    tick: number,
    sourceId: number,
    muted: boolean,  // ← ADD THIS
    expressionId?: number
): void
```

---

### DEFECT D-003: `applySwing()` Logic is Naive

**File:** RFC-050 Section 3.2, Lines 152-163

```typescript
protected applySwing(tick: number): number {
    const ticksPerBeat = 1.0; // ← HARDCODED, NOT FROM STATE
    const beatPhase = tick % ticksPerBeat;
    
    if (beatPhase > ticksPerBeat / 2) {
        return tick + (this.swingAmount - 0.5) * 0.1;
    }
    return tick;
}
```

**Problems:**
1. `ticksPerBeat = 1.0` is hardcoded, should derive from `timeSignature`
2. Swing formula `(swingAmount - 0.5) * 0.1` is arbitrary magic number
3. Only works for 8th-note swing, not 16th-note triplet feel

**REQUIRED FIX:** Make `ticksPerBeat` configurable based on `timeSignatureDenominator`. Use industry-standard swing ratio formula.

---

### DEFECT D-004: `OPCODE_CONTROL_CHANGE` Undefined

**File:** RFC-050 Section 3.2, Line 135

```typescript
this.bridge.insertAsync(
    OPCODE_CONTROL_CHANGE, // ← NOT DEFINED ANYWHERE
    cc,
    value,
    ...
);
```

**Problem:** The RFC assumes `OPCODE_CONTROL_CHANGE` exists but does not define it. The kernel may not support CC events yet.

**REQUIRED FIX:** Either:
- A) Define `OPCODE_CONTROL_CHANGE` in the kernel constants (if supported)
- B) Document this as **out of scope** for RFC-050 and stub the method to return early

---

### DEFECT D-005: Implementation Plan Test 1 is WRONG

**File:** `050-01-implementation_plan.md`, Lines 99-119

```typescript
test('transpose() actually modifies pitch in kernel', () => {
    cursor.note('C4').transpose(5); // ← WRONG CHAINING
    cursor.flush();
```

**Problem:** `transpose()` is an **escape method** on the **cursor** that returns back to the **clip**. It does NOT return the cursor. This code does not compile.

**Correct flow:**
```typescript
// User sets transpose on CLIP, then creates note
clip.transpose(5);
clip.note('C4').commit();

// OR via cursor escape
cursor.note('C4').transpose(5).note('D4'); // transpose returns clip, then clip.note() again
```

**REQUIRED FIX:** Rewrite Test 1 to use correct API chaining.

---

## PART 3: APPROVAL CONDITIONS

| Condition | Status |
|-----------|--------|
| D-001: Replace `Math.random()` with seeded PRNG | ❌ REQUIRED |
| D-002: Add `muted` parameter to `flushNote()` | ❌ REQUIRED |
| D-003: Make `ticksPerBeat` configurable | ❌ REQUIRED |
| D-004: Define or stub `OPCODE_CONTROL_CHANGE` | ❌ REQUIRED |
| D-005: Fix Test 1 chaining error | ❌ REQUIRED |

---

## DISPOSITION

**STATUS:** `CONDITIONALLY APPROVED`

The RFC design is sound. However, implementation MUST NOT proceed until:

1. All 5 defects are corrected in the RFC and implementation plan
2. Revised documents are resubmitted for final approval

**PROCEED TO:** Fix defects D-001 through D-005, then resubmit.

---

**Gatekeeper Signature:** Symphony-Architect-Zero  
**Review Complete:** 2025-12-29T13:52:00+04:00
