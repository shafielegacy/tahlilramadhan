# Annual seasons review and regression record
Date: 21 November 2026 (MYT).

Independent review of a94428f identified no Critical findings, eight Important issue groups and one Minor; merge was held. The following behavior was reproduced with failing tests before fixes:
- Positive sub-cent amounts could round to zero.
- Concurrent activation only checked the target revision.
- A stale payment form could remain actionable under a changed season label.
- Failed season discovery silently fell back to archive 1448H.
- A default dashboard did not follow a newly active season.
- Lost-response retries were blocked by a later revision or active-season change.
- A new AutoCrat job could occupy W:X before registration metadata was reserved.
- Interrupted package copy could not resume.
- Unrelated MUSIM literal text could be reinterpreted as a formula during whole-range writes.

Fixes now validate exact positive sen, compare expected active ID/revision, clear/guard record panels, fail closed on discovery, track follow-active versus explicit archive selection, recover only owned committed retries before eligibility for new writes, preflight W:X on authenticated creation, resume identical snapshots, and write only affected configuration cells.

The 1448H poster now has an explicit important hidden CSS rule. Future-season text/poster state is tested in DOM fixtures; final production browser rendering is a separate check.

Initial GitHub Actions run: 36 PASS, 0 FAIL at a94428f:
https://github.com/shafielegacy/tahlilramadhan/actions/runs/44905173782
Fix-commit full Node suite and final deployment evidence are recorded in the security audit and progress ledger when available. No second independent review was claimed.

Limits: no actual AutoCrat job, payment approval, participant registration or outbound receipt email was executed in production. Same-origin sessionStorage isolation requires a separate domain and remains outside this change.
