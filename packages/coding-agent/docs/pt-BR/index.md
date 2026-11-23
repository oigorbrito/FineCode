[English](../index.md) | **Português (Brasil)**

# FineCode

FineCode é um agente de IA extensível que funciona no seu terminal. Dê a ele um objetivo e uma pasta de trabalho para que possa inspecionar arquivos, executar comandos, editar conteúdo e realizar tarefas com várias etapas.

Use o FineCode para desenvolvimento de software, anotações de pesquisa, projetos de escrita, arquivos de dados ou atividades pessoais. Você pode usá-lo como está, pedir que se adapte ao seu fluxo de trabalho ou criar outros aplicativos com o SDK.

## Comece a usar o FineCode

Nunca usou o FineCode? Siga o [Guia rápido](quickstart.md) para instalá-lo, conectar um modelo e concluir sua primeira tarefa.

Se o FineCode já estiver instalado, escolha o que deseja fazer:

- [Usar o FineCode de forma interativa](usage.md) para adicionar arquivos, executar comandos, orientar tarefas em andamento e exportar resultados.
- [Escolher um modelo](models.md) ou conectar uma assinatura, chave de API, modelo local ou endpoint compatível.
- [Continuar ou ramificar uma sessão](sessions.md) para retomar o trabalho ou explorar outra abordagem sem perder o histórico.
- [Configurar o FineCode](configuration.md) com suas preferências, pastas de trabalho, instruções e recursos reutilizáveis.
- [Entender como o FineCode funciona](../how-pi-works.md), incluindo ferramentas, contexto, sessões e o ciclo do agente.

## Personalize o FineCode

O FineCode pode reutilizar prompts, carregar instruções especializadas, adicionar integrações executáveis, mudar sua interface de terminal, conectar serviços de modelos e distribuir esses recursos como pacotes.
Use o [seletor de personalização do Guia rápido](quickstart.md#choose-how-to-customize-finecode) para escolher o mecanismo mais simples que atenda à sua necessidade.

## Automatize ou incorpore o FineCode

- Use o [modo print](cli.md#invocation-and-output) para tarefas pontuais e em scripts.
- Use o [modo de fluxo de eventos JSON](../json.md) para consumir eventos estruturados de uma execução.
- Use o [modo RPC](../rpc.md) para controlar um processo separado do FineCode.
- Use o [SDK de TypeScript](../sdk.md) para executar o FineCode dentro de um aplicativo.

## Consulte referências e informações de configuração

Consulte as páginas de referência para buscar [opções da CLI](cli.md), [configurações](settings.md), [provedores](providers.md), [atalhos de teclado](keybindings.md) e [variáveis de ambiente](../environment-variables.md).

Para ajuda específica de cada plataforma, consulte [Configuração do terminal](terminal-setup.md), [Windows](windows.md), [tmux](tmux.md), [Termux no Android](termux.md) ou [Conteinerização](containerization.md).

Alguns links para código-fonte nestas páginas de referência apontam ao repositório Pi upstream (`earendil-works/pi`) e podem diferir deste checkout do FineCode.

## Trabalhe com segurança

As ferramentas e extensões do FineCode são executadas com as permissões do processo do FineCode. A confiança do projeto controla quais recursos do projeto são carregados, mas não cria um sandbox para as chamadas de ferramentas. Leia [Segurança](security.md) antes de usar arquivos, repositórios, extensões ou automações sem supervisão que não sejam confiáveis.
