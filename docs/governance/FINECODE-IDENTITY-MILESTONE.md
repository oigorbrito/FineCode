# FineCode — Identity Establishment Baseline

**Status:** proposed identity milestone, pending manual review/merge.  
**Recorded:** 2026-10-22.  
**Pinned repository:** `oigorbrito/FineCode`.  
**Baseline commit:** `2b11c5f1d5793c018e6bd3785ea9ca294ef517ec`.

## Decision to be recorded

FineCode is an independently maintained product and repository identity built from the Pi-derived codebase. The name **FineCode** designates the actively maintained CLI, Desktop product, user-facing application identity, tests, distribution and project governance. Pi remains acknowledged as technical ancestry; continuing upstream imports are deliberate, reviewable changes, **not** an assertion that FineCode and Pi share organizational or product identity.

This is an identity and engineering baseline. It is **not** a declaration that the current modified canonical upstream source has been identified, that the product is feature-complete, or that every workflow is validated on every platform.

## Evidence at the pinned baseline

| Gate | Evidence | Interpretation |
|---|---|---|
| Repository and product identity | `oigorbrito/FineCode`; versioned FineCode CLI; FineCode Desktop name and UI changes incorporated in PR #573 | Active FineCode identity, distinct from historical Pi provenance |
| Controlled upstream integration | `feat/full-upstream-tree-migration` commit `2f73ffd59aeafcf978e7575222a6201df6e221b9` is an ancestor of the pinned main | Historical migration commits incorporated, not proof of current-source parity |
| Historical reconciliation | PR #548 58-path review; independent historical tree investigation; PR #575 restores FineCode extension and share-viewer compatibility | Historical review completed within its documented scope |
| Installed product execution | Windows NSIS/Electron E2E; separately installed FineCode CLI runtime confirmed by process path and bundle hashes; tool permissions, writes/diff, session restore, cancellation | Windows installed-product scenario demonstrated, not a general reliability guarantee |
| CI | Main post-merge workflow run `39789118447`, four jobs passed for PR #575 integration | Build/check/test and configured CI jobs green at the pinned baseline |
| Governance | Protected/manual merge workflow followed for identified integration PRs | Upstream changes do not automatically redefine FineCode |

## Identity contract

1. **Active identity:** commands, package metadata, product presentation, user documentation and release artifacts intentionally branded FineCode. Keep Pi labels only for provenance, explicit Pi-engine selection, compatibility contracts, external APIs or stable identifiers whose migration is separately evaluated.
2. **Runtime independence:** FineCode CLI and Desktop must resolve the expected FineCode runtime by explicit verified means; do not silently substitute a globally installed Pi or unrelated CLI.
3. **Compatibility:** retain deliberate Pi compatibility and the restored `@finecode/*` extension aliases and `FINECODE_SHARE_VIEWER_URL` semantics; changes require contract-based tests and migration rationale.
4. **Upstream policy:** imports are reviewed for contracts and provenance, with branch protection and manual merge. Ancestry is not semantic equivalence.
5. **Evidence policy:** every future identity or release claim must include commit SHA, artifact identity, scope of functional proof, CI status, and known limitations. Never transform a passing build into proof of broad product behavior.
6. **Data/privacy:** keep the current `.pi` compatibility policy until migration is separately justified; do not reactivate historic opt-in telemetry absent explicit product/privacy decision.
7. **Attribution:** retain truthful Pi upstream copyright, license, origin and historical change references where applicable. Identity changes are not a license to erase provenance.

## Open boundaries at this milestone

- **CANONICAL_SOURCE_UNVERIFIED:** the internal modified *current* canonical source was not independently designated/identified. Historical migration/ref comparisons are not certification of 100% parity.
- Windows native dependency rebuilding may require the Visual Studio Spectre libraries; a packaged precompiled PTY smoke does not prove local native compilation.
- Other operating systems, production-provider calls, distribution publication, update lifecycle and broader reliability remain limited to their separately recorded evidence.
- The local historical backup had six manifest-copy discrepancies; the verified Git bundle and relevant reports were unaffected in that investigation.
- A previous accidental `npm ci --ignore-scripts` changed ignored `node_modules` in the original `tui` checkout; tracked files and references were not reported changed. This environment is not presumed byte-for-byte preserved.

## Milestone acceptance and follow-up

Review that active naming and docs match actual behavior, verify SHA-specific CI and evidence, then **manually merge** this record. After merge, optionally create an **annotated, immutable Git tag** on the resulting documentation commit, for example `finecode-identity-established-2026-10-22`, with the reviewed source SHA in its message and no fabricated version bump. Tag creation is a separate controlled release/governance action, not automatically performed by this proposal.

The accepted claim is strictly: **“FineCode has a documented, independently managed product identity and an operational Windows baseline at the pinned commit, with Pi ancestry retained and canonical-source authority expressly unresolved.”**
