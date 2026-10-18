[English](../shell-aliases.md) | **Português (Brasil)**

# Configure comandos de shell

O FineCode inicia um processo de shell separado e não interativo para cada comando Bash. Por padrão, o Bash não expande aliases em modo não interativo e geralmente não carrega os mesmos arquivos de inicialização de um terminal interativo.

Use `shellPath` para escolher o executável Bash e `shellCommandPrefix` para executar configurações antes de cada comando.

## Entenda qual shell o FineCode usa

| Origem do comando | Shell |
|---|---|
| O modelo chama a ferramenta integrada `bash` | Executável Bash resolvido pelo FineCode |
| Você digita `!command` ou `!!command` | O mesmo executável Bash resolvido |
| O modelo chama a ferramenta opcional `powershell` | PowerShell 7 (`pwsh.exe`) ou Windows PowerShell |
| Uma extensão fornece ou substitui uma ferramenta de shell | Operações implementadas por essa extensão |

Normalmente, o FineCode invoca o Bash com `bash -c`. Em sistemas Unix, usa `/bin/bash`, depois `bash` no `PATH` e, por fim, `sh` se o Bash não estiver disponível. No Windows nativo, primeiro verifica o caminho configurado, depois o Git Bash e então `bash.exe` no `PATH`.

## Escolha um executável Bash

Defina `shellPath` em `~/.pi/agent/settings.json` quando o FineCode precisar usar um executável específico:

```json
{
  "shellPath": "~/.local/bin/bash"
}
```

No Windows, use barras normais ou escape as barras invertidas:

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```

Execute `/reload` depois de alterar a configuração. Consulte [Execute o FineCode no Windows](windows.md) para ver os padrões do Windows nativo.

## Execute configurações antes de cada comando Bash

Defina `shellCommandPrefix` para acrescentar configurações de shell à ferramenta `bash` integrada e aos comandos `!` e `!!` digitados pelo usuário:

```json
{
  "shellCommandPrefix": "export CI=1"
}
```

O FineCode une o prefixo e o comando solicitado com uma quebra de linha. O prefixo é executado novamente a cada comando; mantenha-o rápido e sem prompts interativos.

## Habilite aliases do Bash

Em vez de analisar toda a configuração de um shell interativo, armazene os aliases necessários ao FineCode em um arquivo compatível com Bash.

Crie `~/.bash_aliases`:

```bash
alias ll='ls -la'
alias gs='git status --short'
```

Em seguida, configure o FineCode para habilitar a expansão de aliases e carregar o arquivo:

```json
{
  "shellCommandPrefix": "shopt -s expand_aliases\nsource ~/.bash_aliases"
}
```

Execute `/reload` e verifique o alias no FineCode:

```text
!ll
```

O comando deve exibir a mesma listagem que `ls -la`.

Aliases precisam usar sintaxe compatível com Bash. Não carregue um `.zshrc` arbitrário no Bash: opções, funções e plugins do zsh podem não ser analisados ou funcionar corretamente.

## Solução de problemas

### O prefixo funciona com `!`, mas não com uma ferramenta de extensão

`shellCommandPrefix` configura a execução Bash integrada do FineCode. Uma extensão que substitui a ferramenta `bash` ou fornece suas próprias operações de shell controla a própria configuração. Consulte a documentação dessa extensão.

### `shopt` não é encontrado

O FineCode recorreu ao `sh` ou `shellPath` aponta para um shell que não é Bash. Instale o Bash ou defina `shellPath` para um executável Bash antes de usar configurações específicas, como `shopt`.

### Um comando de configuração aguarda entrada

Remova comandos interativos de `shellCommandPrefix`. O prefixo é executado em um processo não interativo antes de cada comando Bash.

Para ver as definições completas, consulte [Configurações de shell](settings.md#shell).
