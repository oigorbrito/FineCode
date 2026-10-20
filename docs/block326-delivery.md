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
| `8227c33c6` | Merge normal de `origin/main` em `feat/full-upstream-tree-migration`; preserva os 11 commits novos da main, sem force/rebase e sem conflitos de conteúdo. |

Os arquivos de `main` que também tocavam o TUI foram inspecionados. `footer.ts` combina o prefixo de marca FineCode com o caminho normalizado e os contadores upstream. `interactive-mode.ts` preserva tanto o status operacional quanto os marcadores de ferramenta. `openai-completions-tool-choice.test.ts` usa fixture local equivalente e deixa de depender do ID mutável `deepseek-r1` no catálogo remoto. O renderer upstream de logo Pi é preservado; a apresentação do runtime de cada distribuição usa `distribution-logo.ts`.

O report de migração preserva a proveniência Pi e classifica os 438 caminhos: 272 `UPSTREAM_APPLIED`, 36 `SEMANTICALLY_INTEGRATED`, 114 `FINECODE_PRESERVED`, 16 `INTENTIONALLY_EXCLUDED`; zero pendentes. Workflows upstream de governança operam somente no repositório upstream Pi. Os seis exemplos excluídos não foram reintroduzidos. As verificações Node/npm e suas contagens estão em [block325-reconciliation.md](block325-reconciliation.md).

## Validação local

No snapshot validado antes do merge de `main`, `npm run build` e `npm run check` terminaram com exit 0; `./test.sh` terminou naturalmente em 624,882 s, exit 0, com **8.891 PASS / 0 FAIL / 957 SKIP**. A reconciliação da main passou em 35 testes focados de sete arquivos, check e build. Após merge, o build final e `npm run check` novamente terminaram com exit 0; 34 testes focados em oito arquivos e a prova dos logotipos (3 testes) passaram.

A suíte final executada no Windows durou 641,629 s e terminou exit 1 porque dois testes do Codemode excederam seus limites intactos de 5 s sob contenção (`worker backend` e `inline backend`). Os outros 221 testes daquele pacote passaram; uma execução isolada subsequente de **todo Codemode** passou com **223 PASS / 3 SKIP**. Os demais workspaces do `./test.sh` passaram. A contabilização composta por escopo é **8.913 PASS / 0 FAIL / 957 SKIP**, mas **não** representa uma execução integral única com exit 0. Os limites/asserts não foram alterados. A CI remota executará novamente a suíte em Linux.

A árvore final está limpa; `origin/main` é ancestral da branch e `git merge-tree` não aponta conflitos. SHAs da série: `60d4b6c8115855fedc465c4c53f8de474c4efa28`, `570bfe385`, `e5282f928`, `8bf033b76`, `bb82f53ec`, `c64d63fd0`, `41f3e27bc`, `64edaba0b`, `d54d3ad9a`, `5dba2a778`, `055fb109a` e merge `8227c33c6`.

## Primeira execução da CI remota

A PR #476 existe como draft. Na primeira execução remota (`39428422596`, `39428422601`, `39428422637`), upstream-pr-import-safety, upstream-mirror-reconciliation, MCP conformance, pin e os builds Ubuntu x86_64/ARM passaram. O job model-catalog falhou porque `git archive v1.3.0` procurava uma tag upstream ausente no clone FineCode. Foi corrigido para clonar a tag da origem Pi explicitamente; o workflow não precisa mais buscar todo o histórico/tag set do fork. A checagem de catálogo local agora passou: compatível com Pi 1.3.0; validação dry-run do catálogo também passou.

O job CI `build-check-test` terminou em falha durante os testes de AI; o log remoto termina ao iniciar esse workspace, sem diagnóstico de teste, sinal ou causa. No Windows pós-merge a suíte de AI passou, mas isso não substitui confirmação Linux. A matriz Nix registrou Linux x86_64/ARM aprovados e job macOS cancelado após 15 minutos; não há evidência de regressão funcional específica. Não foram reduzidos testes, modificados limites ou classificados esses resultados como PASS. O resultado integral do primeiro CI fica registrado como **falho/inconclusivo**.

Foi commitada a correção verificável do caminho do catálogo e a CI disparada de novo pela atualização da PR draft. O estado do novo run e as ações seguintes serão registrados aqui. **Não marcar `READY_FOR_MANUAL_REVIEW` até que CI e matriz Nix estejam satisfatórios.** Merge permanece manual.
