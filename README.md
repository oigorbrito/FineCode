# Template de Repositório Orientado por Evidências

Este repositório é um **harness inicial**, não uma afirmação de maturidade ou conformidade.

Seu objetivo é fazer com que um novo repositório comece com:

- instruções de projeto versionadas e evidências de engenharia;
- um comando mínimo de verificação executável;
- estado do projeto legível por máquina;
- gatilhos explícitos de maturidade/release;
- relatórios com falha fechada (`PASS`, `GAP`, `UNKNOWN_EXTERNAL`, `NOT_APPLICABLE`);
- um caminho para controles mais fortes à medida que requisitos definidos externamente se tornem aplicáveis.

## Verificação canônica

```bash
python scripts/harness.py
python -m unittest discover -s tests -v
```

## Checklist de primeiro uso

Você pode executar o setup automático:
```bash
python scripts/bootstrap.py
```

Ou seguir os passos manuais:
1. Substitua o nome e a finalidade do projeto abaixo.
2. Selecione uma licença real e salve-a como `LICENSE` (consulte `LICENSE-SELECT.md`).
3. Atualize `policy/project-state.json` somente com fatos observáveis.
4. Implemente o projeto em `src/` e os testes em `tests/`.
5. Configure as Regras do Repositório do GitHub / proteção de branch fora do repositório.
6. Habilite o OpenSSF Scorecard usando `.github/workflows/scorecard.yml.example` depois de fixar cada action em um SHA de commit exato.

## Finalidade do projeto

O **FineCode** é uma distribuição de agente de desenvolvimento autônomo e assistente de codificação no terminal (TUI e RPC), fornecendo ferramentas de leitura, edição de arquivos, execução de comandos e integração com dezenas de provedores de modelos de linguagem (Anthropic, OpenAI, Google Gemini, Ollama, DeepSeek, Minimax, etc.), com documentação e localização em Português (pt-BR).

## Uso básico

### Pré-requisitos
- Node.js 22 ou superior
- npm 10 ou superior

### Instalação e Execução

```bash
# 1. Instalar dependências do monorepo e compilar pacotes
npm install
npm run build

# 2. Executar o binário diretamente via Node.js
node packages/coding-agent/dist/cli.js --help

# 3. Ou registrar o binário globalmente
npm --prefix packages/coding-agent link
finecode --help

# 4. Iniciar a interface interativa no terminal
finecode
```

Para detalhes sobre atalhos, comandos slash, templates e configuração de provedores, consulte o [Guia Rápido](packages/coding-agent/docs/pt-BR/quickstart.md) e a [Documentação de Modelos](packages/coding-agent/docs/pt-BR/models.md).

## Relato de defeitos

Use GitHub Issues para defeitos não sensíveis. Vulnerabilidades de segurança devem seguir `SECURITY.md`.

## Semântica de maturidade

`product_stage` em `policy/project-state.json` é apenas informativo. Termos como `MVP` **não** são tratados como prova de um nível de maturidade OpenSSF.

O alvo normativo de maturidade de segurança é `osps_target_level`, e toda promoção deve ser sustentada por evidências observáveis. Consulte `docs/MATURITY.md`.
