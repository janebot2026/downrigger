# AUDIT_TODO

Master checklist for addressing the repository audit findings. One commit per item.

Legend: [ ] pending, [x] done

- [x] F-001 Prevent overwriting malformed OpenClaw cron config
  - Files: `lib/utils/openclaw-cron.js`, `__tests__/openclaw-cron.malformed.test.js`
  - Planned fix:
    - Validate `HOME` before writing cron config.
    - If `~/.openclaw/cron/jobs.json` exists but is malformed: back it up and abort unless `force=true`.
  - Test plan:
    - `npm test` (new malformed jobs.json test)
    - `npm run lint`
  - Completion note: Backup + abort on malformed `jobs.json` unless forced; added regression test.

- [x] F-002 Honor `--skip-heartbeat` during `init`
  - Files: `lib/commands/init.js`, `__tests__/init.skip-heartbeat.test.js`
  - Planned fix:
    - Gate heartbeat setup behind `if (!options.skipHeartbeat)`.
    - Add a unit test verifying heartbeat setup is skipped.
  - Test plan:
    - `npm test` (new init test)
    - `npm run lint`
  - Completion note: `init` no longer creates `HEARTBEAT.md` when `--skip-heartbeat` is set; added regression test.

- [x] F-003 Make `sync` robust to spaces by avoiding shell string exec
  - Files: `lib/commands/sync.js`, `__tests__/sync.execfile.test.js`
  - Planned fix:
    - Replace `execSync("<path> args")` with `execFileSync(path, [args])`.
    - Add a test that asserts `execFileSync` is used.
  - Test plan:
    - `npm test` (new sync test)
    - `npm run lint`
  - Completion note: `sync` now calls scripts via `execFileSync` (works with spaced paths); added regression test.

- [x] F-004 Validate `HOME` usage consistently in cron-related code
  - Files: `lib/utils/openclaw-cron.js`, `lib/commands/verify.js`, `lib/commands/doctor.js`
  - Planned fix:
    - Centralize/align `HOME` resolution and fail with actionable error when missing.
    - Ensure verify/doctor don’t build paths from empty HOME.
  - Test plan:
    - `npm test`
    - Manual: run `downrigger install cron` with HOME unset (expect clear error)
  - Completion note: Added HOME checks in verify/doctor cron checks and tests covering missing HOME.

- [x] F-005 Resolve install target dir to absolute path
  - Files: `lib/commands/install.js`
  - Planned fix:
    - `path.resolve(options.dir)` before passing to installers.
  - Test plan:
    - `npm test`
    - `npm run lint`
  - Completion note: `install` now resolves `--dir` to an absolute path; added unit test.

- [x] F-006 Make generated `scripts/qmd.sh` relocatable
  - Files: `lib/utils/qmd.js`, `__tests__/qmd-wrapper.integration.test.js`
  - Planned fix:
    - Derive workspace root at runtime from script location.
    - Keep behavior identical when run from within workspace.
  - Test plan:
    - `npm test` (update integration assertions)
    - Manual: move workspace dir and re-run wrapper
  - Completion note: Wrapper now derives workspace root from its own location and avoids hard-coded install paths; updated integration test.

- [x] F-007 Fix `verify --fix` UX: don’t mark non-fixable issues as fixable
  - Files: `lib/commands/verify.js`
  - Planned fix:
    - For core files/scripts checks: mark as non-fixable and provide command to remediate.
    - Keep directory checks fixable.
  - Test plan:
    - `npm test`
    - Manual: `downrigger verify --fix` on partial workspace
  - Completion note: Core files/scripts issues now provide remediation commands and are not marked fixable; added unit tests.

- [x] F-008 Remove unused dependency `inquirer`
  - Files: `package.json`, `package-lock.json`
  - Planned fix:
    - Remove dependency and refresh lockfile.
  - Test plan:
    - `npm test`
    - `npm run lint`
  - Completion note: Removed unused `inquirer` and refreshed lockfile.

