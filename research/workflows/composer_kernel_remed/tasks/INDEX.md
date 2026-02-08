# Composer & Kernel Remediation Tasks

**Parent Plan:** [plan.md](../plan.md)

---

## Execution Order

Tasks must be executed in dependency order:

### Phase 1: Foundation (No Dependencies)

| Task | Priority | Description |
|------|----------|-------------|
| [060](./060-implement-kernel-backpressure.md) | 🔴 CRITICAL | Kernel Backpressure (safety first) |
| [059](./059-refactor-types-enums.md) | 🟠 HIGH | Numeric Enums |
| [069](./069-mark-session-track-design-time.md) | 🟠 HIGH | Mark Session/Track design-time |

### Phase 2: Core Remediation (Depends on Phase 1)

| Task | Priority | Description | Dependencies |
|------|----------|-------------|--------------|
| [057](./057-flatten-synaptic-clip-state.md) | 🔴 CRITICAL | Flatten Clip State | 059 |
| [066](./066-refactor-drums-mapping.md) | 🟠 HIGH | Drums Map Refactor | 059 |
| [070](./070-refactor-key-utils.md) | 🟠 HIGH | Key Utils Refactor | None |
| [068](./068-refactor-groove-builder.md) | 🟠 HIGH | Groove Builder Refactor | None |

### Phase 3: Operations Removal (Depends on Phase 2)

| Task | Priority | Description | Dependencies |
|------|----------|-------------|--------------|
| [058](./058-remove-operations-array.md) | 🔴 CRITICAL | Remove Operations Array | 057 |
| [063](./063-remove-isolate-closures.md) | 🟠 HIGH | Remove isolate() Closures | 057 |
| [067](./067-decide-frozen-clip-fate.md) | 🟠 HIGH | FrozenClip Fate Decision | 058 |

### Phase 4: API Refactoring (Depends on Phase 3)

| Task | Priority | Description | Dependencies |
|------|----------|-------------|--------------|
| [061](./061-refactor-cursors-parallel-hierarchy.md) | 🟠 HIGH | Cursor Parallel Hierarchy | 058, 060 |
| [062](./062-refactor-one-shot-methods.md) | 🟠 HIGH | One-Shot Methods | 058, 060 |
| [064](./064-refactor-chord-voicing-methods.md) | 🔴 CRITICAL | Chord/Voicing Methods | 058 |
| [065](./065-refactor-loop-play-progression.md) | 🟠 HIGH | Loop/Play/Progression | 058 |

---

## Dependency Graph

```
Phase 1 (Foundation)
├─ 060 (Kernel Backpressure) ────────────────────────┐
├─ 059 (Enums) ──────────┬───────────────────────────┤
│                        │                           │
└─ 069 (Session/Track)   │                           │
                         ▼                           │
Phase 2 (Core)           │                           │
├─ 057 (Flatten State) ──┤                           │
├─ 066 (Drums Map) ◄─────┘                           │
├─ 070 (Key Utils)                                   │
└─ 068 (Groove Builder)                              │
         │                                           │
         ▼                                           │
Phase 3 (Operations)                                 │
├─ 058 (Remove Ops) ◄────────────────────────────────┤
├─ 063 (isolate Closures)                            │
└─ 067 (FrozenClip)                                  │
         │                                           │
         ▼                                           ▼
Phase 4 (API)
├─ 061 (Cursors) ◄───────────────────────────────────┘
├─ 062 (One-Shot Methods)
├─ 064 (Chord/Voicing) 
└─ 065 (Loop/Play/Progression)
```

---

## Coverage Matrix

| Violation Source | Covered By |
|------------------|------------|
| SynapticClip.ts operations | 058 |
| SynapticClip.ts state objects | 057 |
| SynapticClip.ts isolate() | 063 |
| SynapticMelody.ts chord arrays | 064 |
| SynapticMelody.ts loop/play/progression | 065 |
| SynapticDrums.ts drum map | 066 |
| FrozenClip.ts | 067 |
| SynapticGrooveBuilder.ts | 068 |
| Session.ts / Track.ts | 069 |
| key.ts | 070 |
| Cursors | 061 |
| One-shot methods | 062 |
| types.ts enums | 059 |
| Kernel backpressure | 060 |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Open |
| 🔄 | In Progress |
| ✅ | Complete |
| ❌ | Blocked |

---

## Current Status

| Task | Status | Phase |
|------|--------|-------|
| 057 | ⬜ | 2 |
| 058 | ⬜ | 3 |
| 059 | ⬜ | 1 |
| 060 | ⬜ | 1 |
| 061 | ⬜ | 4 |
| 062 | ⬜ | 4 |
| 063 | ⬜ | 3 |
| 064 | ⬜ | 4 |
| 065 | ⬜ | 4 |
| 066 | ⬜ | 2 |
| 067 | ⬜ | 3 |
| 068 | ⬜ | 2 |
| 069 | ⬜ | 1 |
| 070 | ⬜ | 2 |
