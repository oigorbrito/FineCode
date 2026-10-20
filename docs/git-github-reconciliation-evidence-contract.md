# FineCode — contrato de evidências para reconciliação Git/GitHub

Data da auditoria: 2026-10-20. Base remota observada: `main` em `86349f1041a486d177d9f539d03f9e22313ff23f`. Escopo: qualificar as conclusões da migração upstream e dos worktrees locais; **não** atestar paridade integral.

## 1. Matriz documental: comando → evidência → limite

| Operação | Evidência sustentada | Não sustenta | Fonte oficial |
|---|---|---|---|
| `git rev-list --left-right --count A...B` | Contagem de commits alcançáveis exclusivamente por A e B | Igualdade de árvores, de patches, worktree limpo ou equivalência funcional | https://git-scm.com/docs/git-rev-list |
| `git merge-base --is-ancestor A B` | Relação de ancestralidade, se exit code 0 | Que modificações locais estejam em B | https://git-scm.com/docs/git-merge-base |
| `git diff --name-status A B` | Nomes e classificações de diferenças entre árvores A e B | Igualdade de conteúdo de worktrees, relevância funcional ou qualidade | https://git-scm.com/docs/git-diff |
| `git diff A B -- path` | Patch entre os dois objetos para o caminho | Que o patch seja seguro para aplicação em outra base | https://git-scm.com/docs/git-diff |
| `git status --porcelain=v1 -uall` | Índice, diretório de trabalho e untracked não ignorados de um worktree | Commits exclusivos, stashes e arquivos ignorados | https://git-scm.com/docs/git-status |
| `git worktree list --porcelain` | Worktrees registrados, branch e HEAD | Integridade ou limpeza do conteúdo de cada diretório | https://git-scm.com/docs/git-worktree |
| `git ls-tree -r <ref>` | Objetos e modos registrados na árvore da referência | Conteúdo não commitado | https://git-scm.com/docs/git-ls-tree |
| `git hash-object -- <arquivo>` | Hash do conteúdo do arquivo; comparar com hash de blob da referência requer mesmo tipo de objeto/normalização | Comportamento de execução; alterações ignoradas ou múltiplas referências por si só | https://git-scm.com/docs/git-hash-object |
| Checks REST para SHA da PR | Resultado de jobs publicados para aquele SHA | Revisão humana, abrangência dos testes, paridade upstream, resultado pós-merge | https://docs.github.com/en/rest/checks/runs |
| Reviews REST da PR | Reviews efetivamente registradas, autor e estado | Revisão não registrada ou aprovação que ainda não ocorreu | https://docs.github.com/en/rest/pulls/reviews |
| Merge REST com `sha` | Merge da HEAD esperada quando GitHub aceita a operação | Que todas as conclusões técnicas anteriores estejam corretas | https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request |
| Regras de proteção / checks obrigatórios | Restrições configuradas para a branch e SHA atual | Uma política de revisão mais estrita que a configuração do GitHub | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches |

**Detalhe crítico:** `git diff A...B` usa o merge-base como lado inicial; não equivale em geral a `git diff A B`. Para paridade entre duas árvores em SHAs fixos, usar `git diff A B` e armazenar ambos os SHAs. Fonte: https://git-scm.com/docs/git-diff

## 2. Estado histórico observado — não extrapolar

- PR #476 (migração) incorporada: a branch remota `feat/full-upstream-tree-migration` aparecia sem commits exclusivos em relação à `main`; isto demonstra histórico incluído, **não** paridade com upstream atual nem absorção de arquivos locais pendentes.
- Snapshot `pi-upstream/main` local identificado como `e86b05475...`; seu nome não demonstra atualização recente. Registrar URL da origem, SHA completo e data de coleta antes de alegar que é atual.
- Relatórios locais anteriores indicaram 578 entradas idênticas à `main` de então no worktree PR #476, com 2 diferentes, e diferenças nos Blocos 17/19. Essas contagens são **evidências referenciadas a uma base anterior**, não substituem reexecução contra `main` atual.
- PRs #500, #501 e #502 foram integradas por merge manual; aprovação dos checks não implica, sozinha, aprovação formal de review. O inventário de reviews e a verificação pós-merge são gates distintos.
- PR #503: `head=9215918e7058fa22680e01a6e5538cd8bc438358`; na consulta desta auditoria, `build-check-test` em andamento, outros jobs aprovados. Estado **não aprovado para merge**.

## 3. Evidência mínima por linha de reconciliação

Registrar: `id`, origem e tipo (upstream original / branch canônica interna / worktree / PR), URL remota quando houver, SHA completo da origem, SHA completo de `main`, arquivo(s), tipo de divergência (histórico / árvore / índice / working tree / funcional), comando exato, exit code, hashes de blob ou patch quando relevante, artefato de saída, conclusão autorizada pelo método, limitação, decisão (`equivalente`, `adotar`, `preservar`, `rejeitar`, `indeterminado`), justificativa e testes associados. Nunca mudar `indeterminado` para `equivalente` só por contagens de commits ou nomes de arquivo.

## 4. Gates obrigatórios

1. **Proveniência:** identificar a branch canônica **modificada** dentro do FineCode por evidência; não presumir que `sync/pi-upstream-1402973a` seja a fonte canônica só pelo nome.
2. **Inventário local:** coletar todos os worktrees, status index/worktree, branches locais não publicadas, stashes relevantes, e sinalizar ignorados potencialmente relevantes sem limpá-los.
3. **Histórico:** `rev-list`, `merge-base` e, onde necessário, patch-equivalência (`git cherry` ou `rev-list --cherry-pick`), anotando que patch-equivalência não é funcionalidade equivalente.
4. **Conteúdo:** confrontar árvores e conteúdo do disco contra SHAs fixos, preservar patches/objetos e tratar arquivos ausentes como ausentes, não como erro fatal.
5. **Comportamento:** testes relevantes por subsistema, com regressões FineCode e upstream; diffs que apaguem proteções não entram sem motivação e teste substituto.
6. **GitHub:** registrar checks do HEAD e estado de reviews/draft, conflitos, discussões e políticas de branch. Distinguir **revisão técnica documentada** de **review APPROVED**.
7. **Merge manual:** confirmar SHA do HEAD ao solicitar merge; nunca habilitar auto-merge. Verificar SHA da `main` após merge e executar/inspecionar validação pós-merge aplicável.

## 5. Pendências abertas

- Determinar branch interna canônica efetiva e atualizá-la sem substituição destrutiva.
- Reconciliar conteúdo local dos Blocos 17 e 19 e trabalho não commitado da PR #476 sobre a `main` atual.
- Verificar correspondência ao upstream **atual** mediante HEAD e proveniência verificados, mantendo distinção entre snapshot histórico e origem viva.
- Completar CI/revisão da PR #503; não aceitar `green` isolado como prova de paridade.
- Validar os merges #500–#502 retrospectivamente contra a árvore combinada pós-merge.

**Conclusão permitida nesta etapa:** métodos e limites formalizados para execução auditável. **Conclusão proibida:** “FineCode 100% fiel” ou “zero regressões”, sem evidências de todos os gates.
