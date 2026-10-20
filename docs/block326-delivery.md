# Bloco 326 — consolidação Git e entrega

## Proveniência e decisões

- Branch da migração: `feat/full-upstream-tree-migration`, PR destinada a `main`.
- Baseline herdada: `b35a2acfd6272ea67ec935024e137624edf79c1c`.
- Snapshot upstream Pi revisado: `e86b054753b544600693384d3db4e3281ba86b60`.
- Main incorporada por merge normal: `af100d3d1a18fb50a6700caff5e5e6b62b4cf71c`.
- O mantenedor autorizou explicitamente a inclusão das alterações correlatas dos Blocos 319–324.
- Não houve force push, rebase, encerramento de issue/PR ou merge da PR criada.

## Commits da migração

| SHA | Conteúdo |
|---|---|
| `60d4b6c8115855fedc465c4c53f8de474c4efa28` | Corrige os 22 modos executáveis upstream; blobs preservados. |
| `570bfe385` | Telemetria, armazenamento SQLite de Chord e contratos AI. |
| `e5282f928` | Telemetria Durable e runner de testes portátil. |
| `8bf033b76` | Reconcilia TUI e caminhos Windows. |
| `bb82f53ec` | Runtime coding-agent upstream com identidade e proteções FineCode. |
| `c64d63fd0` | Documentação e exemplos upstream, preservando os seis grupos excluídos. |
| `41f3e27bc` | Isolamento Evals e proteção da governança FineCode. |
| `64edaba0b` | Inventário canônico e relatórios de estabilização/reconciliação. |
| `d54d3ad9a` | Reconcilia os 11 commits de `main`: TUI FineCode, status operacional e fixture OpenRouter independente do catálogo. |
| `5dba2a778` | Mantém o renderer Pi disponível e separa o logo por distribuição para evitar conflito de integração. |
| merge de `origin/main` | Preserva a história publicada; sem conflitos de conteúdo previstos pelo `git merge-tree`. |

Os arquivos de `main` que também tocavam o TUI foram inspecionados. `footer.ts` combina o prefixo de marca FineCode com o caminho normalizado e os contadores upstream. `interactive-mode.ts` preserva tanto o status operacional quanto os marcadores de ferramenta. `openai-completions-tool-choice.test.ts` usa fixture local equivalente e deixa de depender do ID mutável `deepseek-r1` no catálogo remoto. O renderer upstream de logo Pi é preservado; a apresentação do runtime de cada distribuição usa `distribution-logo.ts`.

O report de migração preserva a proveniência Pi e classifica os 438 caminhos: 272 `UPSTREAM_APPLIED`, 36 `SEMANTICALLY_INTEGRATED`, 114 `FINECODE_PRESERVED`, 16 `INTENTIONALLY_EXCLUDED`; zero pendentes. Workflows upstream de governança operam somente no repositório upstream Pi. Os seis exemplos excluídos não foram reintroduzidos. As verificações Node/npm e suas contagens estão em [block325-reconciliation.md](block325-reconciliation.md).

## Validação local

No snapshot antes do merge de `main`: `npm run build` e `npm run check` terminaram com exit 0; a suíte completa terminou naturalmente em 624,882 s com **8.891 PASS / 0 FAIL / 957 SKIP**, incluindo TUI TAP 1.067 PASS/1 SKIP sem dupla contagem. A reconciliação de `main` passou em 35 testes focados de sete arquivos, `npm run check` e `npm run build`, todos exit 0; a prova de comportamento dos dois logotipos passou em 3 testes. A alteração final preserva o conteúdo exato do logo upstream Pi e separa a compatibilidade no componente de distribuição.

**Estado de checks remotos e PR: pendente.** Atualizar esta seção e a seção Estado após merge normal, último check/build/tests, push convencional, abertura da PR draft e coleta do resultado dos checks GitHub. Não marcar `READY_FOR_MANUAL_REVIEW` antes dos gates remotos satisfatórios. Nenhum merge da PR.
