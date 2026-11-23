---
name: project-rebranding
description: Plan, implement, and validate FineCode's identity migration from Pi across code, packages, CLI, configuration, documentation, assets, and GitHub surfaces. Use for canonical naming, rebranding, or removing inherited product references; do not use for routine copy edits or removing legal/upstream attribution.
---

# FineCode identity migration

Treat identity work as a compatibility-sensitive migration, not a global text replacement. Preserve the currently working code and keep the migration separate from unrelated feature work.

## 1. Establish scope and repository state

- Confirm the approved product name and exact canonical identifiers for npm package, CLI, workspace packages, configuration directory, environment variables, URLs, and release artifacts. The maintainer has reserved and tested the npm name `finecode`; still verify the exact package/publishing scope before release.
- Read `AGENTS.md` and relevant package instructions. Record `git status`, branch, and upstream before changes. Preserve all existing local and untracked work.
- Current repository workflow: `main` contains the initial baseline. Make identity changes on a dedicated branch and use a reviewable pull request. Do not amend or rewrite the baseline. Never commit or push unless the user explicitly asks.
- Keep the change limited to identity unless the user separately approves functional changes.

## 2. Use backup material selectively

- Treat `D:/projetos/FineCode-Backup-20261016` as an untrusted draft/reference, not as the source tree to restore wholesale.
- Use `source-snapshot/docs/identity-migration.md` and the relevant source files to identify the prior identity design. Compare proposed changes against the current working tree before copying anything.
- Never replace the current project tree with `source-snapshot/` or `b25-worktree/`. Do not copy historical reports, generated output, ignored build data, or unrelated model/test changes as part of rebranding.
- Preserve current behavior. If the backup's code differs from the current code beyond identity, isolate the difference and ask before incorporating it.

## 3. Inventory and classify references

Search case-insensitively for `Pi`, `pi`, `@earendil-works`, old product URLs, and variants in tracked source, docs, tests, workflows, package manifests/lockfiles, Nix files, assets, and release metadata. A match is evidence to inspect, not permission to change it.

Classify each relevant match:

1. **Product identity**: product name, user-facing copy, CLI help, logos, screenshots, and project-owned URLs.
2. **Technical identifiers**: npm/workspace package names, imports, executable names, environment variables, settings keys, directories, session formats, and protocol identifiers. Check consumers and migration/compatibility impact before changing.
3. **Upstream and external references**: dependencies, provider/API identifiers, domains, issue links, attribution headers, and references needed for interoperability. Keep accurate references.
4. **Legal and attribution**: license text, copyright holders, notices, contributor credits, and required attributions. Do not remove or rewrite these as branding.
5. **Generated or vendored files**: identify the generator/source first. Do not hand-edit generated output or rewrite vendor material without an explicit, technically justified plan.

Record ambiguous references and intentional Pi compatibility separately. Prefer a precise allowlist of confirmed identity changes over bulk replacement.

## 4. Plan and implement

- Present a file-level plan that states behavior, user impact, compatibility risk, and validation for each group of changes. Explicitly list names/references that remain and why.
- Wait for approval of the concrete scope before editing. If implementation reveals a new compatibility, legal, or release issue, stop and ask rather than silently expanding scope.
- Apply targeted edits while preserving unrelated code and formatting. Update package metadata, lockfiles, generated artifacts, or migration logic only through their supported workflows.
- Treat `finecode` as the canonical npm name only in the approved package scope. Do not imply that a package, installer, update service, domain, or release channel is published or controlled by FineCode unless verified.
- Keep `.pi` compatibility and legacy data paths only when the approved plan requires them. Do not rename hidden configuration directories or persisted user data implicitly.

## 5. GitHub workflow and sources

- Use the repository's `.pi/skills/github-work.md` and its referenced prompt templates for issue/PR work; do not duplicate that workflow here.
- For current GitHub-specific procedural claims (branches, pull requests, repository settings, or publishing through GitHub), consult the relevant official GitHub documentation and link the source. Distinguish GitHub platform guidance from FineCode product decisions and npm policy.
- Do not claim that GitHub documentation validates an npm name or decides which Pi references FineCode should retain.
- Make changes on a dedicated branch; review the diff and checks before proposing a PR. Do not publish a release or change repository settings without explicit authorization.

## 6. Validate and report

- Re-run searches for old/new identity variants. Classify remaining Pi references as intentional compatibility, upstream/external, legal/attribution, generated/vendor, or unresolved; do not claim a complete rename solely because a search returned no obvious matches.
- For code changes, follow `AGENTS.md`: run `npm run check`; do not run `npm run build` or `npm test` unless requested. For documentation-only changes, state that tests were not run.
- Inspect `git diff --check`, the complete diff, and `git status`. Report changed and intentionally unchanged references, commands/results, pre-existing baseline failures, unresolved compatibility questions, and anything not validated.
- Never stage unrelated files, commit, push, merge, or publish without the user's explicit request.
