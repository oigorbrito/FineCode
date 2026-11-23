# Prontidão para release

Este documento formaliza as práticas e evidências observáveis de liberação e ciclo de vida do FineCode para conformidade com o OpenSSF OSPS Baseline.

## Guia básico do usuário

Instruções de instalação, pré-requisitos e execução do FineCode CLI estão documentadas no [README.md](../README.md), no [README do coding-agent](../packages/coding-agent/README.md) e no [Guia Rápido](../packages/coding-agent/docs/pt-BR/quickstart.md).

## Relato de defeitos

Defeitos e solicitações de melhorias gerais são reportados no issue tracker oficial:
- [GitHub Issues](https://github.com/oigorbrito/FineCode/issues)

Vulnerabilidades de segurança seguem o processo responsável documentado em [SECURITY.md](../SECURITY.md) e [SECURITY.pt-BR.md](../SECURITY.pt-BR.md).

## Registro de alterações

Cada versão lançada possui notas de lançamento descritivas vinculadas à respectiva tag Git e entradas registradas no [CHANGELOG.md](../packages/coding-agent/CHANGELOG.md).

## Escopo e duração do suporte

No estágio atual do projeto (`exploration`, OpenSSF OSPS Target Level 1):
- O suporte é mantido diretamente pelo mantenedor ativo sobre a branch `main`.
- Correções de bugs e atualizações acompanham o ciclo contínuo de desenvolvimento; não há garantia de backport para versões legadas.

## Escopo e duração das atualizações de segurança

- Vulnerabilidades de segurança reportadas são priorizadas e incorporadas na branch `main`.
- Atualizações corretivas são liberadas através do release seguinte conforme a política descrita em [SECURITY.md](../SECURITY.md).

## Seleção e rastreamento de dependências

- Todas as dependências do monorepo são declaradas em `package.json` e fixadas estritamente em `package-lock.json`.
- A integridade das dependências é verificada continuamente pelos scripts de checagem do repositório (`npm run check:pinned-deps`, `npm run check:runtime-deps` e `npm run check:install-lock:coding-agent`).

## Verificação da integridade e autenticidade do release

- Todos os releases e tags Git são gerados a partir de commits com hash SHA criptográfico verificável no repositório oficial (`https://github.com/oigorbrito/FineCode`).
- Os artefatos distribuíveis possuem lockfile de instalação determinístico e integridade de arquivo garantida pelo npm.

## SBOM

No nível de maturidade atual (OSPS Level 1), o grafo de dependências completo e determinístico é fornecido pelo `package-lock.json` e pelos manifestos dos pacotes no monorepo.
