[**English**](environment-variables.md) | [Português (Brasil)](pt-BR/environment-variables.md)

# Environment Variables

FineCode uses environment variables in three ways:

- Variables such as `PI_OFFLINE` configure the FineCode process.
- FineCode sets process markers so child processes can identify FineCode as the launching agent.
- Commands run by the LLM-callable shell tools receive `PI_*` variables describing the current session.

Provider API-key variables are documented separately in [Providers](providers.md#use-an-api-key-from-the-environment).

## Process Marker

The CLI and RPC entry points set two process markers:

- `AI_AGENT=finecode` identifies the FineCode distribution to child processes; an upstream Pi build sets it to `pi`.
- `PI_CODING_AGENT=true` is a legacy marker retained for compatibility. FineCode still sets it, so it does not distinguish FineCode from upstream Pi.

Child processes inherit both markers. They are not session-specific and are not set automatically when FineCode is embedded through the SDK.

## Shell Tool Session Environment

Commands run by the `bash` and `powershell` tools receive the current FineCode session state:

| Variable | Description |
|----------|-------------|
| `PI_SESSION_ID` | Current session ID |
| `PI_SESSION_FILE` | Absolute path to the current session JSONL file; unset for ephemeral sessions |
| `PI_PROVIDER` | Currently selected model provider |
| `PI_MODEL` | Currently selected model ID |
| `PI_REASONING_LEVEL` | Current effective reasoning level: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max` |

The values are resolved when each command starts. Switching models or changing the reasoning level therefore affects the next shell command without restarting FineCode. `PI_PROVIDER` and `PI_MODEL` identify the selected FineCode model, not a different upstream model that a router may choose internally.

When asked which model or provider is running, inspect these variables instead of inferring the answer from the system prompt:

```bash
printf '%s/%s\n' "$PI_PROVIDER" "$PI_MODEL"
printf 'reasoning=%s session=%s\n' "$PI_REASONING_LEVEL" "$PI_SESSION_ID"
```

The session file can be inspected directly when the session is persistent:

```bash
if [ -n "$PI_SESSION_FILE" ]; then
  tail -n 1 "$PI_SESSION_FILE"
fi
```

These variables are injected into the LLM-callable `bash` and `powershell` tools. They are not injected into user-entered `!` or `!!` commands.

### Custom Shell Tools

Tools created with `createBashTool()` or `createPowerShellTool()` expose the session environment by default when registered with FineCode. Injection happens before `spawnHook`, so a hook receives the variables in `ctx.env`:

```typescript
const bashTool = createBashTool(cwd, {
  spawnHook: (ctx) => ({
    ...ctx,
    env: { ...ctx.env, CI: "1" },
  }),
});
```

Disable session metadata independently of the spawn hook:

```typescript
const powershellTool = createPowerShellTool(cwd, {
  exposeSessionEnvironment: false,
  spawnHook: (ctx) => ctx,
});
```

When disabled, FineCode removes inherited values for these variables so nested FineCode processes do not expose stale parent-session metadata.

## FineCode process configuration

These variables are read by FineCode. Legacy `PI_*` names remain supported for compatibility:

| Variable | Description |
|----------|-------------|
| `FINECODE_CODING_AGENT_DIR` | Override the config directory; default is `~/.pi/agent`. `PI_CODING_AGENT_DIR` remains a legacy alias |
| `FINECODE_CODING_AGENT_SESSION_DIR` | Override session storage; overridden by `--session-dir`. `PI_CODING_AGENT_SESSION_DIR` remains a legacy alias |
| `PI_PACKAGE_DIR` | Override the package directory, useful for Nix/Guix store paths |
| `PI_OFFLINE` | Disable automatic network activity, including model catalog refreshes |
| `PI_SKIP_VERSION_CHECK` | Disable the automatic package latest-version check |
| `PI_TELEMETRY` | Override telemetry and provider attribution headers. FineCode does not send install/update reports to upstream Pi; provider attribution identifies FineCode and this flag controls selected headers: `1`/`true`/`yes` or `0`/`false`/`no` |
| `PI_CACHE_RETENTION` | Set to `long` for extended provider prompt caching where supported |
| `PI_SHARE_VIEWER_URL` | Override the viewer base URL used by `/share`; the default is the upstream Pi viewer at `https://pi.dev/session/` |
| `PI_RADIUS_GATEWAY` | Override the Radius gateway origin used by `/bug` uploads |
| `PI_HARDWARE_CURSOR` | Set to `1` to show the hardware cursor; see [Terminal setup](terminal-setup.md) |
| `PI_CLIPBOARD_OSC52` | Set to `1` to also send copied text to the terminal with OSC 52 after the local clipboard write, as FineCode does over SSH. Use it when a remote client reaches FineCode without SSH variables, such as a multiplexer attached from another machine or a remote IDE daemon |
| `PI_HYPERLINKS` | Override OSC 8 hyperlink detection with `1`, `0`, or `auto` |
| `PI_PROGRAM_STATUS` | Override OSC 7501 program status detection: `1` always reports, `0` never reports; otherwise FineCode reports only after the terminal confirms support. See [Terminal setup](terminal-setup.md#program-status) |
| `PI_IMAGE_PROTOCOL` | Override inline image detection with `kitty`, `iterm2`, `none`, or `auto` |
| `PI_TRUE_COLOR` | Override truecolor detection with `1`, `0`, or `auto` |
| `PI_TUI_ESC_TIMEOUT` | How long to wait after a lone ESC before treating it as Escape, in milliseconds; defaults to `100` over SSH and `10` otherwise. Increase if Alt-key input is misread as Escape |
| `VISUAL`, `EDITOR` | External editor fallback when `externalEditor` is unset |
| `HTTP_PROXY`, `HTTPS_PROXY` | Proxy outbound HTTP requests |

Provider credentials such as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and provider-specific configuration are listed in [Providers](providers.md#use-an-api-key-from-the-environment).
