# RFC-051: CC Automation Handler

**Author:** Symphony-Architect-Zero  
**Date:** 2025-12-29  
**Sequence:** 051-00  
**Authority:** RFC-050 D-004 Follow-Up  

---

## PROBLEM STATEMENT

RFC-050 stubbed `flushCCAutomation()` pending AudioWorklet verification.

**Investigation Complete.** CC events are NOT processed because:

```typescript
// processor.ts:83-84
// Only process NOTES for now
if (opcode !== OPCODE.NOTE) return;
```

All `OPCODE.CC` events inserted into the kernel are **silently ignored** by the AudioWorklet processor.

---

## ROOT CAUSE

| Component | Status | Location |
|-----------|--------|----------|
| `OPCODE.CC` constant | ✅ Exists | `kernel/src/constants.ts:390` |
| `SiliconBridge.insertAsync()` | ✅ Supports CC | Uses same signature for all opcodes |
| `SiliconSynapse.readNode()` | ✅ Extracts opcode | `kernel/src/silicon-synapse.ts:770` |
| `SiliconProcessor.traverseCallback()` | ❌ **IGNORES CC** | `web/src/runtime/processor.ts:84` |

---

## REQUIRED CHANGES

### 1. Modify `processor.ts` to Handle CC Events

**File:** [processor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/web/src/runtime/processor.ts)

**Current (Line 83-84):**
```typescript
// Only process NOTES for now
if (opcode !== OPCODE.NOTE) return;
```

**Required:**
```typescript
// Dispatch by opcode
switch (opcode) {
    case OPCODE.NOTE:
        this.handleNote(pitch, velocity, duration, baseTick, flags);
        break;
    case OPCODE.CC:
        this.handleCC(pitch, velocity, baseTick); // pitch = CC#, velocity = value
        break;
    default:
        return; // Ignore unknown opcodes
}
```

### 2. Add CC Handler Method

**Add to `SiliconProcessor` class:**
```typescript
/**
 * Handle Control Change events.
 * @param cc - CC number (0-127)
 * @param value - CC value (0-127)
 * @param tick - Event tick position
 */
private handleCC(cc: number, value: number, tick: number): void {
    // Only process CC events within current block
    if (tick < this.processStartTick || tick >= this.processEndTick) return;
    
    // TODO: Route CC to appropriate destination
    // For now, log for verification
    console.log(`[CC] cc=${cc} value=${value} @tick=${tick}`);
    
    // Example: CC1 = Mod Wheel → could modulate oscillator LFO depth
    // Example: CC7 = Volume → could modulate mainBus gain
    // Implementation depends on synth architecture
}
```

### 3. Uncomment `flushCCAutomation()` in SynapticClip

**File:** [SynapticClip.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/clips/SynapticClip.ts)

**Uncomment lines 131-132 and 177-195** after processor is updated.

### 4. Clean Up Unused Constants

**Remove `OPCODE_NOTE` from:**
- `cursors/SynapticMelodyNoteCursor.ts:8`
- `cursors/SynapticNoteCursor.ts:7`
- `cursors/SynapticChordCursor.ts:7`
- `cursors/SynapticDrumHitCursor.ts:6`

---

## VERIFICATION PLAN

### Test 1: CC Events Reach Processor (Console Log)
```typescript
test('CC events are logged by processor', async () => {
    const bridge = engine.getBridge();
    bridge.insertAsync(OPCODE.CC, 1, 64, 0, 0, false, 1001);
    await engine.play();
    // Wait for 1 audio block
    await new Promise(r => setTimeout(r, 50));
    // Verify console.log output: [CC] cc=1 value=64
});
```

### Test 2: composer flushCCAutomation Integration
```typescript
test('control() CC automation is flushed to kernel', () => {
    const clip = new TestClip(mockBridge);
    clip.control(1, 64);
    clip.flushNote(60, 0.8, 1.0, 0.0, false, 1);
    
    // Assert: bridge.insertAsync called with OPCODE.CC
    expect(mockBridge.insertAsync).toHaveBeenCalledWith(
        OPCODE.CC, 1, 64, 0, 0.0, false, expect.any(Number), undefined, undefined
    );
});
```

---

## ACCEPTANCE CRITERIA

- [ ] `SiliconProcessor.traverseCallback()` dispatches CC events
- [ ] `SiliconProcessor.handleCC()` implemented (console log for now)
- [ ] `SynapticClip.flushCCAutomation()` uncommented
- [ ] 4 unused `OPCODE_NOTE` constants removed
- [ ] All 108 composer tests pass
- [ ] Console shows CC logs during playback

---

## DISPOSITION

**STATUS:** ENGINEER DIRECTIVE

Proceed to implement. Report back when complete.

---

**Architect Signature:** Symphony-Architect-Zero  
**Directive Issued:** 2025-12-29T14:55:00+04:00
