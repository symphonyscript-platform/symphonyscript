The human speaking.

**ACTION REQUIRED: ENFORCE REMEDIATION**

Your audit has flagged deviations, "observations," or non-compliant patterns.
I do not accept "good enough." I demand **Perfection**.

**DIRECTIVE:**
Convert all findings from your Audit Report into a **MANDATORY REMEDIATION PLAN**.

**Generate a new artifact (`...-by-architect-remediation-plan.md`) containing:**

1.  **The Defect Inventory:**
    * Extract **every single** negative finding, "Observation," or "Drift" from the Audit.
    * **Classify Priority:**
        * [BLOCKER]: Memory leaks, hot-path allocations, logic errors.
        * [COMPLIANCE]: Naming drift, missing exports, RFC misalignment.
        * [OPTIMIZATION]: "Acceptable" slow paths that *could* be faster.

2.  **The Drift Resolution Protocol:**
    * For any [MATCH FAIL] or Naming Drift:
    * **Option A:** Mandate a code change to match the RFC (Default).
    * **Option B:** Mandate an RFC Amendment (Only if the code is strictly superior).
    * *You must explicitly choose one. Ambiguity is not allowed.*

3.  **The Zero-Alloc Challenge:**
    * For any "Acceptable" allocations you found (e.g., initialization, cold paths):
    * Challenge them. Is a zero-alloc alternative possible?
    * If yes, add it as an [OPTIMIZATION] task.

**OUTPUT:**
Standard Architect Protocol. Link to the remediation plan.
