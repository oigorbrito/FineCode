[English](../slash-commands.md) | **Português (Brasil)**

# Comandos de barra

Digite `/` no editor de terminal do FineCode para pesquisar os comandos disponíveis na sessão atual. Esta página lista os comandos integrados à versão atual do FineCode.

Extensões, modelos de prompt e skills podem adicionar comandos. Portanto, o menu de comandos do FineCode é a referência exata dos recursos carregados na sessão.

## Modelos e configurações

| Comando | Descrição |
|---|---|
| `/settings` | Abre as configurações |
| `/model [provider/model]` | Seleciona um modelo |
| `/thinking [level]` | Define o nível de raciocínio |
| `/scoped-models` | Configura os modelos usados na alternância interativa |
| `/login [provider]` | Adiciona autenticação de provedor |
| `/logout` | Remove autenticação de provedor |
| `/llama` | Gerencia modelos no roteador llama.cpp configurado |

## Sessões e contexto

| Comando | Descrição |
|---|---|
| `/new` | Inicia uma nova sessão |
| `/resume` | Alterna para outra sessão salva |
| `/name [name]` | Define o nome de exibição da sessão ou, se omitido, mostra o nome atual |
| `/session` | Mostra informações e estatísticas da sessão atual |
| `/tree` | Navega pela árvore da sessão |
| `/fork` | Cria uma nova sessão a partir de uma mensagem anterior do usuário |
| `/clone` | Duplica a sessão atual na posição atual |
| `/compact [instructions]` | Compacta o contexto atual, opcionalmente com instruções personalizadas |
| `/import <path>` | Importa e retoma uma sessão JSONL |

## Exporte e compartilhe

| Comando | Descrição |
|---|---|
| `/copy` | Copia a última mensagem do assistente |
| `/export [path]` | Exporta a sessão como HTML ou JSONL |
| `/share` | Envia a sessão e retorna um link de visualização |
| `/bug [description]` | Prepara um relato privado para os desenvolvedores do Pi upstream por meio do Radius |

Revise uma sessão antes de exportá-la ou compartilhá-la. Ela pode conter prompts, argumentos de ferramentas, saídas de comandos, conteúdo de arquivos e credenciais expostas durante a conversa.

## Runtime e projeto

| Comando | Descrição |
|---|---|
| `/trust` | Salva uma decisão de confiança no projeto para futuras execuções do FineCode |
| `/reload` | Recarrega atalhos de teclado, extensões, skills, modelos, temas e arquivos de contexto |
| `/hotkeys` | Mostra os atalhos de teclado ativos |
| `/changelog` | Mostra entradas do changelog |
| `/quit` | Encerra o FineCode |

## Comandos adicionados por recursos

- Extensões podem registrar comandos com argumentos próprios e comportamento de preenchimento automático.
- Cada modelo de prompt fica disponível com o nome do próprio modelo.
- Skills ficam disponíveis como `/skill:name` quando os comandos de skills estão habilitados.

Execute `/reload` depois de adicionar ou alterar um recurso que registre comandos. Consulte [Extensões](extensions.md), [Modelos de prompt](../prompt-templates.md) e [Skills](skills.md) para conhecer as regras de carregamento e nomenclatura.
