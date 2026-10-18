[English](../how-pi-works.md) | **Português (Brasil)**

# Como o FineCode funciona

O FineCode coordena solicitações a modelos, execução de ferramentas, montagem de contexto e armazenamento de sessões. Uma sessão é o registro de uma conversa, incluindo mensagens, chamadas e resultados de ferramentas, alterações de modelo, compactações e outros eventos.

Mensagens e eventos de uma sessão formam uma árvore. Cada caminho nessa árvore é um ramo. O ramo que termina na entrada atual é o ramo ativo e fornece o histórico da próxima solicitação ao modelo.

## Ciclo do agente

Uma mensagem enviada é adicionada ao ramo ativo. O FineCode monta uma solicitação ao modelo com o prompt de sistema, o ramo ativo, as ferramentas disponíveis e as configurações do modelo, e então a envia pelo provedor selecionado.

O provedor transmite uma resposta do assistente, que pode conter texto e chamadas de ferramentas. O FineCode registra a resposta, executa cada chamada e registra os resultados. Isso conclui um turno. Se resultados de ferramentas ou mensagens enfileiradas exigirem outra solicitação ao modelo, o FineCode inicia outro turno. Caso contrário, a execução termina.

Mensagens de orientação entram depois do turno atual do assistente. Mensagens de acompanhamento entram depois que o agente conclui o trabalho pendente. Cancelar interrompe a execução atual e devolve as mensagens enfileiradas ao editor.

## Contexto

O ramo ativo fornece o histórico da conversa. O FineCode converte as entradas da sessão em mensagens de usuário, assistente e resultados de ferramentas compatíveis com o modelo.

O FineCode monta o prompt de sistema a partir das instruções básicas e dos arquivos de contexto descobertos. A solicitação também inclui definições de ferramentas e descrições de skills.

As instruções completas de skills são carregadas sob demanda. Extensões podem adicionar instruções ou transformar o contexto.

Modelos de prompt são expandidos na entrada do editor antes de ela se tornar uma mensagem do usuário. Arquivos selecionados, imagens, texto colado e saída de shell podem se tornar conteúdo de mensagens.

## Sessões

Sessões persistentes são arquivos JSONL. Cada entrada da árvore tem um ID e aponta para sua entrada pai. A entrada atual identifica o ramo ativo.

Continuar a partir de uma entrada anterior cria outro ramo no mesmo arquivo. Criar um fork ou clone copia o histórico selecionado para um novo arquivo de sessão.

O contexto do modelo é reconstruído a partir do ramo ativo. A compactação insere uma entrada de resumo que substitui mensagens antigas nas solicitações posteriores ao modelo. As entradas originais continuam na árvore da sessão.

## Interfaces

O modo interativo renderiza eventos da sessão e do agente no terminal. O modo print executa um prompt e grava a resposta final. O modo JSON grava eventos do agente como JSONL.

O modo RPC recebe comandos JSONL em stdin e grava respostas e eventos em stdout. O SDK TypeScript cria e controla sessões do agente no próprio processo.

Todas as interfaces usam os mesmos mecanismos de agente e sessão.

## Extensões e recursos

Extensões são módulos TypeScript carregados no processo FineCode. Suas fábricas registram ferramentas, comandos, atalhos, provedores, handlers de eventos, renderizadores e interface de terminal.

Skills fornecem instruções e arquivos auxiliares carregados sob demanda. Modelos de prompt fornecem texto reutilizável para mensagens. Temas definem cores do terminal. Pacotes FineCode distribuem esses recursos por npm ou git.

## Confiança e permissões

O FineCode resolve a confiança no projeto antes de carregar configurações e recursos dele. Depois da decisão de confiança e do carregamento de recursos do projeto, o FineCode carrega os arquivos de contexto. Ferramentas habilitadas usam as permissões do sistema operacional do processo FineCode. Extensões são executadas dentro desse processo.
