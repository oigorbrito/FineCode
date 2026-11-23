[**English**](usage.md) | [Português (Brasil)](pt-BR/usage.md)

# Use FineCode in the terminal

Start FineCode in the folder you want it to work with:

```bash
finecode
```

The interactive interface has a conversation area, an editor, and a footer with the current folder, model, and session status.

<p align="center"><img src="images/interactive-mode.png" alt="FineCode interactive mode showing a conversation, input editor, and status footer" width="750"></p>

## Give FineCode context

Type a prompt in the editor and press `Enter` to send it. Use `@` to search for a file and include it in the prompt. Use `Ctrl+V` to paste an image from the clipboard.

FineCode automatically includes the working folder as context. For instructions that should apply whenever FineCode works in a folder, add an `AGENTS.md` file. See [Context files](configuration.md#context-files).

## Guide the work

FineCode shows the tools it uses, including file reads, searches, commands, and edits. You can send a follow-up while it is working; FineCode queues it for the next turn. Use `Alt+Enter` to queue a message without interrupting the current turn.

Use `Ctrl+C` to interrupt the current operation. Press it again to exit. Press `Ctrl+D` to exit when the editor is empty.

Run `/` commands in the editor to manage the session, change models, inspect settings, and control the interface. Type `/` to browse available commands. See [Slash commands](slash-commands.md) and [Keyboard shortcuts](keybindings.md).

## Work with sessions

FineCode saves your conversation automatically. Run `/resume` to select a saved session, `/tree` to navigate branches, or `/new` to start a fresh session. Use `/export` to save a conversation as HTML.

See [Sessions](sessions.md) for session files, naming, branches, compaction, and export.

## Use FineCode without the interactive interface

For a single task or script, use print mode:

```bash
finecode -p "Summarize the files in this folder"
```

Use `--mode json` to receive structured events instead of rendered text. See [CLI reference](cli.md) and [JSON mode](json.md).

## Direct and automate FineCode

Use [RPC mode](rpc.md) to control FineCode from another process, or embed it in an application with the [TypeScript SDK](sdk.md).
