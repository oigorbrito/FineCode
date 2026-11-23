[English](../terminal-setup.md) | **Português (Brasil)**

# Configure seu terminal

A maioria dos terminais modernos funciona com o FineCode sem configuração adicional. Consulte esta página quando teclas modificadas, rolagem, links, imagens, cores ou o posicionamento do editor de método de entrada (IME) não se comportarem como esperado.

O FineCode usa protocolos de teclas estendidos para que o terminal diferencie combinações como `Shift+Enter` e `Alt+Enter` de um `Enter` simples. Proxies de terminal, multiplexadores e terminais integrados a IDEs podem alterar ou descartar essas informações.

## Solução de problemas

| Sintoma | Consulte primeiro |
|---|---|
| `Shift+Enter` envia a mensagem em vez de inserir uma linha | A seção do seu terminal abaixo; para tmux, consulte [Execute o FineCode no tmux](tmux.md) |
| `Alt+Enter` não enfileira uma mensagem de acompanhamento | [WezTerm](#wezterm), [Alacritty](#alacritty) ou [Windows Terminal](#windows-terminal) |
| A rolagem em tela cheia está excepcionalmente lenta | [iTerm2](#iterm2) |
| Os links funcionam, mas não exibem uma prévia ao passar o cursor | [Ghostty](#ghostty) |
| Imagens em linha ou cores não são detectadas | [Substitua os recursos detectados](#override-detected-capabilities) |
| A janela de candidatos do IME aparece no lugar errado | [WezTerm](#wezterm) ou [terminal integrado do IntelliJ IDEA](#intellij-idea-integrated-terminal) |
| Teclas modificadas só falham dentro do tmux | [Execute o FineCode no tmux](tmux.md) |

Use `/hotkeys` para inspecionar os atalhos ativos do FineCode. Consulte [Atalhos de teclado](keybindings.md) para alterá-los.

## Kitty

O Kitty é compatível com o protocolo de teclado necessário sem configuração adicional.

## iTerm2

O modo de terminal normal funciona sem configuração adicional.

### Corrija a rolagem lenta em tela cheia

No modo de tela cheia, o FineCode controla a área de visualização, então o iTerm2 envia eventos de roda do mouse em vez de rolar o histórico nativo do terminal. Gestos rápidos no trackpad podem mover o conteúdo apenas uma linha por vez.

Para alterar esse comportamento:

1. Abra **iTerm2 > Settings > Advanced**.
2. Pesquise **Trackpad scrolls fast?**.
3. Defina a opção como **No**.

Essa configuração vale para todo o iTerm2 e também pode alterar a rolagem nativa do trackpad. O comportamento relacionado é acompanhado na [issue 9619 do iTerm2](https://gitlab.com/gnachman/iterm2/-/work_items/9619).

## Apple Terminal

O FineCode habilita o envio aprimorado de teclas quando disponível. Se o Terminal.app ainda enviar um Return simples para `Shift+Enter`, o FineCode usa um fallback local de modificadores do macOS e o interpreta como `Shift+Enter`.

O fallback só funciona quando o FineCode roda no mesmo Mac que o Terminal.app. Não é possível inspecionar o estado local das teclas modificadoras quando o FineCode está em outra máquina via SSH.

## Ghostty

Adicione este mapeamento à configuração do Ghostty se `Alt+Backspace` não funcionar:

```text
keybind = alt+backspace=text:\x1b\x7f
```

No macOS, o arquivo de configuração é `~/Library/Application Support/com.mitchellh.ghostty/config`; no Linux, é `~/.config/ghostty/config`.

Configurações antigas do Claude Code podem conter:

```text
keybind = shift+enter=text:\n
```

Isso envia um line feed bruto, que o FineCode não consegue diferenciar de `Ctrl+J`. Remova o mapeamento se você o adicionou somente por causa de uma instalação antiga do Claude Code. O FineCode já associa `Ctrl+J` à inserção de uma nova linha, então o mapeamento pode parecer funcionar e, ainda assim, impedir que FineCode e tmux recebam um evento real de `Shift+Enter`.

### Abra links no modo de tela cheia

Os links continuam clicáveis no modo de tela cheia, mas o Ghostty não exibe o sublinhado ao passar o cursor nem a prévia do URL enquanto o FineCode captura a entrada do mouse. Mantenha `Shift+Command` pressionado no macOS ou `Shift+Ctrl` no Linux para usar o tratamento nativo de links do Ghostty.

## WezTerm

Normalmente, o WezTerm informa `Shift+Enter` usando as teclas estendidas do xterm. Para habilitar explicitamente o protocolo de teclado Kitty, crie `~/.wezterm.lua`:

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

### Encaminhe Alt+Enter no macOS

No macOS, o WezTerm associa `Option+Enter` à tela cheia por padrão. Para usá-lo na fila de mensagens de acompanhamento do FineCode, adicione esta entrada à tabela `config.keys`:

```lua
{
  key = 'Enter',
  mods = 'ALT',
  action = wezterm.action.SendString('\x1b[13;3u'),
}
```

Uma configuração mínima completa é:

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.keys = {
  {
    key = 'Enter',
    mods = 'ALT',
    action = wezterm.action.SendString('\x1b[13;3u'),
  },
}
return config
```

### Posicione a janela de candidatos do IME no WSL

Se os candidatos de um IME CJK não acompanharem o cursor de texto do FineCode no WSL, mostre o cursor de hardware:

```bash
export PI_HARDWARE_CURSOR=1
finecode
```

Você também pode definir `showHardwareCursor` como `true` nas configurações do FineCode.

## Alacritty

Normalmente, o Alacritty informa `Shift+Enter`. No macOS, `Option+Enter` pode chegar como um `Enter` simples. Adicione esta configuração a `~/.config/alacritty/alacritty.toml` para encaminhá-lo ao FineCode:

```toml
[[keyboard.bindings]]
key = "Enter"
mods = "Alt"
chars = "\u001b[13;3u"
```

Reinicie o Alacritty depois de alterar o arquivo.

## Terminal integrado do VS Code

O VS Code 1.109.5 e versões mais recentes habilitam o protocolo de teclado Kitty no terminal integrado por padrão.

Em uma versão anterior, adicione uma associação de terminal para `Shift+Enter` ao arquivo `keybindings.json`:

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

Normalmente, o arquivo `keybindings.json` do usuário fica em:

- macOS: `~/Library/Application Support/Code/User/keybindings.json`
- Linux: `~/.config/Code/User/keybindings.json`
- Windows: `%APPDATA%\\Code\\User\\keybindings.json`

## Terminal integrado do Zed

Adicione estas associações ao `keymap.json` do Zed:

```json
{
  "context": "Terminal",
  "bindings": {
    "shift-enter": ["terminal::SendText", "\u001b[13;2u"],
    "ctrl--": ["terminal::SendText", "\u001b[45;5u"],
    "ctrl-alt-]": ["terminal::SendText", "\u001b[93;7u"]
  }
}
```

## Windows Terminal

O Windows Terminal usa os padrões de atalhos do FineCode para Windows e WSL. Consulte [Atalhos de teclado](keybindings.md) para ver a lista completa.

### Encaminhe Shift+Enter

Abra o `settings.json` do Windows Terminal com `Ctrl+Shift+,` ou por **Settings > Open JSON file**. Adicione este objeto ao array `actions`:

```json
{
  "command": { "action": "sendInput", "input": "\u001b[13;2u" },
  "keys": "shift+enter"
}
```

Feche completamente e reabra o Windows Terminal; depois, verifique se `Shift+Enter` insere uma nova linha no FineCode.

### Use Alt+Enter para mensagens de acompanhamento

Por padrão, o Windows Terminal associa `Alt+Enter` à tela cheia. Por isso, no Windows e no WSL, o FineCode usa `Ctrl+Q` para mensagens de acompanhamento.

Para usar `Alt+Enter`, configure o Windows Terminal para encaminhar essa tecla e associe `app.message.followUp` a `alt+enter` em `keybindings.json` do FineCode. Consulte [Atalhos de teclado](keybindings.md#assign-keybindings).

## xfce4-terminal e Terminator

Esses terminais não conseguem diferenciar com confiabilidade as teclas Enter modificadas de um `Enter` simples. Por isso, associações personalizadas como `Ctrl+Enter` ou `Shift+Enter` podem não funcionar.

Quando precisar desses atalhos, use um terminal com suporte moderno a teclas estendidas, como Kitty, Ghostty, WezTerm, iTerm2, Windows Terminal ou uma versão compatível do Alacritty.

<a id="intellij-idea-integrated-terminal"></a>
## Terminal integrado do IntelliJ IDEA

O terminal integrado do IntelliJ IDEA não consegue diferenciar com confiabilidade `Shift+Enter` de um `Enter` simples. Use `Ctrl+J` para inserir uma nova linha ou execute o FineCode em um terminal com suporte moderno a teclas estendidas.

Se a janela de candidatos do IME não acompanhar o cursor de texto, mostre o cursor de hardware:

```bash
export PI_HARDWARE_CURSOR=1
finecode
```

<a id="override-detected-capabilities"></a>
## Substitua os recursos detectados

O FineCode detecta automaticamente hyperlinks OSC 8, protocolos de imagem em linha e suporte a truecolor. Um proxy de terminal ou multiplexador pode tornar essa detecção imprecisa.

| Recurso | Variável de ambiente | Configuração |
|---|---|---|
| Hyperlinks | `PI_HYPERLINKS=1\|0\|auto` | `terminal.hyperlinks: true\|false\|"auto"` |
| Imagens em linha | `PI_IMAGE_PROTOCOL=kitty\|iterm2\|none\|auto` | `terminal.images: "kitty"\|"iterm2"\|false\|"auto"` |
| Truecolor | `PI_TRUE_COLOR=1\|0\|auto` | `terminal.trueColor: true\|false\|"auto"` |

As configurações têm prioridade sobre as variáveis de ambiente. Um valor não definido ou `auto` mantém a detecção automática.

Force somente recursos compatíveis com todo o caminho do terminal. Sequências de escape não compatíveis podem corromper a renderização. Consulte [Variáveis de ambiente](../environment-variables.md#finecode-process-configuration) e [Configurações](settings.md) para ver as definições canônicas dos valores.

<a id="program-status"></a>
## Status do programa

O FineCode informa seu estado pelo [Program Status Protocol (OSC 7501)](https://www.superlogical.com/rex/docs/build/program-status), permitindo que terminais e painéis de agentes mostrem se está trabalhando, aguardando você, concluído ou com erro:

| Estado | Quando aparece |
|---|---|
| `working` | Uma execução do agente ou compactação está em andamento. A mensagem é o nome da sessão. |
| `blocked` | Uma caixa de diálogo de extensão ou login está aguardando você. A mensagem é o título da caixa de diálogo. |
| `done` | Uma execução terminou. A mensagem é o nome da sessão. |
| `error` | Uma execução terminou com um erro que não será repetido. A mensagem é a primeira linha do erro. |
| `idle` | O FineCode foi iniciado ou você cancelou a execução. |

Os relatórios nunca contêm prompts nem saídas do modelo. O FineCode só os envia depois que o terminal responde à consulta de suporte ao protocolo; tmux e screen não os encaminham. Defina `PI_PROGRAM_STATUS=1` para enviar relatórios sem consultar o terminal ou `PI_PROGRAM_STATUS=0` para desativá-los.
