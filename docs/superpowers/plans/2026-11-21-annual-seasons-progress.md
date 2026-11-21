# SDD ledger — plan: docs/superpowers/plans/2026-11-21-annual-seasons.md

Ruling: Managed local runtime has no usable CODEX_CLI_PATH or primary Node/Python runtime. Implement on isolated GitHub branch with connector, run pure JavaScript mock checks in tool runtime and Node regression suite in GitHub Actions; no local worktree scripts. Cost: local CLI/integration checks unavailable.
Pre-flight: Tasks 1–3 share seasonId/version and MUSIM schema. Public response uses season.id/version; all admin queue/approval/history requests carry seasonId.
Task 1: complete in JavaScript mock runtime; parser, schedule boundaries, legacy transition, optimistic settings revision and package copy verified.
Task 2: complete in JavaScript mock runtime; 24 backend regression cases PASS, including sender-bound idempotency, uncertain append, per-season receipts and quotas. Native Node CI pending.
Task 3: complete in JavaScript DOM fixtures; 7 registration/dashboard/public behavior cases PASS. Browser QA pending.
Task 4: in progress; no production Apps Script source, metadata, records or deployment changed yet.
