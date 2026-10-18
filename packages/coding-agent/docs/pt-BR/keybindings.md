[English](../keybindings.md) | **Português (Brasil)**

# Referência de atalhos de teclado

O FineCode oferece ações nomeadas, como `app.session.new`, às quais podem ser associados atalhos de teclado. Você pode alterar associações padrão ou atribuir teclas a ações ainda não associadas na [configuração do usuário](configuration.md#agent-directory) do FineCode.

Execute `/hotkeys` para ver os atalhos ativos do editor principal e do aplicativo.

<a id="assign-keybindings"></a>
## Associe atalhos de teclado

Crie `<agent-dir>/keybindings.json`. O diretório do agente é `~/.pi/agent` por padrão e está descrito em [Diretório do agente](configuration.md#agent-directory).

O FineCode inclui seu [schema de atalhos de teclado](../../schemas/keybindings.schema.json). O URL `$id` é hospedado pelo Pi upstream e mantido por compatibilidade; o FineCode não hospeda endpoints de schemas.

Associe cada identificador de ação a uma tecla ou a uma lista de teclas:

```json
{
  "$schema": "https://pi.dev/schemas/keybindings.schema.json",
  "app.session.new": "ctrl+shift+n",
  "app.session.tree": ["ctrl+shift+t", "alt+shift+t"]
}
```

Um valor configurado substitui o padrão daquela ação. Use uma lista vazia para desativar os atalhos de uma ação:

```json
{
  "tui.altScreen.pageUp": []
}
```

Depois de editar o arquivo, execute `/reload` para aplicar as alterações à sessão ativa.

## Sintaxe das teclas

Escreva uma tecla como `modificador+tecla`. Os modificadores são `ctrl`, `shift`, `alt` e `super`. É possível combinar modificadores. As teclas válidas são:

- **Letras:** `a-z`
- **Dígitos:** `0-9`
- **Especiais:** `escape`, `esc`, `enter`, `return`, `tab`, `space`, `backspace`, `delete`, `insert`, `clear`, `home`, `end`, `pageUp`, `pageDown`, `up`, `down`, `left`, `right`
- **Função:** `f1`-`f12`
- **Símbolos:** `` ` ``, `-`, `=`, `[`, `]`, `\`, `;`, `'`, `,`, `.`, `/`, `!`, `@`, `#`, `$`, `%`, `^`, `&`, `*`, `(`, `)`, `_`, `+`, `|`, `~`, `{`, `}`, `:`, `<`, `>`, `?`

Exemplos: `ctrl+shift+x`, `alt+ctrl+x`, `ctrl+shift+alt+x`, `super+k`, `ctrl+super+k` e `ctrl+1`.

Associações com `super` exigem um terminal que informe esse modificador separadamente, normalmente por meio do protocolo de teclado Kitty. Elas podem não funcionar em terminais sem esse suporte.

## Ações

### Interface de terminal

#### Movimento do cursor

| ID do atalho | Padrão | Descrição |
|---|---|---|
| `tui.editor.cursorUp` | `up` | Move o cursor para cima; no início, percorre o histórico mais antigo |
| `tui.editor.cursorDown` | `down` | Move o cursor para baixo; no fim, percorre o histórico mais recente |
| `tui.editor.historyPrevious` | Nenhum | Seleciona a entrada anterior do histórico de prompts |
| `tui.editor.historyNext` | Nenhum | Seleciona a próxima entrada do histórico de prompts |
| `tui.editor.cursorLeft` | `left`, `ctrl+b` | Move o cursor para a esquerda |
| `tui.editor.cursorRight` | `right`, `ctrl+f` | Move o cursor para a direita |
| `tui.editor.cursorWordLeft` | `alt+left`, `ctrl+left`, `alt+b` | Move o cursor uma palavra para a esquerda |
| `tui.editor.cursorWordRight` | `alt+right`, `ctrl+right`, `alt+f` | Move o cursor uma palavra para a direita |
| `tui.editor.cursorLineStart` | `home`, `ctrl+a` | Move para o início da linha |
| `tui.editor.cursorLineEnd` | `end`, `ctrl+e` | Move para o fim da linha |
| `tui.editor.jumpForward` | `ctrl+]` | Avança até o próximo caractere indicado |
| `tui.editor.jumpBackward` | `ctrl+alt+]` | Volta até o caractere indicado anterior |
| `tui.editor.pageUp` | `pageUp`, `ctrl+pageUp` | Rola uma página para cima |
| `tui.editor.pageDown` | `pageDown`, `ctrl+pageDown` | Rola uma página para baixo |

As ações dedicadas ao histórico percorrem o histórico de prompts independentemente da posição do cursor e têm prioridade sobre ações do aplicativo associadas à mesma tecla.

#### Edição de texto

| ID do atalho | Padrão | Descrição |
|---|---|---|
| `tui.editor.deleteCharBackward` | `backspace` | Exclui o caractere anterior |
| `tui.editor.deleteCharForward` | `delete`, `ctrl+d` | Exclui o próximo caractere |
| `tui.editor.deleteWordBackward` | `ctrl+w`, `alt+backspace` | Exclui a palavra anterior |
| `tui.editor.deleteWordForward` | `alt+d`, `alt+delete` | Exclui a próxima palavra |
| `tui.editor.deleteToLineStart` | `ctrl+u` | Exclui até o início da linha |
| `tui.editor.deleteToLineEnd` | `ctrl+k` | Exclui até o fim da linha |
| `tui.editor.yank` | `ctrl+y` | Cola o texto excluído mais recentemente |
| `tui.editor.yankPop` | `alt+y` | Alterna entre textos excluídos depois de colar com yank |
| `tui.editor.undo` | `ctrl+-` (`ctrl+z` no Windows; `alt+z` no WSL) | Desfaz a última edição |

#### Entrada e seleção

| ID do atalho | Padrão | Descrição |
|---|---|---|
| `tui.input.newLine` | `shift+enter`, `ctrl+j` | Insere uma nova linha |
| `tui.input.submit` | `enter` | Envia a entrada |
| `tui.input.tab` | `tab` | Insere uma tabulação ou completa automaticamente |
| `tui.input.copy` | `ctrl+c` | Copia a seleção |
| `tui.select.up` | `up` | Move a seleção para cima |
| `tui.select.down` | `down` | Move a seleção para baixo |
| `tui.select.pageUp` | `pageUp` | Avança uma página para cima na lista |
| `tui.select.pageDown` | `pageDown` | Avança uma página para baixo na lista |
| `tui.select.confirm` | `enter` | Confirma a seleção |
| `tui.select.cancel` | `escape`, `ctrl+c` | Cancela a seleção |

<a id="tui-fullscreen-viewport"></a>
#### Tela cheia

No modo de tela cheia, estas ações controlam a transcrição e têm prioridade sobre ações do editor associadas à mesma tecla.

| ID do atalho | Padrão | Descrição |
|---|---|---|
| `tui.altScreen.pageUp` | `pageUp` | Rola a transcrição uma página para cima |
| `tui.altScreen.pageDown` | `pageDown` | Rola a transcrição uma página para baixo |
| `tui.altScreen.halfPageUp` | Nenhum | Rola a transcrição meia página para cima |
| `tui.altScreen.halfPageDown` | Nenhum | Rola a transcrição meia página para baixo |
| `tui.altScreen.lineUp` | Nenhum | Rola a transcrição uma linha para cima |
| `tui.altScreen.lineDown` | Nenhum | Rola a transcrição uma linha para baixo |
| `tui.altScreen.previousPrompt` | `ctrl+shift+up`, `ctrl+up` (`ctrl+up` somente no Windows e WSL) | Vai para a mensagem marcada anterior |
| `tui.altScreen.nextPrompt` | `ctrl+shift+down`, `ctrl+down` (`ctrl+down` somente no Windows e WSL) | Vai para a próxima mensagem marcada |
| `tui.altScreen.search` | `ctrl+shift+f` (`ctrl+f` no Windows e WSL) | Pesquisa na transcrição renderizada |
| `tui.altScreen.searchNext` | `enter`, `ctrl+g` | Seleciona a próxima ocorrência durante a pesquisa |
| `tui.altScreen.searchPrevious` | `shift+enter`, `ctrl+shift+g` | Seleciona a ocorrência anterior durante a pesquisa |
| `tui.altScreen.searchClose` | `escape` | Fecha a pesquisa na transcrição |
| `tui.altScreen.top` | `ctrl+home` | Rola até o início da transcrição |
| `tui.altScreen.bottom` | `ctrl+end` | Rola até o fim da transcrição e acompanha novas saídas |

### Aplicativo

| ID do atalho | Padrão | Descrição |
|---|---|---|
| `app.interrupt` | `escape` | Cancela ou interrompe a execução |
| `app.clear` | `ctrl+c` | Limpa o editor (primeiro toque) ou sai (segundo toque) |
| `app.exit` | `ctrl+d` | Sai quando o editor está vazio |
| `app.suspend` | `ctrl+z` (nenhum no Windows) | Suspende o processo em segundo plano |
| `app.editor.external` | `ctrl+g` | Abre no editor externo (`externalEditor`, `$VISUAL`, `$EDITOR`, Notepad no Windows ou `nano` em outros sistemas) |
| `app.clipboard.pasteImage` | `ctrl+v` (`alt+v` no Windows e WSL) | Cola arquivos no macOS, imagens ou texto da área de transferência |

No Windows nativo, `app.suspend` não tem associação padrão porque os terminais do Windows não oferecem controle de tarefas Unix. Se você o associar manualmente, o FineCode exibirá uma mensagem de status em vez de suspender. O WSL usa o comportamento normal de `ctrl+z` e `fg`.

<a id="sessions"></a>
### Sessões

| ID do atalho | Padrão | Descrição |
|---|---|---|
| `app.session.new` | Nenhum | Inicia uma nova sessão (`/new`) |
| `app.session.tree` | Nenhum | Abre o navegador da árvore de sessões (`/tree`) |
| `app.session.fork` | Nenhum | Cria uma ramificação da sessão atual (`/fork`) |
| `app.session.resume` | Nenhum | Abre o seletor de retomada de sessões (`/resume`) |
| `app.session.togglePath` | `ctrl+p` | Alterna a exibição do caminho |
| `app.session.toggleSort` | `ctrl+s` | Alterna o modo de ordenação |
| `app.session.toggleNamedFilter` | `ctrl+n` | Alterna o filtro que mostra somente sessões nomeadas |
| `app.session.rename` | `ctrl+r` | Renomeia a sessão |
| `app.session.delete` | `ctrl+d` | Exclui a sessão |
| `app.session.deleteNoninvasive` | `ctrl+backspace` | Exclui a sessão quando a consulta está vazia |

<a id="models-and-thinking"></a>
### Modelos e raciocínio

| ID do atalho | Padrão | Descrição |
|---|---|---|
| `app.model.select` | `ctrl+l` | Abre o seletor de modelos |
| `app.model.cycleForward` | `ctrl+p` | Alterna para o próximo modelo |
| `app.model.cycleBackward` | `shift+ctrl+p` (`alt+p` no Windows e WSL) | Alterna para o modelo anterior |
| `app.models.save` | `ctrl+s` | Salva nas configurações o modelo padrão ou a configuração de modelos com escopo selecionada |
| `app.thinking.cycle` | `shift+tab` | Alterna o nível de raciocínio |
| `app.thinking.save` | `ctrl+s` | Salva nas configurações o nível de raciocínio atual |
| `app.thinking.toggle` | `ctrl+t` | Recolhe ou expande blocos de raciocínio |

<a id="display-and-message-queue"></a>
### Exibição e fila de mensagens

| ID do atalho | Padrão | Descrição |
|---|---|---|
| `app.tools.expand` | `ctrl+o` | Recolhe ou expande a saída das ferramentas |
| `app.message.copy` | `ctrl+x` | Copia a mensagem selecionada em `/tree`; no modo de tela cheia, copia a seleção ativa se `fullscreenCopyOnSelect` for `false`; caso contrário, copia a última mensagem do assistente. Nas telas de login OAuth, copia a URL de login |
| `app.message.followUp` | `alt+enter` (`ctrl+q` no Windows e WSL) | Enfileira uma mensagem de acompanhamento |
| `app.message.dequeue` | `alt+up` (`alt+q` no Windows e WSL) | Devolve as mensagens enfileiradas ao editor |

### Navegação em árvore

| ID do atalho | Padrão | Descrição |
|---|---|---|
| `app.tree.foldOrUp` | `ctrl+left`, `alt+left` | Recolhe o segmento atual do ramo ou vai ao início do segmento anterior |
| `app.tree.unfoldOrDown` | `ctrl+right`, `alt+right` | Expande o segmento atual do ramo ou vai ao início do próximo segmento ou ao fim do ramo |
| `app.tree.editLabel` | `shift+l` | Edita o rótulo do nó selecionado na árvore |
| `app.tree.toggleLabelTimestamp` | `shift+t` | Alterna a exibição de horários nos rótulos da árvore |
| `app.tree.filter.default` | `ctrl+d` | Define o filtro da árvore para a visualização padrão |
| `app.tree.filter.noTools` | `ctrl+t` | Alterna o filtro que oculta os resultados das ferramentas |
| `app.tree.filter.userOnly` | `ctrl+u` | Alterna o filtro que mostra somente mensagens do usuário |
| `app.tree.filter.labeledOnly` | `ctrl+l` | Alterna o filtro que mostra somente entradas com rótulo |
| `app.tree.filter.all` | `ctrl+a` | Alterna o filtro que mostra todas as entradas |
| `app.tree.filter.cycleForward` | `ctrl+o` | Avança para o próximo filtro da árvore |
| `app.tree.filter.cycleBackward` | `shift+ctrl+o` | Volta para o filtro anterior da árvore |

### Seletor de modelos com escopo

Usado dentro do seletor de modelos com escopo (aberto por `/scoped-models`).

| ID do atalho | Padrão | Descrição |
|---|---|---|
| `app.models.enableAll` | `ctrl+a` | Habilita todos os modelos ou todos os que correspondem à pesquisa atual |
| `app.models.clearAll` | `ctrl+x` | Desabilita todos os modelos ou todos os que correspondem à pesquisa atual |
| `app.models.toggleProvider` | `ctrl+p` | Alterna todos os modelos do provedor atual |
| `app.models.reorderUp` | `alt+up` | Move o modelo selecionado para cima na ordem de alternância |
| `app.models.reorderDown` | `alt+down` | Move o modelo selecionado para baixo na ordem de alternância |