- [x] F-009 Fix weekly synthesis tier thresholds + avoid repeated tier computation
  - Files: `lib/utils/scripts.js`, `__tests__/weekly-synthesis.thresholds.test.js`
  - Planned fix:
    - Align accessCount thresholds to README (>=5, >=10).
    - Compute tier once per fact during synthesis.
  - Test plan:
    - `npm test` (new script content test)
    - Manual: run generated `weekly-synthesis.sh` on sample workspace
  - Completion note: Thresholds now use >= and tier is computed once per fact; added regression test.

- [x] F-010 Speed up weekly synthesis by removing per-entity Node startup
  - Files: `lib/utils/scripts.js`, `__tests__/weekly-synthesis.single-node.test.js`
  - Planned fix:
    - Generate `weekly-synthesis.sh` that processes all entities in a single Node invocation.
    - Preserve output format.
  - Test plan:
    - `npm test` (new script content test)
    - Benchmark: large fixture (record before/after wall time)
  - Completion note: Weekly synthesis now walks entities and generates summaries in one Node run; added regression test.

- [x] F-011 Add guardrails to generated git sweep autocommit/push
  - Files: `lib/utils/scripts.js`, `__tests__/git-sweep.guardrails.test.js`
  - Planned fix:
    - Improve quoting/robustness.
    - When `--autocommit` enabled: detect common secret file patterns and skip autocommit for that repo with an explanation.
  - Test plan:
    - `npm test` (new script content test)
    - Manual: run script with `--autocommit` against a repo containing `.env`
  - Completion note: Autocommit now skips repos touching common secret paths and avoids pushing when no commit was created; added regression test.

- [x] F-012 Add CI workflow to run lint/tests on PRs
  - Files: `.github/workflows/ci.yml`
  - Planned fix:
    - Add GitHub Actions workflow for Node 18/20: `npm ci`, `npm test`, `npm run lint`.
  - Test plan:
    - Validate workflow syntax locally (review) and in GitHub checks
  - Completion note: Added CI workflow running tests + lint on PRs/pushes.

- [x] F-013 Reduce duplicated checks between `doctor` and `verify`
  - Files: `lib/commands/doctor.js`, `lib/commands/verify.js`, `lib/utils/checks.js` (new)
  - Planned fix:
    - Extract shared check helpers to a small module.
    - Keep existing CLI output stable.
  - Test plan:
    - `npm test`
    - Manual: `downrigger doctor` and `downrigger verify` on a sample workspace
  - Completion note: Extracted shared HOME/cron path resolution into `lib/utils/checks.js`; updated doctor/verify and added tests.

- [x] F-014 Use `agentName` in cron job generation (or remove misleading param)
  - Files: `lib/utils/openclaw-cron.js`, `__tests__/openclaw-cron.test.js`
  - Planned fix:
    - Incorporate agent name into payload messages.
  - Test plan:
    - `npm test`
  - Completion note: Cron payload messages now include agent name; added assertion in cron test.

- [x] F-015 Improve diagnostics for failing external commands
  - Files: `lib/commands/init.js`, `lib/utils/qmd.js`, `lib/commands/verify.js`, `lib/commands/doctor.js`
  - Planned fix:
    - Preserve current quiet behavior on success.
    - On failure, surface actionable context (command + likely fix) without dumping secrets.
  - Test plan:
    - `npm test`
    - Manual: simulate missing bun/openclaw
  - Completion note: Improved error messaging for QMD installs and OpenClaw/QMD checks by including failure causes; added regression test.

- [x] NEW-001 Investigate moderate `npm audit` vulnerability
  - Files: `package-lock.json`
  - Planned fix:
    - Run `npm audit` to identify the advisory and affected package.
    - If fix is non-breaking, update lockfile; otherwise document rationale/mitigation.
  - Test plan:
    - `npm test`
    - `npm run lint`
  - Completion note: Upgraded ESLint to a patched major and migrated to flat config; `npm audit` now clean.
