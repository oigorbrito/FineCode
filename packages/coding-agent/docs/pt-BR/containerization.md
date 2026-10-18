[English](../containerization.md) | **Português (Brasil)**

# Execute o FineCode em um ambiente isolado

Use um ambiente isolado para limitar os arquivos, credenciais, processos e serviços de rede que comandos gerados podem acessar ou afetar.

Você pode isolar todo o processo do FineCode ou manter o FineCode no host e direcionar ferramentas específicas para um ambiente isolado. O pacote npm do FineCode ainda não foi publicado; o comando de instalação abaixo se aplica quando ele estiver disponível. A seção Docker Sandboxes documenta o kit do Pi upstream, não uma imagem FineCode. O exemplo de OpenShell é genérico e exige uma imagem fornecida por você com o FineCode instalado.

## Escolha um método de isolamento

| Método | Onde o FineCode é executado | O que fica isolado | Como as credenciais são tratadas | Indicado para |
|---|---|---|---|---|
| Docker simples | Contêiner | FineCode, ferramentas integradas, comandos `!` e extensões | Credenciais passadas ao contêiner | Um limite simples de contêiner local |
| Docker Sandboxes | Kit do Pi upstream (não do FineCode) | Processo e ferramentas do Pi upstream | O proxy do kit substitui as credenciais de provedor configuradas | Referência para a integração upstream; não há suporte a uma imagem FineCode |
| OpenShell | Sandbox local ou remoto | FineCode, ferramentas integradas, comandos `!` e extensões | Credenciais e roteamento de inferência controlados por políticas | Políticas de sistema de arquivos, processos, rede e credenciais |
| Extensão Gondolin | Host | Ferramentas integradas e comandos `!` | As credenciais armazenadas do FineCode permanecem no host, mas os comandos herdam as variáveis de ambiente do host | Uma microVM local para executar ferramentas mantendo a interface no host |

O método escolhido altera onde as extensões são executadas. Quando todo o processo do FineCode roda em um ambiente isolado, suas extensões também rodam nele. Quando o FineCode no host delega as ferramentas integradas ao Gondolin, as ferramentas de outras extensões continuam rodando no host, a menos que também deleguem seu trabalho.

## Decida o que o FineCode pode acessar

Um processo isolado ainda pode afetar os recursos que você expuser a ele:

- Uma montagem do host com permissão de leitura e gravação permite que o FineCode altere esses arquivos do host.
- Montar `~/.pi/agent` expõe as credenciais, configurações, extensões e sessões do FineCode.
- Variáveis de ambiente passadas a um contêiner ficam disponíveis aos processos em execução nele.
- O acesso à rede pode permitir que código ou saídas de ferramentas deixem o ambiente.
- O isolamento somente das ferramentas não restringe o processo do FineCode no host nem ferramentas de extensão que não usem o backend isolado.

Exponha somente a pasta de trabalho, as credenciais e os destinos de rede necessários para a tarefa. Use montagens somente para leitura ou copie arquivos para dentro e para fora do ambiente quando não quiser que gravações afetem o host.

## Execute o FineCode em Docker simples

Docker simples oferece o limite de contêiner mais fácil para isolar todo o processo.

### Crie a imagem

Crie `Dockerfile.finecode`:

```dockerfile
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts finecode

WORKDIR /workspace
ENTRYPOINT ["finecode"]
```

Compile a imagem no diretório que contém o arquivo:

```bash
docker build -t finecode-sandbox -f Dockerfile.finecode .
```

### Inicie o FineCode

Na pasta de trabalho à qual deseja dar acesso ao FineCode, execute:

```bash
docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v finecode-agent-home:/root/.pi/agent \
  finecode-sandbox
```

Substitua `ANTHROPIC_API_KEY` pela credencial exigida pelo seu provedor. O volume nomeado `finecode-agent-home` mantém as configurações, credenciais e sessões locais do contêiner entre execuções.

Não monte o diretório `~/.pi/agent` do host, a menos que o contêiner deva ter acesso à configuração e às credenciais do FineCode no host.

### Verifique o workspace

Dentro do FineCode, execute:

```text
!pwd
```

O comando deve exibir `/workspace`. As alterações em `/workspace` também são gravadas na pasta do host montada. Remova a montagem vinculada ou use uma montagem somente para leitura se isso não for aceitável.

## Referência: kit do Pi upstream para Docker Sandboxes

O [Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) pode executar o kit do Pi upstream dentro de um sandbox gerenciado. Esse kit não é uma imagem FineCode; use-o somente como referência para a integração upstream. O proxy pode manter a credencial real do provedor no host e substituí-la quando as solicitações saem do sandbox.

