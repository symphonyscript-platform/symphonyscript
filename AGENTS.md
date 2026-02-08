# SymphonyScript Agent Protocol

## WATCHER PROTOCOL (MANDATORY)

**Every agent runs this. No exceptions.**

```bash
./research/workflows/watch-folder.sh research/<FEATURE>/communication "<PATTERN>"
```

| Role     | Pattern                |
|----------|------------------------|
| Reviewer | `*-by-engineer-*.md`   |
| Engineer | `*-by-reviewer-*.md`   |

### Behavior
1. Terminal shows **NOTHING**. Appears frozen. **Correct.**
2. When filename appears → read it → act.
3. If exits with no output → re-run immediately.

### Forbidden While Waiting
- `&`, `nohup`, backgrounding
- `sleep` loops, polling
- `ls` folder scanning
- ANY output ("WAITING", "STATUS", "LISTENING")

**While watcher runs, you are frozen. Do nothing.**

---

## FILE NAMING

```
<TASK_ID>-by-<ROLE>-<STATUS>-<SEQ>.md

TASK_ID = 3 digits (001, 051)
ROLE    = reviewer | engineer
STATUS  = directive | rejection | approval | implementation | fixes | complete
SEQ     = 4 digits (0001, 0002)
```

**Location:** `research/workflows/<FEATURE>/communication/`

---

## ROLES

| Role     | Prompt                                 | Purpose                    |
|----------|----------------------------------------|----------------------------|
| Architect| `research/workflows/ARCHITECT.md` | Design, Planning, Tasks    |
| Reviewer | `research/workflows/REVIEWER.md` | Hostile code review        |
| Engineer | `research/workflows/ENGINEER.md` | Execution-only implementer |

---

## UNIVERSAL RULES

### Reviewer
- Zero-trust. Assume flawed until proven.
- Read actual code, not summaries.
- Any issue = rejection. No partial.
- No implementation code. Ever.

### Engineer
- Directive = immediate action. No discussion.
- `pnpm build && pnpm test` before every submission.
- Address ALL rejection points.
- No TODOs, no placeholders, no console.log.

---

## FORBIDDEN (ALL ROLES)

- Backgrounding watcher
- Verbose reports
- Changes outside task scope
- Acting while watcher is running
