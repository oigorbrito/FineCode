[**English**](SECURITY.md) | [Português (Brasil)](SECURITY.pt-BR.md)

# Security Policy — Upstream Pi

This file preserves the security policy for upstream Pi. It does not define FineCode's reporting process; FineCode-specific security guidance has not yet been published. Do not send FineCode reports to upstream Pi's Earendil or `pi.dev` channels.

The reporting contacts and scope below apply only to upstream Pi; they are not FineCode reporting channels.

This document should guide you in understanding the security concept behind Pi and its boundaries.

In general, Pi is a coding agent that runs locally within the security boundary of the user running it. It is the user's responsibility to monitor its operations or contain it within a container, virtual machine, or other sandbox solution.

Pi treats the local user account and files writable by that account as inside the same trust boundary as the Pi process itself. If an attacker can modify files under the user's home directory, workspace, shell startup files, environment, or Pi configuration, they can generally influence Pi or other local developer tools. Reports that depend on such prior local write access are not security vulnerabilities unless they demonstrate how Pi grants that write access or crosses an operating-system privilege boundary.

Pi relies on users installing trustworthy extensions, loading trustworthy skills, and using Pi only within trusted repositories. This is because files like `AGENTS.md` or instructions in comments can trivially prompt-inject the coding agent, and this cannot be fully prevented.

## Reporting a Vulnerability

If you believe you found a security vulnerability in Pi or another package in this repository, please report it privately by either:

- Emailing `security@earendil.com`, or
- Opening a private report through GitHub Security Advisories for this repository.

Please include:

- A description of the issue and its impact
- Steps to reproduce, a proof of concept, or relevant logs
- The affected package, version, commit, or configuration
- Any known mitigations

Do not open a public issue for security-sensitive reports. Reports will be reviewed and disclosure coordinated as appropriate.

## Scope

Security issues in the distributed packages, command-line tools, APIs, and repository code are in scope, as is Earendil-operated infrastructure on `pi.dev`.

## Out of Scope

- Local code execution or sandboxing behavior (the Pi coding agent intentionally does not have a sandbox)
- Behavior of Pi extensions or skills installed by the user
- Risks from working in untrusted repositories
- Risks from installing untrusted extensions, skills, packages, or tools
- Issues caused by untrustworthy MITM proxies
- Public internet exposure of a Pi installation
- Prompt injection attacks
- Exposed secrets that are third-party- or user-controlled credentials
- Reports requiring the ability to create, modify, delete, or replace files, directories, symlinks, environment variables, shell configuration, or other user-controlled local state on the target machine. This includes `~/.pi`, `~/.pi/agent/models.json`, workspace files, `AGENTS.md`, skills, extensions, extension configuration, dotfiles, and files synchronized through NFS, roaming profiles, or dotfile managers, unless the report shows how Pi itself grants that access.
- Issues caused by intentionally weakened user configuration
- Resource/DoS claims that require trusted local input or configuration against the Pi coding agent
- Reports about malicious model output
- User-approved or user-initiated local actions presented as vulnerabilities

## Notes for Reporters

The most useful reports show a current, reproducible security-boundary bypass with demonstrated impact. Reports that only show expected local-agent behavior, prompt injection, or a malicious trusted extension or skill are not security vulnerabilities under this model.

For example, a report showing that malicious contents written to a trusted Pi configuration file cause Pi to execute commands, load attacker-controlled tools, send credentials to an attacker-controlled endpoint, or otherwise change behavior is out of scope.

When possible, include the exact affected path, package version or commit SHA, configuration, and a proof of concept against the latest release or latest `main`. For dependency reports, include evidence that the shipped dependency is affected and that the issue is reachable through Pi. For exposed-secret reports, include evidence that the credential is owned by Earendil or grants access to Earendil-operated infrastructure or services.
