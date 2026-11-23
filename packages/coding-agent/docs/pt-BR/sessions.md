[English](../sessions.md) | **Português (Brasil)**

# Sessões e contexto

O FineCode salva uma conversa como sessão. O ramo ativo dessa sessão fornece o histórico da conversa para a próxima solicitação ao modelo. Use os comandos de sessão para continuar o trabalho, explorar outro ramo ou reduzir a quantidade de histórico enviada ao modelo.

## Continue ou troque de sessão

O FineCode salva sessões automaticamente, a menos que seja iniciado com `--no-session`.

```bash
finecode --continue
finecode --resume
```

`--continue` abre a sessão mais recente do diretório de trabalho atual. `--resume` abre o seletor de sessões. No modo interativo, `/resume` abre o mesmo seletor e `/new` inicia uma sessão nova.

Use `/name` ou `--name` para dar um nome reconhecível à sessão. Execute `/session` para conferir o arquivo da sessão atual, o ID, a quantidade de mensagens, o uso de tokens e o custo.

O seletor de sessões permite pesquisar, renomear e excluir sessões. Também permite exibir caminhos, alterar a ordenação e limitar os resultados às sessões com nome. Consulte [Atalhos de teclado](keybindings.md#sessions) para ver os atalhos.

## Escolha como criar ramificações

O FineCode armazena as entradas em uma árvore, portanto, voltar a um ponto anterior não apaga o ramo deixado para trás.

| Ação | Resultado | Use quando |
|---|---|---|
| `/tree` | Navega dentro do arquivo da sessão atual | Alternativas relacionadas devem permanecer juntas |
| `/fork` | Cria uma sessão nova a partir de uma mensagem anterior do usuário | A alternativa deve se tornar um trabalho separado |
| `/clone` | Copia o ramo ativo para uma sessão nova | Você quer uma cópia separada do estado atual |

Em `/tree`, selecione uma mensagem do usuário para devolver seu texto ao editor. Edite e envie-o para criar outro ramo. Selecionar uma resposta do assistente ou outra entrada continua a conversa depois daquela entrada, com o editor vazio.

Ao sair de um ramo, o FineCode pode resumi-lo e anexar o resumo ao ramo em que você entrou. Isso preserva o trabalho relevante do caminho abandonado sem incluir todas as mensagens dele.

Para ver a árvore persistida e os tipos de entrada, consulte [Formato de sessão](../session-format.md).

<a id="manage-conversation-context"></a>
## Gerencie o contexto da conversa

O modelo recebe o ramo ativo, não todos os ramos do arquivo da sessão. O FineCode combina esse histórico com o prompt de sistema, os arquivos de contexto descobertos, as ferramentas disponíveis e as descrições das skills carregadas. [Como o FineCode funciona](../how-pi-works.md#context) explica como essas entradas são reunidas.

O rodapé mostra o uso atual de contexto. Quando o contexto ativo se aproxima do limite do modelo, normalmente o FineCode compacta automaticamente o histórico mais antigo. A compactação adiciona um resumo e mantém as mensagens recentes. Ela não exclui as entradas originais da sessão.

Execute `/compact` para compactar manualmente. Você pode acrescentar instruções sobre tópicos ou decisões que o resumo deve preservar. Configure a compactação automática e o histórico retido em [Configurações](settings.md#compaction).

A compactação pode falhar se o provedor estiver indisponível ou não puder aceitar a solicitação de resumo. Corrija o problema do provedor e execute `/compact` novamente. Desativar a compactação automática não desativa o comando manual.

Consulte a [Referência de compactação](../compaction.md) para conhecer limites, trechos preservados, comportamento dos resumos de ramificação e hooks de extensão.

## Controle o armazenamento das sessões

Por padrão, o FineCode armazena as sessões em `~/.pi/agent/sessions/`, agrupadas por diretório de trabalho. Use `--session-dir`, `PI_CODING_AGENT_SESSION_DIR` ou a configuração `sessionDir` para escolher outro local. A opção da CLI tem a maior prioridade.

Use `--no-session` para uma execução temporária. Não é possível retomar uma sessão temporária depois que o FineCode é encerrado.

Use `--session` quando já souber o caminho ou ID da sessão. Use `--fork` para criar uma sessão nova a partir de uma existente antes de iniciar o modo interativo.

## Exporte ou compartilhe uma sessão

Use `/export` para gravar a sessão atual como HTML ou JSONL. Use `/share` para enviá-la e obter um link de visualização. Por padrão, o FineCode usa um artefato Radius quando a autenticação Radius está configurada; caso contrário, usa um gist privado do GitHub. Por padrão, as prévias de gist usam o visualizador upstream do Pi em `https://pi.dev/session/`; substitua-o com `PI_SHARE_VIEWER_URL`. O FineCode não opera esse visualizador. Defina [`sessionShareDestination`](settings.md#sessions-and-context) como `gist` ou `radius` para forçar um destino.

Revise as sessões exportadas ou compartilhadas antes de enviá-las. Elas podem conter prompts, respostas do modelo, argumentos de ferramentas, saídas de comandos, conteúdo de arquivos e mensagens de extensões.

## Relate um bug

Execute `/bug [description]` para preparar um relato privado para os desenvolvedores do Pi upstream por meio do Radius. Você pode incluir a transcrição da sessão, omiti-la ou pedir ao modelo atual que resuma o problema. Revise a transcrição ou o resumo gerado, pois podem conter dados sensíveis da conversa.

O relato inclui informações do ambiente e da configuração do provedor, mas não os valores das credenciais, além de diagnósticos de erros registrados. Envie-o pelo gateway Radius configurado (o host upstream padrão é `radius.pi.dev`) ou exporte o mesmo relato em um arquivo zip para inspecioná-lo e compartilhá-lo por conta própria. O envio não exige login; a autenticação Radius associa o relato à sua conta para que os desenvolvedores possam entrar em contato. Se o envio falhar, o FineCode oferecerá a opção de exportar o arquivo zip.
