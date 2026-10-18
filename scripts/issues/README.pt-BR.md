# Revisão de issues e pull requests do Pi upstream

Ferramenta local e somente leitura para revisar o repositório upstream do Pi, `earendil-works/pi`. Ela não gerencia issues do FineCode e nunca grava no GitHub. As requisições ao GitHub usam a API REST com o método `GET` explícito.

O fluxo é:

1. **Sincronização.** Mantém uma cópia local das issues e dos pull requests upstream em `data/corpus.json`. A sincronização inicial de issues cobre os últimos 120 dias; depois, ocorre a cada 20 minutos e usa o cursor `since` salvo. Cada sincronização também atualiza todos os PRs atualmente abertos, inclusive os mais antigos. PRs encontrados tanto pelo endpoint de issues quanto pelo endpoint de pull requests são deduplicados pelo número. PRs fechados ou integrados são consultados quando atualizados dentro da janela de sincronização de issues. Eventos da timeline são lidos com paginação para PRs novos ou atualizados; listas paginadas de commits são atualizadas quando um PR aparece pela primeira vez ou quando seu head muda.
2. **Triagem de issues.** Cada issue nova recebe uma conversa própria com um agente [pi-durable](../../packages/durable/README.md). O agente:
   - pesquisa duplicatas e issues relacionadas na cópia local (`search_issues`, `read_issue`)
   - escolhe uma categoria em `categories/*.md`
   - escreve um resumo de uma frase e sinais
   - sugere p0, p1 ou nenhuma prioridade
3. **Revisão.** A interface mantém a caixa de entrada de issues e adiciona a aba **Upstream PRs**. Os cartões de PR mostram estado, branches, commits e alterações observadas. Você pode registrar uma decisão local (`Não revisado`, `Portar como está`, `Adaptar antes de portar` ou `Não portar`) e uma anotação privada. Essas marcações servem apenas para revisão: nenhum código é portado, integrado ou mesclado automaticamente.

O histórico de PRs deduplica eventos paginados da timeline do GitHub e detalhes de commits, inclusive mudanças de ciclo de vida ocorridas entre sincronizações. Só são importados eventos posteriores ao cursor compartilhado (120 dias na primeira execução); o histórico já armazenado não é podado. SHAs de commits já registrados também permanecem no corpus local. A triagem de issues, o histórico de PRs e as decisões ficam armazenados localmente. Nada é escrito no GitHub upstream. Para receber notificações do GitHub, configure as opções **Watch** de `earendil-works/pi`.

Todo o estado fica em `data/` (ignorado pelo Git):

- `corpus.json`: cópias locais de issues e PRs, atividade/commits observados e decisões/histórico de revisão dos PRs
- `triage.sqlite`: armazenamento do pi-durable com uma conversa por issue triada, resultados da triagem e decisões de issues no documento `triage.state`
- `token`: token de acesso à interface

Ao reiniciar o servidor, tarefas de triagem em andamento são retomadas; decisões locais e cursores de sincronização são preservados.

## Arquivos

- `categories/*.md`: um arquivo por categoria de issue. O nome do arquivo é o rótulo da categoria. O campo `owner` no frontmatter indica o usuário GitHub responsável.
- `prompt.md`: procedimento de triagem de issues e orientação de prioridade para o agente.
- `main.ts`: loop de sincronização e servidor HTTP.
- `triage.ts`: agente durável de triagem de issues.
- `github.ts`: corpus local, acesso somente leitura à API GitHub, atividade de PRs e busca por palavras-chave em issues.
- `ui.html`: interface local de revisão.
- `source-hooks.mjs`, `register.mjs`: executam os pacotes do workspace a partir do código-fonte, sem necessidade de build.

## Execução

```bash
./scripts/issues/run.sh   # http://127.0.0.1:7788
```

Abra uma vez `http://127.0.0.1:7788/?t=<token>`, usando o token de `scripts/issues/data/token`. O servidor define um cookie e as visitas seguintes não precisam do token na URL.

O agente de triagem de issues autentica por `~/.pi/agent/auth.json`, as mesmas credenciais usadas pelo pi. A revisão de PRs é local e não invoca um agente.

| Variável | Padrão | Descrição |
|---|---|---|
| `TRIAGE_MODEL` | `openai-codex/gpt-5.6-sol` | `provedor/modelo`. Provedores suportados: `openai-codex`, `anthropic`. |
| `TRIAGE_THINKING` | `medium` | Nível de raciocínio |
| `TRIAGE_CONCURRENCY` | `4` | Triagens de issues em paralelo |
| `TRIAGE_INBOX_DAYS` | `2` | Na primeira execução, define quantos dias para trás começa a caixa de entrada |
| `TRIAGE_CORPUS_DAYS` | `120` | Histórico inicial de issues; PRs abertos são listados independentemente da idade |
| `TRIAGE_SYNC_MINUTES` | `20` | Intervalo de sincronização |
| `TRIAGE_PORT` | `7788` | Porta local |
| `TRIAGE_SOCKET` | — | Usa este socket Unix em vez da porta, por exemplo, com um proxy reverso |
| `TRIAGE_DATA` | `scripts/issues/data` | Diretório de estado |

## Teclas da interface

- `j`/`k`: navegar entre issues
- `0`, `1`, `n`: definir p0, p1 ou nenhuma prioridade
- `o`: abrir a issue selecionada no GitHub
