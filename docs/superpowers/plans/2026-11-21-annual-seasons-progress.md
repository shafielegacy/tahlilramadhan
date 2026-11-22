# SDD ledger — plan: docs/superpowers/plans/2026-11-21-annual-seasons.md

Ruling: Managed local runtime has no usable CODEX_CLI_PATH or primary Node/Python runtime. Implement on isolated GitHub branch with connector, run pure JavaScript mock checks in tool runtime and Node regression suite in GitHub Actions; no local worktree scripts. Cost: local CLI/integration checks unavailable.
Pre-flight: Tasks 1–3 share seasonId/version and MUSIM schema. Public response uses season.id/version; all admin queue/approval/history requests carry seasonId.
Task 1: complete in JavaScript mock runtime; parser, schedule boundaries, legacy transition, optimistic settings revision and package copy verified.
Task 2: complete in JavaScript mock runtime; 24 backend regression cases PASS, including sender-bound idempotency, uncertain append, per-season receipts and quotas. Native Node CI pending.
Task 3: complete in JavaScript DOM fixtures; 7 registration/dashboard/public behavior cases PASS. Browser QA pending.
Task 4: in progress; no production Apps Script source, metadata, records or deployment changed yet.

Final review: independent read-only reviewer reviewed a94428f; no Critical, eight Important issue groups and one Minor. Merge held while fixing.
Ruling: upgraded whole-sheet write concern from Minor to Important because re-writing an escaped literal beginning '=' can reinterpret it as a formula. Target only changed cells; cost if wrong: config corruption/formula interpretation.
Ruling: release backend before frontend; remove unproven 1448H fallback on discovery errors. Cost: season controls remain unavailable during a failed rollout rather than showing a potentially wrong archive.
Final: fixed sub-cent payments, competing activation, stale/default archive UI, lost-response recovery, AutoCrat W:X preflight, resumable package copy and hidden-poster CSS. Each behavioral issue reproduced RED, then GREEN; 32 backend and 10 frontend fixture tests PASS. CI full suite pending for fix commit.
Final: fixed whole-sheet rewrite by writing metadata and affected rows only; literal formula regression RED→GREEN.
Deferred minors: none. Actual AutoCrat configuration, shared-origin isolation and full live transaction QA remain explicit release limitations.

## Checkpoint 22 November 2026
Canonical Code.gs c135e374: actual GitHub Actions 47/47 PASS (32 backend, 10 frontend, 5 security guards), final feature log summary inspected. Main CI/Pages success. Existing backend deployment updated to V10 at 20:58 MYT, 21 November; source editor readback matched in full. No transaction or settings save for QA. Frontend main includes visual contrast/touch fix 8a0dbce; CI/Pages success confirmed again 22 November. Mobile 390x844 PASS; final desktop readback/console triage and full documentation reconciliation remain pending. Work paused at user request. See docs/CHECKPOINT_2026-11-22.md for evidence and restart prompt.
