The human speaking. Initiate **FORENSIC AUDIT PROTOCOL**.

**CONTEXT ISOLATION WARNING:**
You are entering a **Clean Room**.
1.  **IGNORE** all previous Context Files in `research/communication/<rfc_number>/`. Do not read them. They are irrelevant history.
2.  **ONLY** list the directory contents to determine the next available sequence number `N`.
3.  Your Output File must be: `<rfc>-<N+1>-by-architect-audit-report.md`

**INPUT DATA:**
1.  **The Immutable Truth (RFC):** `symphonyscript/docs/rfcs/049-synaptic-cursor-architecture.md`
2.  **The Suspect Implementation:** All files in `symphonyscript/packages/composer/src/new`

**DIRECTIVE:**
Compare the *Suspect Implementation* against the *Immutable Truth*. Assume the implementation is fraudulent until proven otherwise.

**GENERATE REPORT ARTIFACT CONTAINING:**

1.  **The Divergence Matrix:**
    * List every exported function/struct in the code.
    * Match it to the RFC spec.
    * Verdict: [MATCH | DRIFT | MISSING].
    * *Constraint:* If DRIFT, you must quote the RFC spec vs. the Code implementation.

2.  **The Memory Audit (Zero-Tolerance):**
    * Scan every loop and hot path.
    * List **any** line numbers containing: `new`, closures `() =>`, array methods (`.map`, `.filter`), or object literals `{}`.
    * Verdict: [CLEAN | DIRTY].

3.  **Integrity Check:**
    * List any `// todo`, `// fixme`, `pass`, or stubbed methods.
    * List any type casts (`as any`, `as unknown`) that bypass safety.

**TOLERANCE LEVEL:**
STRICTLY ZERO-TOLERANCE. ANY deviation from the original RFC -> immediate rejection.
ANY bug, issue, smell, empty method (stub), todo -> immediate rejection.

**TRUST LEVEL:**
STRICTLY ZERO-TRUST. All source files under the provided input are suspected to contain violations,
unless proven otherwise by manual and rigorous review.

**OUTPUT:**
Standard Architect Protocol. Provide the link to the generated document.
