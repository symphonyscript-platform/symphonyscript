# Composer Remediation Tasks

**Created:** 2026-02-06  
**Source:** [001-composer-audit.md](../audit/001-composer-audit.md)  
**Plan:** [002-remediation-plan.md](../audit/002-remediation-plan.md)

---

## Task Summary

| ID | Task | Priority | Category | Status |
|----|------|----------|----------|--------|
| 050 | [Extract SCALE_INTERVALS](050-extract-scale-intervals.md) | LOW | DRY | Open |
| 051 | [Implement Arpeggio System](051-implement-arpeggio-system.md) | HIGH | Dead Code | Open |
| 052 | [Implement Vibrato LFO](052-implement-vibrato-lfo.md) | HIGH | Dead Code | Open |
| 053 | [Document voiceMovementCost](053-document-voice-movement-cost.md) | LOW | Docs | Open |
| 054 | [Implement Loop Region](054-implement-loop-region.md) | MEDIUM | Dead Code | Open |
| 055 | [Add Allocation Policy Docs](055-add-allocation-policy-docs.md) | LOW | Docs | Open |

---

## Implementation Order

1. **Task 050** (5 min) — Extract SCALE_INTERVALS (prerequisite)
2. **Task 051** (30 min) — Arpeggio system (critical)
3. **Task 052** (30 min) — Vibrato LFO (critical)
4. **Task 054** (20 min) — Loop region
5. **Task 053** (5 min) — Document voiceMovementCost
6. **Task 055** (5 min) — Allocation policy docs

**Total Estimate:** ~95 minutes

---

## Priority Legend

- **HIGH** — Critical dead code that misleads users
- **MEDIUM** — Functional gaps
- **LOW** — Documentation and cleanup
