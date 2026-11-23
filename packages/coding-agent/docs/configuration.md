[**English**](configuration.md) | [Português (Brasil)](pt-BR/configuration.md)

# Configuration

FineCode loads settings and reusable resources from global and project directories. This page explains where to put files and how project trust affects loading.

## Agent directory

FineCode keeps global configuration, credentials, sessions, packages, and extensions in `~/.pi/agent/`. This existing path is retained for compatibility. Set `PI_CODING_AGENT_DIR` to use another agent directory.

Use `finecode --help` to see command-line options that can override configuration for one run.

## Project resources

Project resources are loaded from `.pi/` directories in the working folder and its parent directories. FineCode loads resources from a project only after the project is trusted. See [Project trust](security.md#project-trust).

Common project resources include:

- `AGENTS.md` files with instructions for the agent.
- `settings.json` with project settings.
- Extensions, skills, prompt templates, and themes.
- `.pi/mcp.json` for project MCP servers.

FineCode also accepts resource paths in global settings. Run `/settings` to inspect or edit settings, or configure them directly in `~/.pi/agent/settings.json`.

## Context files

FineCode reads `AGENTS.md` files as instructions. It checks the working directory and its parent directories, plus the agent directory. These files can provide project-specific guidance such as coding conventions, test commands, and directory structure.

Use `/reload` after changing configuration or resource files while FineCode is running.

## Settings and environment variables

Settings control default models and tools, resource locations, keybindings, and other behavior. See [Settings reference](settings.md) for the complete schema.

Environment variables can configure authentication and runtime behavior. See [Environment variables](environment-variables.md) for the supported names, including legacy `PI_*` variables retained for compatibility.

## Resources

FineCode can load reusable resources from built-in directories or paths configured in `settings.json`:

| Resource | Purpose | Documentation |
|---|---|---|
| Extensions | Executable tools, commands, and event handlers | [Extensions](extensions.md) |
| Skills | Task-specific instructions and supporting files | [Skills](skills.md) |
| Prompt templates | Reusable prompts in the `/` menu | [Prompt templates](prompt-templates.md) |
| Themes | Terminal colors and styles | [Themes](themes.md) |
| MCP servers | Connect tools and resources from external services | [MCP](mcp.md) |

Use `/packages` to inspect installed packages. See [FineCode packages](packages.md) to install and distribute resources.
