[English](README.md) | **Português (Brasil)**

<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
</p>

# FineCode

FineCode é um agente de programação minimalista e extensível, derivado do Pi. Seu comando canônico é `finecode`; o pacote npm não expõe um alias `pi`.

Personalize o FineCode com [extensões](packages/coding-agent/docs/pt-BR/extensions.md), [skills](packages/coding-agent/docs/pt-BR/skills.md), [modelos de prompt](packages/coding-agent/docs/pt-BR/prompt-templates.md) e [temas](packages/coding-agent/docs/pt-BR/themes.md). Agrupe recursos em pacotes e compartilhe-os pelo npm ou pelo git.

O FineCode oferece padrões avançados e pode ser estendido para se adaptar ao seu fluxo de trabalho. Use-o [interativamente](packages/coding-agent/docs/pt-BR/usage.md), automatize-o nos modos [print ou JSON](packages/coding-agent/docs/pt-BR/cli.md), controle-o por [RPC](packages/coding-agent/docs/rpc.md) ou incorpore o SDK. Consulte o [OpenClaw](https://github.com/OpenClaw/OpenClaw) para ver uma integração real.

## Primeiros passos

O pacote npm do FineCode ainda não foi publicado. Após o lançamento, instale a CLI com Node.js 22.19 ou superior:

```bash
npm install -g --ignore-scripts finecode
```

Inicie com `finecode`. A instalação pelo npm não fixa dependências transitivas e não exige scripts de ciclo de vida das dependências.

Inicie o FineCode no diretório em que deseja trabalhar:

```bash
cd /path/to/project
finecode
```

Para usar um provedor de IA integrado, execute `/login` dentro do FineCode para conectar uma assinatura ou chave de API. Em seguida, atribua uma tarefa.

Consulte a [documentação local](packages/coding-agent/docs/pt-BR/index.md) para instruções de configuração e uso. Os serviços `pi.dev` mencionados nos links continuam sendo recursos upstream do Pi. A documentação herdada pode usar `pi` e `.pi`; o FineCode usa `finecode` e, por padrão, `.finecode`.

## Executar com Nix

Talvez seja necessário habilitar flakes e `nix-command` no Nix. Adicione `experimental-features = nix-command flakes` a `~/.config/nix/nix.conf` ou habilite-os para um único comando com `nix --extra-experimental-features 'nix-command flakes' run .`.

Com flakes habilitados, execute o FineCode a partir de um checkout:

```bash
nix run .
```

Instale o checkout em um perfil Nix com `nix profile install .`. A flake disponibiliza `finecode` como pacote principal e mantém `pi` como alias. Há suporte a ARM64 e x86-64 no Linux e no macOS.

Os builds do Nix são offline; por isso, os dados de modelos incluídos vêm de uma revisão do catálogo upstream `pi.dev`, fixada em `nix/model-catalog.json`. Em tempo de execução, o FineCode pode sobrepor esses dados com uma versão mais recente do catálogo desse serviço upstream. O fluxo de trabalho do Nix atualiza a revisão fixada em `main` quando ela deixa de corresponder ao checkout, por exemplo, após a adição de um provedor ou de um novo tipo de modelo. Para atualizá-la manualmente:

```bash
npm run update:model-catalog-pin
```

## Pacotes

Este monorepo contém a CLI do FineCode e as bibliotecas que a dão suporte.

| Pacote | Descrição |
|---------|-------------|
| **[@earendil-works/chord](packages/chord)** | Runtime tipado de host para plugins com hot reload, contratos, estado replicado e RPC por links JSON |
| **[@earendil-works/pi-telemetry](packages/telemetry)** | Contratos de telemetria independentes de fornecedor, adaptador de referência, testes de conformidade e schemas tipados |
| **[@earendil-works/pi-ai](packages/ai)** | API unificada para LLMs de vários provedores (OpenAI, Anthropic, Google etc.) |
| **[@earendil-works/pi-durable](packages/durable)** | Runtime durável para conversas, tarefas e documentos |
| **[@earendil-works/pi-agent-core](packages/agent)** | Runtime de agente com chamadas de ferramentas e gerenciamento de estado |
| **[finecode](packages/coding-agent)** | CLI interativa de agente de programação |
| **[@earendil-works/pi-tui](packages/tui)** | Biblioteca de interface para terminal |

Para automação e fluxos de trabalho com Slack/chat, consulte [earendil-works/pi-chat](https://github.com/earendil-works/pi-chat).

## Permissões e conteinerização

O FineCode não inclui um sistema de permissões integrado para restringir o acesso ao sistema de arquivos, a processos, à rede ou a credenciais. Por padrão, ele usa as permissões do usuário e do processo que o iniciou.

Se precisar de limites mais rigorosos, execute o FineCode em um contêiner ou sandbox. Consulte [packages/coding-agent/docs/pt-BR/containerization.md](packages/coding-agent/docs/pt-BR/containerization.md) para conhecer três abordagens:

- **Extensão Gondolin**: mantenha o FineCode e a autenticação do provedor no host, enquanto direciona as ferramentas integradas e os comandos `!` para uma microVM Linux local.
- **Docker simples**: execute todo o processo do FineCode em um contêiner local para obter isolamento simples.
- **OpenShell**: execute o FineCode em um sandbox controlado por políticas.

## Como contribuir

O FineCode é mantido como um projeto solo. Issues e pull requests não são fechados automaticamente com base em aprovação de colaboradores, mas o envio não garante revisão nem aceitação. Consulte [CONTRIBUTING.pt-BR.md](CONTRIBUTING.pt-BR.md) para as orientações atuais e [AGENTS.md](AGENTS.md) para as regras de desenvolvimento.

## Desenvolvimento

```bash
npm install --ignore-scripts  # Instala todas as dependências sem executar scripts de ciclo de vida
npm run build         # Atualiza os dados de modelos e, em seguida, compila todos os pacotes
npm run build:offline # Recompila usando os dados de modelos existentes, sem acesso à rede
npm run check         # Executa lint, formatação e verificação de tipos
./test.sh            # Executa os testes (ignora testes que dependem de LLM sem chaves de API)
./pi-test.sh         # Executa o FineCode a partir do código-fonte (nome legado do script; pode ser chamado de qualquer diretório)
```

### Usar pacotes locais fora do monorepo

Compile todos os pacotes públicos em um conjunto local de artefatos coerente:

```bash
npm run pack:packages -- --out .artifacts/pi-packages
```

Esse comando atualiza os dados de modelos antes de compilar `pi-ai`. Para evitar acesso à rede quando os dados de modelos já estiverem carregados, passe `--offline-model-data`.

Em seguida, configure um projeto externo para usar um pacote e resolver todas as dependências do workspace a partir do mesmo conjunto de artefatos. O npm é o gerenciador padrão:

```bash
node scripts/use-local-packages.mjs \
  --manifest .artifacts/pi-packages/manifest.json \
  --consumer ../my-project \
  --package @earendil-works/pi-durable \
  --package @earendil-works/pi-agent-core
cd ../my-project
npm install --ignore-scripts
```

Em um projeto pnpm, indique a raiz do workspace em `--consumer`:

```bash
node scripts/use-local-packages.mjs \
  --manifest .artifacts/pi-packages/manifest.json \
  --consumer ../my-project \
  --package @earendil-works/pi-agent-core \
  --package-manager pnpm
cd ../my-project
pnpm install --ignore-scripts
```

Repita `--package` para cada dependência direta. O comando atualiza o `package.json` do projeto consumidor com referências locais `file:` endereçadas por conteúdo. Ele grava as substituições transitivas em `package.json` no caso do npm ou em `pnpm-workspace.yaml` no caso do pnpm. Mantenha o diretório de artefatos disponível durante a instalação ou atualização do projeto consumidor. Execute novamente os dois comandos depois de alterar o código-fonte do FineCode.

## Binários independentes do Pi upstream (referência)

Os comandos abaixo descrevem o processo de lançamento do Pi upstream, não downloads do FineCode. O FineCode ainda não publica arquivos de código-fonte nem binários independentes. As versões do Pi upstream no GitHub incluem um arquivo compactado do código-fonte com versão, coberto pelo arquivo `SHA256SUMS` da versão. Extraia-o e execute o script de build a partir desse código-fonte:

```bash
VERSION="<release-version>"
tar -xzf "pi-${VERSION}-source.tar.gz"
cd "pi-${VERSION}"
./scripts/build-binaries.sh --offline-model-data --platform linux-x64 --out "$PWD/out"
```

O arquivo inclui os dados de modelos da versão e os prebuilds nativos. `--offline-model-data` usa esses dados sem atualizar os catálogos de provedores. O script instala as dependências e compila o executável com seus recursos de runtime; passe `--skip-install` se as dependências já estiverem disponíveis.

## Reforço da segurança da cadeia de suprimentos

Tratamos alterações nas dependências npm como alterações de código que precisam ser revisadas.

- As dependências diretas do registro, incluindo dependências internas do workspace, são fixadas em versões exatas.
- `.npmrc` define `save-exact=true` e `min-release-age=2` para evitar que o npm resolva versões de dependências publicadas no mesmo dia.
- `package-lock.json` é a fonte de verdade das dependências. O pre-commit bloqueia alterações acidentais no lockfile, a menos que `PI_ALLOW_LOCKFILE_CHANGE=1` esteja definido.
- `npm run check` verifica as dependências diretas fixadas, a compatibilidade dos imports nativos de TypeScript e o install-lock gerado do coding-agent.
- O pacote Nix instala a partir de `packages/coding-agent/install-lock/`, gerado com base no lockfile raiz, para fixar as dependências transitivas. O pacote npm não fixa as dependências transitivas.
- Os testes locais de instalação de release e a publicação no npm usam o mesmo empacotador de tarballs; o npm publica os tarballs validados em vez de reempacotar os diretórios do workspace.
- As instalações locais de release, as instalações npm documentadas e `finecode update --self` usam `--ignore-scripts` quando houver suporte.
- O CI instala com `npm ci --ignore-scripts`, e um workflow agendado do GitHub executa `npm audit --omit=dev` e `npm audit signatures --omit=dev`.
- A geração do install-lock usa uma allowlist explícita para scripts de ciclo de vida das dependências; dependências novas com esses scripts falham nas verificações até serem revisadas.

## Compartilhamento de sessões do Pi upstream

Os links a seguir descrevem o projeto de compartilhamento de sessões da comunidade Pi upstream; eles não são serviços do FineCode.

Para a explicação completa, consulte [esta publicação no X](https://x.com/badlogicgames/status/2037811643774652911). Contribuidores do Pi upstream podem usar [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf) com uma conta Hugging Face e a CLI.

Consulte [este vídeo](https://x.com/badlogicgames/status/2041151967695634619) e as sessões de trabalho publicadas do `pi-mono`:

- [badlogicgames/pi-mono no Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)

O domínio `pi.dev` do projeto Pi upstream foi gentilmente doado pela [exe.dev](https://exe.dev).

## Licença

MIT
