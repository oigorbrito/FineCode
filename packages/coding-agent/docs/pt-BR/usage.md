[English](../usage.md) | **Português (Brasil)**

# Use o FineCode no terminal

Inicie o FineCode na pasta em que deseja trabalhar:

```bash
finecode
```

A interface interativa tem uma área de conversa, um editor e um rodapé com a pasta atual, o modelo e o estado da sessão.

<p align="center"><img src="../images/interactive-mode.png" alt="Modo interativo do FineCode mostrando uma conversa, editor de entrada e rodapé de status" width="750"></p>

## Forneça contexto ao FineCode

Digite um prompt no editor e pressione `Enter` para enviá-lo. Use `@` para procurar um arquivo e incluí-lo no prompt. Use `Ctrl+V` para colar uma imagem da área de transferência.

O FineCode inclui automaticamente a pasta de trabalho como contexto. Para fornecer instruções que se apliquem sempre que o FineCode trabalhar em uma pasta, adicione um arquivo `AGENTS.md`. Consulte [Arquivos de contexto](configuration.md#context-files).

## Oriente o trabalho

O FineCode mostra as ferramentas que usa, incluindo leituras e buscas de arquivos, comandos e edições. Você pode enviar uma mensagem de acompanhamento enquanto ele trabalha; o FineCode a enfileira para o próximo turno. Use `Alt+Enter` para enfileirar uma mensagem sem interromper o turno atual.

Use `Ctrl+C` para interromper a operação atual. Pressione novamente para sair. Pressione `Ctrl+D` para sair quando o editor estiver vazio.

Execute comandos `/` no editor para gerenciar a sessão, trocar modelos, inspecionar configurações e controlar a interface. Digite `/` para ver os comandos disponíveis. Consulte [Comandos de barra](slash-commands.md) e [Atalhos de teclado](keybindings.md).

## Trabalhe com sessões

O FineCode salva sua conversa automaticamente. Execute `/resume` para selecionar uma sessão salva, `/tree` para navegar pelos ramos ou `/new` para iniciar uma sessão nova. Use `/export` para salvar a conversa como HTML.

Consulte [Sessões](sessions.md) para saber mais sobre arquivos de sessão, nomes, ramificações, compactação e exportação.

## Use o FineCode sem a interface interativa

Para uma tarefa única ou um script, use o modo print:

```bash
finecode -p "Summarize the files in this folder"
```

Use `--mode json` para receber eventos estruturados em vez de texto renderizado. Consulte a [Referência da CLI](cli.md) e o [Modo JSON](json.md).

## Controle e automatize o FineCode

Use o [modo RPC](rpc.md) para controlar o FineCode de outro processo ou incorpore-o a uma aplicação com o [SDK TypeScript](sdk.md).
