[**English**](containerization.md) | [Português (Brasil)](pt-BR/containerization.md)

# Run FineCode in an isolated environment

Use an isolated environment to limit the files, credentials, processes, and network services that generated commands can access or affect.

You can isolate the entire FineCode process or keep FineCode on the host and route selected tools into an isolated environment. The FineCode npm package is not published yet; the install command below applies once it is available. The Docker Sandboxes section documents the upstream Pi kit, not a FineCode image. The OpenShell example is generic and requires an image you provide with FineCode installed.

## Choose an isolation method

| Method | Where FineCode runs | What is isolated | Credential handling | Best for |
|---|---|---|---|---|
| Plain Docker | Container | FineCode, built-in tools, `!` commands, and extensions | Credentials passed into the container | A straightforward local container boundary |
| Docker Sandboxes | Upstream Pi kit (not FineCode) | Upstream Pi process and tools | The kit's proxy substitutes configured provider credentials | Reference for the upstream integration; no FineCode image is supported |
| OpenShell | Local or remote sandbox | FineCode, built-in tools, `!` commands, and extensions | Policy-controlled credentials and inference routing | Filesystem, process, network, and credential policies |
| Gondolin extension | Host | Built-in tools and `!` commands | Stored FineCode credentials remain on the host, but commands inherit host environment variables | A local micro-VM for tool execution while retaining the host interface |

The method changes where extensions run. When the complete FineCode process runs inside an isolated environment, its extensions run there too. When host FineCode delegates built-in tools through Gondolin, other extension tools still run on the host unless they also delegate their work.

## Decide what FineCode can access

An isolated process can still affect any resources you expose to it:

- A read-write host mount lets FineCode modify those host files.
- Mounting `~/.pi/agent` exposes FineCode credentials, settings, extensions, and sessions.
- Environment variables passed to a container are available to processes running inside it.
- Network access can allow code or tool output to leave the environment.
- Tool-only isolation does not constrain the host FineCode process or extension tools that do not use the isolated backend.

Expose only the working folder, credentials, and network destinations needed for the task. Use read-only mounts or copy files in and out of the environment when you do not want writes to affect the host.

## Run FineCode in plain Docker

Plain Docker provides a simple container boundary around the entire process.

### Build the image

Create `Dockerfile.finecode`:

```dockerfile
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts finecode

WORKDIR /workspace
ENTRYPOINT ["finecode"]
```

Build the image from the directory containing the file:

```bash
docker build -t finecode-sandbox -f Dockerfile.finecode .
```

### Start FineCode

From the working folder you want FineCode to access, run:

```bash
docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v finecode-agent-home:/root/.pi/agent \
  finecode-sandbox
```

Replace `ANTHROPIC_API_KEY` with the credential required by your provider. The named `finecode-agent-home` volume keeps container-local settings, credentials, and sessions between runs.

Do not mount the host's `~/.pi/agent` unless the container should have access to your host FineCode configuration and credentials.

### Verify the workspace

Inside FineCode, run:

```text
!pwd
```

The command should print `/workspace`. Changes in `/workspace` are also written to the mounted host folder. Remove the bind mount or use a read-only mount if this is not acceptable.

## Reference: upstream Pi kit for Docker Sandboxes

[Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) can run the upstream Pi kit inside a managed sandbox. This is not a FineCode image; use it only as a reference for the upstream integration. Its proxy can keep the real provider credential on the host and substitute it when requests leave the sandbox.

Configure credentials before creating the sandbox. Do not run `/login` inside it, because that writes a real credential into the sandbox.

### Use a Claude Pro or Max token

Generate the token with `claude setup-token` on a machine with Claude Code. If an `anthropic` secret is already configured, remove it first so the proxy does not add an API-key header alongside the bearer token:

```bash
sbx secret rm anthropic

sbx secret set-custom \
  --host api.anthropic.com \
  --env ANTHROPIC_OAUTH_TOKEN \
  --placeholder 'sk-ant-oat01-{rand}'
```

`sbx secret set-custom` reads the real token from standard input. The sandbox receives an OAuth-shaped placeholder, which the proxy substitutes only for requests to the configured host.

For an Anthropic API key, use `sbx secret set anthropic`.

### Start upstream Pi

Run this from the working folder you want to mount:

```bash
sbx run --kit "docker.io/sbx/pi-kit:latest" pi
```

For an existing sandbox, run the upstream Pi CLI non-interactively:

```bash
sbx exec <sandbox-name> -- pi -p "list the failing tests"
```

See the [upstream Pi kit documentation](https://github.com/docker/sbx-kits-contrib/tree/main/pi) for other providers, troubleshooting, and image pinning.

## Run FineCode with OpenShell

[NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview) provides local or remote sandboxes with filesystem, process, network, credential, and inference policies.

### Select a gateway

Every sandbox requires an active gateway:

```bash
openshell gateway add <gateway-url> --name <name>
openshell gateway select <name>
```

### Create the sandbox

Set `FINECODE_SANDBOX_IMAGE` to an image that already has the `finecode` executable installed, then create the sandbox:

```bash
openshell sandbox create --name finecode-sandbox --from "$FINECODE_SANDBOX_IMAGE" -- finecode
```

FineCode, its built-in tools, `!` commands, and extension tools run inside the OpenShell boundary.

### Transfer files to a remote sandbox

A remote gateway does not mount the host working folder. Clone the repository inside the sandbox or transfer files explicitly:

```bash
openshell sandbox upload finecode-sandbox ./working-folder /workspace
openshell sandbox download finecode-sandbox /workspace/working-folder ./working-folder-out
```

OpenShell inference routing can keep raw model credentials outside the sandbox. When configured, point FineCode to the OpenAI-compatible or Anthropic-compatible endpoint exposed by the gateway.

## Route tools through Gondolin

[Gondolin](https://github.com/earendil-works/gondolin) is a local Linux micro-VM. Its example extension keeps the FineCode process and file-based provider credentials on the host while routing built-in tools and user `!` commands into the VM.

Commands inside the VM inherit the host process environment. Provider keys supplied through environment variables may therefore be visible inside the VM. Do not use this pattern as a credential boundary unless you remove sensitive variables or change the extension's environment handling.

Gondolin requires Node.js 23.6 or newer and QEMU installed through your operating-system package manager.

### Install the extension

From a FineCode source checkout:

```bash
mkdir -p ~/.pi/agent/extensions
cp -R packages/coding-agent/examples/extensions/gondolin ~/.pi/agent/extensions/gondolin
cd ~/.pi/agent/extensions/gondolin
npm install --ignore-scripts
```

### Start FineCode

Run FineCode from the working folder you want to mount:

```bash
cd /path/to/working-folder
finecode -e ~/.pi/agent/extensions/gondolin
```

The extension mounts the host working folder at `/workspace` in the VM and replaces `read`, `write`, `edit`, `bash`, `grep`, `find`, and `ls`. Changes under `/workspace` are also written to the host.

Other extension tools still run on the host unless they explicitly delegate their operations. Review the [Gondolin example](../examples/extensions/gondolin/) before adding tools that could bypass the VM boundary.