Configure as credenciais antes de criar o sandbox. Não execute `/login` dentro dele, pois isso grava uma credencial real no sandbox.

### Use um token Claude Pro ou Max

Gere o token com `claude setup-token` em uma máquina com Claude Code. Se já houver um segredo `anthropic` configurado, remova-o primeiro para que o proxy não acrescente um cabeçalho de chave de API junto ao token bearer:

```bash
sbx secret rm anthropic

sbx secret set-custom \
  --host api.anthropic.com \
  --env ANTHROPIC_OAUTH_TOKEN \
  --placeholder 'sk-ant-oat01-{rand}'
```

`sbx secret set-custom` lê o token real da entrada padrão. O sandbox recebe um valor substituto no formato OAuth, que o proxy substitui somente para solicitações ao host configurado.

Para uma chave de API Anthropic, use `sbx secret set anthropic`.

### Inicie o Pi upstream

Execute este comando na pasta de trabalho que deseja montar:

```bash
sbx run --kit "docker.io/sbx/pi-kit:latest" pi
```

Para um sandbox existente, execute a CLI do Pi upstream sem interação:

```bash
sbx exec <sandbox-name> -- pi -p "list the failing tests"
```

Consulte a documentação do [kit do Pi upstream](https://github.com/docker/sbx-kits-contrib/tree/main/pi) para informações sobre outros provedores, solução de problemas e fixação de imagens.

## Execute o FineCode com OpenShell

O [NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview) fornece sandboxes locais ou remotos com políticas de sistema de arquivos, processos, rede, credenciais e inferência.

### Selecione um gateway

Todo sandbox exige um gateway ativo:

```bash
openshell gateway add <gateway-url> --name <name>
openshell gateway select <name>
```

### Crie o sandbox

Defina `FINECODE_SANDBOX_IMAGE` para uma imagem que já tenha o executável `finecode` instalado e crie o sandbox:

```bash
openshell sandbox create --name finecode-sandbox --from "$FINECODE_SANDBOX_IMAGE" -- finecode
```

O FineCode, suas ferramentas integradas, os comandos `!` e as ferramentas das extensões são executados dentro do limite do OpenShell.

### Transfira arquivos para um sandbox remoto

Um gateway remoto não monta a pasta de trabalho do host. Clone o repositório dentro do sandbox ou transfira os arquivos explicitamente:

```bash
openshell sandbox upload finecode-sandbox ./working-folder /workspace
openshell sandbox download finecode-sandbox /workspace/working-folder ./working-folder-out
```

O roteamento de inferência do OpenShell pode manter as credenciais brutas do modelo fora do sandbox. Quando estiver configurado, aponte o FineCode para o endpoint compatível com OpenAI ou Anthropic disponibilizado pelo gateway.

## Direcione ferramentas pelo Gondolin

O [Gondolin](https://github.com/earendil-works/gondolin) é uma microVM Linux local. Seu exemplo de extensão mantém o processo FineCode e as credenciais de provedores em arquivos no host, enquanto direciona as ferramentas integradas e os comandos `!` do usuário para a VM.

Os comandos dentro da VM herdam o ambiente do processo host. Portanto, chaves de provedor fornecidas por variáveis de ambiente podem ficar visíveis dentro da VM. Não use esse padrão como limite de proteção de credenciais, a menos que remova as variáveis sensíveis ou altere o tratamento de ambiente da extensão.

O Gondolin exige Node.js 23.6 ou superior e QEMU instalado pelo gerenciador de pacotes do sistema operacional.

### Instale a extensão

Em um checkout do código-fonte do FineCode:

```bash
mkdir -p ~/.pi/agent/extensions
cp -R packages/coding-agent/examples/extensions/gondolin ~/.pi/agent/extensions/gondolin
cd ~/.pi/agent/extensions/gondolin
npm install --ignore-scripts
```

### Inicie o FineCode

Execute o FineCode na pasta de trabalho que deseja montar:

```bash
cd /path/to/working-folder
finecode -e ~/.pi/agent/extensions/gondolin
```

A extensão monta a pasta de trabalho do host em `/workspace` na VM e substitui `read`, `write`, `edit`, `bash`, `grep`, `find` e `ls`. Alterações em arquivos sob `/workspace` também são gravadas no host.

As demais ferramentas de extensão continuam sendo executadas no host, a menos que deleguem explicitamente suas operações. Revise o [exemplo do Gondolin](../../examples/extensions/gondolin/) antes de adicionar ferramentas que possam contornar o limite da VM.
