[English](../configuration.md) | **Português (Brasil)**

# Configuração

O FineCode oferece configuração por usuário e por projeto. A configuração do usuário fica no diretório do agente, que por padrão é `~/.pi/agent`. A configuração do projeto fica em `.pi`, dentro do diretório de trabalho, e é carregada depois que a [confiança no projeto](security.md#understand-project-trust) é concedida. A única exceção é `sessionDir`, que o FineCode lê antes de resolver a confiança para localizar as sessões.

No modo interativo, use `/settings` para alterar as preferências mais comuns. Para outras opções, peça ao FineCode para atualizar a configuração ou edite os arquivos relevantes diretamente. Execute `/reload` depois de alterar manualmente configurações, atalhos de teclado, instruções ou recursos.

<a id="agent-directory"></a>
## Diretório do agente

Abaixo, o diretório do agente é representado por `<agent-dir>`. Defina sua localização com a variável de ambiente `PI_CODING_AGENT_DIR` ou com a opção [`agentDir`](../sdk.md) do SDK.

| Caminho | Finalidade |
|---|---|
| `<agent-dir>/settings.json` | [Configurações](settings.md) do usuário, incluindo preferências, padrões, caminhos de recursos e declarações de pacotes FineCode. |
| `<agent-dir>/keybindings.json` | [Atalhos de teclado](keybindings.md) personalizados para a interface de terminal e o aplicativo. |
| `<agent-dir>/mcp.json` | [Servidores MCP](../mcp.md) disponíveis em todos os projetos. |
| `<agent-dir>/models.json` | [Endpoints compatíveis, modelos e substituições de modelos](models.md#configure-a-compatible-endpoint). |
| `<agent-dir>/auth.json` | Chaves de API e credenciais OAuth salvas. |
| `<agent-dir>/AGENTS.override.md`, `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md` ou `CLAUDE.MD` | Instruções do usuário aplicadas em todos os diretórios de trabalho. |
| `<agent-dir>/SYSTEM.md` | Substitui o prompt de sistema padrão do FineCode. |
| `<agent-dir>/APPEND_SYSTEM.md` | Acrescenta instruções ao prompt de sistema do FineCode. |
| `<agent-dir>/extensions/` | [Extensões](extensions.md) do usuário. |
| `<agent-dir>/skills/` | [Skills](skills.md) do usuário e seus arquivos de apoio. |
| `<agent-dir>/prompts/` | [Modelos de prompt](../prompt-templates.md) do usuário, expostos como comandos de barra. |
| `<agent-dir>/themes/` | Arquivos de [tema](../themes.md) do usuário. |

## Diretório `.pi` do projeto

| Caminho | Finalidade |
|---|---|
| `.pi/settings.json` | [Configurações](settings.md) do projeto, caminhos de recursos e declarações de pacotes FineCode. |
| `.pi/mcp.json` | [Servidores MCP](../mcp.md) do projeto. |
| `.pi/SYSTEM.md` | Substitui o prompt de sistema do projeto. |
| `.pi/APPEND_SYSTEM.md` | Acrescenta instruções específicas do projeto ao prompt de sistema. |
| `.pi/extensions/` | Extensões do projeto. |
| `.pi/skills/` | Skills do projeto e seus arquivos de apoio. |
| `.pi/prompts/` | Modelos de prompt do projeto, expostos como comandos de barra. |
| `.pi/themes/` | Arquivos de tema do projeto. |

Para `SYSTEM.md` e `APPEND_SYSTEM.md`, o arquivo do projeto confiável tem precedência sobre o arquivo correspondente no diretório do agente. Arquivos com o mesmo nome não são combinados.

<a id="context-files"></a>
## Arquivos de contexto

Os arquivos de contexto são separados da configuração `.pi` do projeto. O FineCode os carrega do diretório do agente, do diretório de trabalho e dos diretórios ancestrais. Um arquivo de contexto se aplica sempre que o FineCode é executado no diretório correspondente ou em qualquer diretório abaixo dele.

Um `AGENTS.override.md` substitui `AGENTS.md` ou `CLAUDE.md` somente no mesmo diretório. Ele não suprime arquivos de contexto do diretório do agente nem de outros diretórios.

A descoberta de arquivos de contexto não exige confiança no projeto.
