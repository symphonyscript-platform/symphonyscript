# MICRO-PLAN: RFC-047 Phase 3 - Kernel Polyphony & MPE

**Agent**: Senior TypeScript Systems Engineer  
**Supervisor**: Architect (Zero-Trust Policy)  
**Reference**: [047-13-by-architect-full-phase3-integrated-plan.md](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/research/communication/047-13-by-architect-full-phase3-integrated-plan.md)  
**Status**: DRAFT  
**Date**: 2025-12-25T07:15:00+04:00

---

## 1. OBJECTIVE
Execute Phase 3 of RFC-047, implementing Kernel-level polyphony, MPE support via bit-packing, and pure-integer harmony tools. Adhere strictly to the "Flat & Integrated" architecture defined in the final directive.

## 2. KERNEL IMPLEMENTATION (`@symphonyscript/kernel`)

### 2.1. Constants (`src/constants.ts`)
- **Action**: Update `FLAG` object.
- **Change**:
  ```typescript
  export const FLAG = {
    // ... existing flags ...
    EXPRESSION_SHIFT: 4,
    EXPRESSION_MASK: 0xF0
  } as const
  ```
- **Constraint**: Zero memory overhead (using existing unused bits 4-7).

### 2.2. Scheduler (`src/scheduler.ts`) [NEW FILE]
- **Action**: Create flat utility file.
- **Function**: `getModulatedTime(tick: number, cycle: number): number`
- **Logic**: pure math `tick % cycle` (handling Infinity).

### 2.3. Silicon Bridge (`src/silicon-bridge.ts`)
- **Action**: Update `insertAsync` signature and packing logic.
- **Change**:
  - Accept optional `expressionId` (default 0).
  - Pack into `flags` using `(expressionId << FLAG.EXPRESSION_SHIFT) & FLAG.EXPRESSION_MASK`.

## 3. SYNAPTIC IMPLEMENTATION (`@symphonyscript/synaptic`)

### 3.1. Voice Allocator (`src/VoiceAllocator.ts`) [NEW FILE]
- **Action**: Create Allocator to bridge Theory and Kernel.
- **Imports**: `HarmonyMask`, `unpack` from `@symphonyscript/theory`.
- **Method**:
  ```typescript
  static allocate(mask: number, root: number, callback: (pitch: number) => void): void
  ```
- **Logic**: Unpacks mask, applies root offset, triggers callback for each interval.

### 3.2. Synaptic Node (`src/SynapticNode.ts`)
- **Action**: Add fields for Phase 3 features.
- **Changes**:
  - Add `expressionId` property (default 0).
  - Add `cycle` property (default Infinity).
  - Update `addNote` to pass `expressionId` to Bridge.

## 4. COMPOSER IMPLEMENTATION (`@symphonyscript/composer`)

### 4.1. Synaptic Clip (`src/SynapticClip.ts`)
- **Action**: Expose new capabilities via Fluent API.
- **Changes**:
  - `.harmony(mask: number, root: number, duration?: number)`: Uses `VoiceAllocator`.
  - `.cycle(ticks: number)`: Sets phase-locking loop length.

## 5. TEST STRATEGY

### 5.1. Unit Tests
- **`src/__tests__/scheduler.test.ts`**: Verify `getModulatedTime` math.
- **`src/__tests__/VoiceAllocator.test.ts`**: Verify mask expansion and Theory integration.

### 5.2. Integration Tests
- **`src/__tests__/harmony.test.ts`**: Verify `.harmony()` produces correct note sequence.
- **`src/__tests__/mpe_bitpacking.test.ts`**: Verify flags are correctly packed/unpacked in Kernel.

## 6. EXECUTION STEPS

1.  **Kernel**: Update `constants.ts`, create `scheduler.ts`, update `silicon-bridge.ts`.
2.  **Synaptic**: Create `VoiceAllocator.ts`, update `SynapticNode.ts`.
3.  **Composer**: Update `SynapticClip.ts`.
4.  **Tests**: Create and run all test suites.
5.  **Verify**: Ensure NO filesystem violations and NO string parsing in harmony path.

---

**Engineer Signature**: Senior TypeScript Systems Engineer  
**Awaiting**: Architect Approval
