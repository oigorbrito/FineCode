[English](../windows.md) | **Português (Brasil)**

# Execute o FineCode no Windows

Execute o FineCode como processo nativo do Windows ou dentro do Windows Subsystem for Linux (WSL). No Windows nativo, o Bash usa o Git Bash por padrão e, opcionalmente, o modelo pode ter acesso ao PowerShell. No WSL, o FineCode usa o ambiente Linux e sua instalação do Bash.

Siga o [Guia rápido](quickstart.md) para instalar e autenticar o FineCode. Use esta página para escolher e configurar o ambiente de comandos.

## Escolha entre Windows nativo e WSL

| Ambiente | Ambiente de comandos | Use quando |
|---|---|---|
| Windows nativo com Git Bash | Git Bash para a ferramenta `bash` integrada e comandos `!` | Seus arquivos e ferramentas de desenvolvimento ficam principalmente no Windows |
| Windows nativo com a ferramenta `powershell` | PowerShell para chamadas de ferramentas do modelo; Bash continua disponível para comandos `!` | A tarefa depende de módulos do PowerShell ou comandos nativos do Windows |
| WSL | Bash e ferramentas Linux na distribuição WSL selecionada | Seus arquivos e ferramentas já ficam no Linux ou WSL |

## Use Git Bash no Windows nativo

Para a maioria das pessoas que usam Windows nativo, basta instalar o [Git para Windows](https://git-scm.com/download/win).

O FineCode procura o Bash nesta ordem:

1. `shellPath` em `~/.pi/agent/settings.json`
2. Git Bash em `Program Files` ou `Program Files (x86)`
3. `bash.exe` no `PATH`, incluindo Cygwin, MSYS2 ou o Bash legado do WSL

Inicie o FineCode e execute este comando para verificar o shell:

```text
!printf 'Bash is working\n'
```

Se não encontrar o Bash, o FineCode informa os locais verificados. Instale o Git para Windows, adicione outro executável Bash ao `PATH` ou configure `shellPath`.

## Permita que o modelo use PowerShell

A ferramenta opcional `powershell` executa comandos por `pwsh.exe` quando disponível e, caso contrário, usa o Windows PowerShell. Ela inicia o PowerShell com `-NoProfile -NonInteractive -ExecutionPolicy Bypass`. Políticas de execução impostas por um administrador ainda podem ter prioridade.

Para substituir a ferramenta `bash` visível ao modelo por `powershell`, adicione isto a `~/.pi/agent/settings.json`:

```json
{
  "defaultTools": ["read", "powershell", "edit", "write"]
}
```

`["-bash", "+powershell"]` faz o mesmo e mantém outras ferramentas padrão configuradas.

Reinicie o FineCode e peça que execute um comando PowerShell inofensivo. Os comandos `!` e `!!` do editor continuam usando Bash. A ferramenta `powershell` só fica disponível quando o FineCode é executado como processo nativo do Windows.

Consulte [Configurações](settings.md#tools) para outras combinações de ferramentas.

## Use um executável Bash personalizado

Defina `shellPath` quando o Bash estiver instalado em um local que o FineCode não detecta automaticamente:

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```

JSON usa barras invertidas como caracteres de escape. Ao escrever um caminho do Windows com barras invertidas, duplique cada uma, como no exemplo.

Consulte [Configure comandos de shell](shell-aliases.md) para ver prefixos de comandos, aliases e o comportamento completo de resolução do shell.

## Configure o Windows Terminal

O Windows Terminal reserva ou reescreve algumas teclas modificadas. Consulte [Windows Terminal](terminal-setup.md#windows-terminal) para configurar `Shift+Enter` e `Alt+Enter`, e [Atalhos de teclado](keybindings.md) para os padrões do FineCode no Windows e WSL.
