[English](../prompt-templates.md) | **Português (Brasil)**

# Modelos de prompt

Modelos de prompt transformam arquivos Markdown em comandos `/` reutilizáveis. Use um modelo para reaproveitar o mesmo prompt sem adicionar comportamento executável nem um conjunto maior de instruções e arquivos auxiliares.

Um modelo pode aceitar argumentos e aparecer no preenchimento automático de comandos. O FineCode pode carregar modelos da configuração pessoal, da configuração do projeto, de um caminho explícito ou de um pacote FineCode. A configuração do projeto só é carregada depois que você confia no projeto.

## Crie um modelo

Crie `~/.pi/agent/prompts/review.md`:

```markdown
---
description: Review staged git changes
argument-hint: "[focus]"
---
Review the staged changes. Focus on ${1:-correctness, security, and error handling}.
```

O nome do arquivo se torna o nome do comando; portanto, este modelo fica disponível como `/review`. A `description` aparece no preenchimento automático. Se ela for omitida, o FineCode usa a primeira linha não vazia do arquivo.

`argument-hint` é opcional. Use `<colchetes angulares>` para argumentos obrigatórios e `[colchetes retos]` para opcionais.

Execute `/reload` depois de adicionar ou alterar um modelo durante uma sessão ativa.

<a id="invoke-a-template"></a>

## Use um modelo

Digite o comando do modelo no editor:

```text
/review
/review concurrency
```

O FineCode expande o modelo antes que o texto resultante entre no agente. Extensões recebem primeiro a entrada original pelo evento `input`, a menos que um comando de extensão com o mesmo nome a trate.

Os modelos aceitam estas substituições:

| Sintaxe | Resultado |
|---|---|
| `$1`, `$2`, … | Um argumento posicional |
| `$@` ou `$ARGUMENTS` | Todos os argumentos, unidos por espaços |
| `${1:-default}` | O primeiro argumento ou um valor padrão |
| `${@:-default}` | Todos os argumentos ou um valor padrão |
| `${@:N}` | Argumentos a partir da posição `N` |
| `${@:N:L}` | `L` argumentos a partir da posição `N` |

Os argumentos seguem regras de citação semelhantes às do shell; portanto, `/review "API compatibility"` fornece um único argumento com espaço.

<a id="choose-where-it-loads"></a>

## Adicione o modelo ao FineCode

Coloque o modelo no diretório pessoal ou de projeto para prompts. Os diretórios convencionais de prompts carregam somente arquivos `.md` diretamente contidos neles.

Configurações e pacotes podem selecionar arquivos Markdown em subdiretórios; o manifesto de um pacote também pode restringir a descoberta com caminhos e padrões glob explícitos. Consulte [Configurações](settings.md#resources) e [Pacotes FineCode](packages.md).

Modelos do projeto aparecem como comandos no editor depois que você confia no projeto. Revise o conteúdo antes de confiar em um projeto desconhecido. Consulte [Segurança](security.md#understand-project-trust).
