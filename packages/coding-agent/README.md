[**English**](README.md) | [Português (Brasil)](README.pt-BR.md)

<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
</p>

> FineCode is maintained solo. Issues and PRs remain open for manual maintainer review. See [CONTRIBUTING.md](../../CONTRIBUTING.md).

# FineCode

FineCode is a minimal, extensible coding agent built from Pi, with the `finecode` command as its canonical CLI. Pi remains the upstream project's separate command.

Customize FineCode with [extensions](docs/extensions.md), [skills](docs/skills.md), [prompt templates](docs/prompt-templates.md), and [themes](docs/themes.md). Bundle these resources as packages and share them through npm or git.

FineCode ships with powerful defaults and can be extended for your workflow. Use it [interactively](docs/usage.md), automate it in [print or JSON mode](docs/cli.md), control it over [RPC](docs/rpc.md), or embed the SDK. See the [SDK guide](docs/sdk.md) and [OpenClaw](https://github.com/OpenClaw/OpenClaw) for integration examples.

## Getting started

The FineCode npm runtime is not published yet. Once released, install it with Node.js 22.19 or newer:

```bash
npm install -g --ignore-scripts finecode
```

Start the CLI with `finecode`. The npm package does not pin transitive dependencies and does not require dependency lifecycle scripts for installation.

On macOS and Linux, Nix users can run this checkout with `nix run .` or install it with `nix profile install .`. The [upstream Pi quickstart](docs/quickstart.md) describes Pi, not the FineCode command or installer.

Start FineCode in the directory where you want it to work:

```bash
cd /path/to/project
finecode
```

For a built-in AI provider, run `/login` inside FineCode to connect a subscription or API key. Then give FineCode a task.

See the [documentation](docs/index.md) for full setup and usage instructions. These upstream-derived docs may use `pi`, `.pi`, and Pi-specific services; FineCode uses `finecode`, `.finecode`, and the intended npm channel described above.

## Share your OSS coding agent sessions

If you use upstream Pi for open-source work, please share your coding agent sessions.

Public OSS session data helps improve models, prompts, tools, and evaluations using real development workflows.

For the full explanation, see [this post on X](https://x.com/badlogicgames/status/2037811643774652911).

To publish sessions, use [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf) with a Hugging Face account and the Hugging Face CLI.

- [Demo video](https://x.com/badlogicgames/status/2041151967695634619) on how to publish Pi sessions
- Published Pi development sessions: [`badlogicgames/pi-mono` on Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono).

## Development

From a FineCode checkout, install dependencies and run the source CLI:

```bash
npm install --ignore-scripts
./pi-test.sh
```

`pi-test.sh` can be called from any directory and preserves the caller's working directory.

Before submitting changes, run:

```bash
npm run check
./test.sh
```

Read [CONTRIBUTING.md](../../CONTRIBUTING.md) before opening an issue or pull request. It defines manual contribution review, issue quality expectations, and required checks. Read [AGENTS.md](../../AGENTS.md) for repository-specific implementation, testing, dependency, and release rules.

## License

MIT
