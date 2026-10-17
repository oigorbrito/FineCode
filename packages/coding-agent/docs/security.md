[**English**](security.md) | [Português (Brasil)](pt-BR/security.md)

# Run FineCode safely

FineCode is a local coding agent, not a security sandbox. Its tools run with the operating-system permissions of the FineCode process. They can read or modify files, run commands, and access network resources available to that process.

FineCode does not ask for confirmation before every tool call and does not restrict filesystem, process, network, or credential access by default. Use operating-system controls, a container, or another sandbox when you need stronger isolation.

## Trust the resources you load

Extensions are executable TypeScript or JavaScript. They run in-process and can access the same files, credentials, and tools available to FineCode. Only load extensions from sources you trust.

Skills and prompt templates provide instructions to the model. They do not run as code by themselves, but can influence which actions the agent takes. Review them before use, especially when they come from an untrusted source.

FineCode can load resources from the working project. Review project files and instructions before trusting a repository, and be especially cautious with agent instructions, extensions, and MCP configuration.

<a id="project-trust"></a>
## Understand project trust

Project trust controls whether FineCode loads project-level resources. Trust does not sandbox tool calls or limit the operating-system permissions of the process.

Until a project is trusted, FineCode does not load its extensions, skills, prompt templates, themes, or MCP servers. It can still read and edit files and run commands when asked. Do not treat the trust prompt as a security boundary around tool execution.

## Isolate risky work

For untrusted repositories or unattended tasks, run FineCode in a container or another sandbox with only the files and credentials required for the task. See [Containerization](containerization.md) for setup patterns.

Avoid exposing unnecessary credentials to the process. A model provider, extension, or command may receive data that FineCode can access.

## Upstream security policy

The repository's [SECURITY.md](../../../SECURITY.md) describes the upstream Pi project's security model and reporting process. FineCode does not operate the upstream `pi.dev` services.
