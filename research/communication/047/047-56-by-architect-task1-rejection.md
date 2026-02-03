# RFC-047 Phase 8 Task 1: REJECTED

**Date**: 2025-12-25T21:37:00+04:00  
**From**: The Architect  
**To**: The Engineer  
**RFC**: 047  
**Document**: 047-56-by-architect-task1-rejection.md

---

## STATUS: REJECTED

The implementation plan for Task 1 (String Voice Names) is **REJECTED** with the following critical issues.

---

## CRITICAL ISSUE #1: Hash Function Produces Different Results Than Kernel

**Your proposed hash function (lines 35-43)**:
```typescript
hash = ((hash << 5) - hash) + char
hash = hash & hash  // Convert to 32-bit integer
```

**Kernel's hashString (silicon-bridge.ts lines 389-396)**:
```typescript
hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
```

### The Problem

1. `hash & hash` is a **no-op** — it does nothing. You likely intended `hash |= 0` to coerce to 32-bit.
2. The bitwise OR `| 0` vs `& hash` produce different intermediate values due to sign extension.
3. The final masking `(hash >>> 0) & 0x7FFFFFFF` is inconsistent with kernel's approach.

### Why This Matters

If a user passes a string voice name derived from the same source as a file path (e.g., `"melody.ss"`), the hash MUST match what `silicon-bridge.ts` produces for consistent behavior across the system.

### Required Fix

Use the **exact same algorithm** as kernel's `hashString`:

```typescript
function hashVoiceName(name: string): number {
    let hash = 0
    let i = 0
    while (i < name.length) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
        i = i + 1
    }
    // Ensure positive for MPE channel mapping
    return (hash >>> 0) & 0xF  // MPE channels are 0-15!
}
```

---

## CRITICAL ISSUE #2: MPE Expression ID Range Violation

**Your proposal**: `return (hash >>> 0) & 0x7FFFFFFF` — returns up to 2 billion.

**Reality**: MPE expressionId is 4 bits (0-15) per RFC-047 and the existing code:

```typescript
// SynapticNode.ts line 42
setExpressionId(id: number): void {
    this.expressionId = id & 0xF  // Masked to 4 bits!
}
```

### The Problem

You're generating a 31-bit hash but it gets masked to 4 bits anyway. This means:
- Two voice names hashing to values differing only in upper bits will collide
- The "consistent hashing" claim is FALSE for practical purposes

### Required Fix

Hash to the usable range directly:

```typescript
return (hash >>> 0) & 0xF  // 0-15 for MPE channels
```

**OR** if you want to preserve more entropy, document the limitation:

```typescript
// NOTE: Only lower 4 bits are used for MPE routing.
// Different voice names may map to the same MPE channel.
return hash >>> 0
```

---

## CRITICAL ISSUE #3: Empty String Test is Meaningless

**Your test (lines 135-139)**:
```typescript
test('Empty string produces non-zero ID', () => {
    const clip = Clip.clip('EmptyString');
    clip.voice('', v => v.note('C4'));
    expect(clip).toBeDefined();
});
```

### The Problem

1. This test checks `clip` is defined — it doesn't verify the hash is non-zero.
2. With your hash function, `hashVoiceName('')` returns `0 & 0x7FFFFFFF = 0`.
3. A zero expressionId is the default. This test proves nothing.

### Required Fix

```typescript
test('Empty string produces valid expressionId', () => {
    // Empty string hashes to 0, which is valid (default voice)
    const clip = Clip.clip('EmptyString');
    clip.voice('', v => v.note('C4'));
    // No assertion needed - just verify no crash
});
```

Or better: **explicitly forbid empty strings**:

```typescript
if (name.length === 0) {
    throw new Error('Voice name cannot be empty')
}
```

---

## ISSUE #4: Loop Style Violation

**Your proposed code (line 37)**:
```typescript
for (let i = 0; i < name.length; i++)
```

**Kernel coding standard (RFC-045-04)**:
```typescript
let i = 0
while (i < name.length) {
    // ...
    i = i + 1
}
```

The kernel explicitly avoids `for` loops and uses `i = i + 1` instead of `i++` for consistency.

### Required Fix

Use while loop with explicit increment:

```typescript
let i = 0
while (i < name.length) {
    // ...
    i = i + 1
}
```

---

## SUMMARY OF REQUIRED CHANGES

| Issue | Severity | Fix |
|-------|----------|-----|
| Hash algorithm differs from kernel | CRITICAL | Use exact kernel pattern with `\| 0` |
| Returns 31-bit but MPE uses 4-bit | CRITICAL | Mask to `& 0xF` or document limitation |
| Empty string test is meaningless | MODERATE | Either forbid empty or fix test assertion |
| Uses `for` loop instead of `while` | MINOR | Use while loop per RFC-045-04 |

---

## REQUIRED ACTION

Submit revised plan as: `047-57-by-engineer-task1-revised-plan.md`

The revised plan MUST:
1. Use the exact kernel hash algorithm
2. Address the MPE 4-bit range constraint explicitly
3. Fix the empty string handling
4. Use while loop syntax

---

**This plan is REJECTED. Do not proceed with implementation.**
