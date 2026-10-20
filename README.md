[**English**](README.md) | [Português (Brasil)](README.pt-BR.md)

<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
</p>

# FineCode

FineCode is a minimal, extensible coding agent built from Pi. Its canonical command is `finecode`; the npm package does not expose a `pi` alias.

Customize FineCode with [extensions](packages/coding-agent/docs/extensions.md), [skills](packages/coding-agent/docs/skills.md), [prompt templates](packages/coding-agent/docs/prompt-templates.md), and [themes](packages/coding-agent/docs/themes.md). Bundle resources as packages and share them through npm or git.

FineCode ships with powerful defaults and can be extended for your workflow. Use it [interactively](packages/coding-agent/docs/usage.md), automate it in [print or JSON mode](packages/coding-agent/docs/cli.md), control it over [RPC](packages/coding-agent/docs/rpc.md), or embed the SDK. See [OpenClaw](https://github.com/OpenClaw/OpenClaw) for a real-world integration.

## Getting started

The FineCode npm package is not published yet. Once released, install the CLI with Node.js 22.19 or newer:

```bash
npm install -g --ignore-scripts finecode
```

Start it with `finecode`. The npm installation does not pin transitive dependencies and does not require dependency lifecycle scripts.

Start FineCode in the directory where you want it to work:

```bash
cd /path/to/project
finecode
```

For a built-in AI provider, run `/login` inside FineCode to connect a subscription or API key. Then give it a task.

See the [local documentation](packages/coding-agent/docs/index.md) for setup and usage. The linked `pi.dev` services remain upstream Pi resources. Upstream-derived docs may use `pi` and `.pi`; FineCode uses `finecode` and defaults to `.finecode`.

## Run with Nix

Nix flakes and `nix-command` may need to be enabled. Add `experimental-features = nix-command flakes` to `~/.config/nix/nix.conf`, or enable them for one command with `nix --extra-experimental-features 'nix-command flakes' run .`.

With flakes enabled, run FineCode from a checkout:

```bash
nix run .
```

Install the checkout into a Nix profile with `nix profile install .`. The flake exposes `finecode` as its primary package and retains `pi` as an alias. Supports ARM64 and x86-64 on Linux and macOS.

Nix builds are offline, so bundled model data comes from an upstream `pi.dev` catalog revision pinned in `nix/model-catalog.json`. At runtime, FineCode can overlay newer catalog data from that upstream service. The Nix workflow replaces the pin on `main` when it no longer matches the checkout, for example after a provider is added or gains a new model type. To refresh it by hand:

```bash
npm run update:model-catalog-pin
```

## Packages

This monorepo contains the FineCode CLI and its supporting libraries.

| Package | Description |
|---------|-------------|
| **[@earendil-works/chord](packages/chord)** | Typed host runtime for hot-reloadable plugins, contracts, replicated state, and RPC over JSON links |
| **[@earendil-works/pi-telemetry](packages/telemetry)** | Vendor-neutral telemetry contracts, reference adapter, conformance tests, and typed schemas |
| **[@earendil-works/pi-ai](packages/ai)** | Unified multi-provider LLM API (OpenAI, Anthropic, Google, etc.) |
| **[@earendil-works/pi-durable](packages/durable)** | Durable conversation, task, and document runtime |
| **[@earendil-works/pi-agent-core](packages/agent)** | Agent runtime with tool calling and state management |
| **[finecode](packages/coding-agent)** | Interactive coding agent CLI |
| **[@earendil-works/pi-tui](packages/tui)** | Terminal UI library with differential rendering |

For Slack/chat automation and workflows see [earendil-works/pi-chat](https://github.com/earendil-works/pi-chat).

## Permissions & Containerization

FineCode does not include a built-in permission system for restricting filesystem, process, network, or credential access. By default, it runs with the permissions of the user and process that launched it.

If you need stronger boundaries, containerize or sandbox FineCode. See [packages/coding-agent/docs/containerization.md](packages/coding-agent/docs/containerization.md) for three patterns:

- **Gondolin extension**: keep FineCode and provider auth on the host while routing built-in tools and `!` commands into a local Linux micro-VM.
- **Plain Docker**: run the whole FineCode process in a local container for simple isolation.
- **OpenShell**: run FineCode in a policy-controlled sandbox.

## Contributing

FineCode is maintained as a solo project. Issues and pull requests are not automatically closed based on contributor approval, but submissions do not guarantee review or acceptance. See [CONTRIBUTING.md](CONTRIBUTING.md) for current guidance and [AGENTS.md](AGENTS.md) for development rules.

## Development

```bash
npm install --ignore-scripts  # Install all dependencies without running lifecycle scripts
npm run build         # Refresh model data, then build all packages
npm run build:offline # Rebuild using existing model data without network access
npm run check         # Lint, format, and type check
./test.sh            # Run tests (skips LLM-dependent tests without API keys)
./pi-test.sh         # Run FineCode from sources (legacy script name; callable from any directory)
```

### Using local packages outside the monorepo

Build every public package into one coherent local artifact set:

```bash
npm run pack:packages -- --out .artifacts/pi-packages
```

This refreshes model data before building `pi-ai`. To avoid network access when model data is already hydrated, pass `--offline-model-data`.

Then configure an external project to consume one package and resolve all of its workspace dependencies from the same artifact set. npm is the default:

```bash
node scripts/use-local-packages.mjs \
  --manifest .artifacts/pi-packages/manifest.json \
  --consumer ../my-project \
  --package @earendil-works/pi-durable \
  --package @earendil-works/pi-agent-core
cd ../my-project
npm install --ignore-scripts
```

For a pnpm project, point `--consumer` at the workspace root:

```bash
node scripts/use-local-packages.mjs \
  --manifest .artifacts/pi-packages/manifest.json \
  --consumer ../my-project \
  --package @earendil-works/pi-agent-core \
  --package-manager pnpm
cd ../my-project
pnpm install --ignore-scripts
```

Repeat `--package` for each direct dependency. The command updates the consumer's `package.json` with content-addressed local `file:` references. It writes transitive overrides to `package.json` for npm or `pnpm-workspace.yaml` for pnpm. Keep the artifact directory available while installing or updating the consumer. Re-run both commands after changing FineCode source.

## Upstream Pi standalone binaries (reference)

The commands below describe the upstream Pi release process, not FineCode downloads. FineCode does not yet publish source archives or standalone binaries. Upstream Pi GitHub releases include a versioned source archive covered by the release's `SHA256SUMS` file. Extract it and run the build script from that source archive:

```bash
VERSION="<release-version>"
tar -xzf "pi-${VERSION}-source.tar.gz"
cd "pi-${VERSION}"
./scripts/build-binaries.sh --offline-model-data --platform linux-x64 --out "$PWD/out"
```

The archive includes release model data and native prebuilds. `--offline-model-data` uses that model data without refreshing provider catalogs. The script installs dependencies and builds the executable with its runtime assets; pass `--skip-install` if dependencies are already provided.

## Supply-chain hardening

We treat npm dependency changes as reviewed code changes.

- Direct registry dependencies, including internal workspace dependencies, are pinned to exact versions.
- `.npmrc` sets `save-exact=true` and `min-release-age=2` to avoid same-day dependency releases during npm resolution.
- `package-lock.json` is the dependency ground truth. Pre-commit blocks accidental lockfile commits unless `PI_ALLOW_LOCKFILE_CHANGE=1` is set.
- `npm run check` verifies pinned direct deps, native TypeScript import compatibility, and the generated coding-agent install lock.
- The Nix package installs from `packages/coding-agent/install-lock/`, generated from the root lockfile, to pin transitive dependencies. The npm package does not pin transitive dependencies.
- Local release smoke tests and npm publication use the same tarball packer; npm publishes the validated tarballs rather than repacking workspace directories.
- Local release installs, documented npm installs, and `finecode update --self` use `--ignore-scripts` where supported.
- CI installs with `npm ci --ignore-scripts`, and a scheduled GitHub workflow runs `npm audit --omit=dev` plus `npm audit signatures --omit=dev`.
- Install lock generation has an explicit allowlist for dependency lifecycle scripts; new lifecycle-script deps fail checks until reviewed.

## Upstream Pi session sharing

The following links describe the upstream Pi community's session-sharing project; they are not FineCode services.

For the full explanation, see [this post on X](https://x.com/badlogicgames/status/2037811643774652911). Upstream contributors can use [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf) with a Hugging Face account and CLI.

See [this video](https://x.com/badlogicgames/status/2041151967695634619) and the published `pi-mono` work sessions here:

- [badlogicgames/pi-mono on Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)

The upstream Pi project's `pi.dev` domain was graciously donated by [exe.dev](https://exe.dev).

## License

MIT
