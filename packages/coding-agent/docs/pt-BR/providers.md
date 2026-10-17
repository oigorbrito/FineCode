[English](../providers.md) | **Português (Brasil)**

# Provedores

A maioria dos provedores hospedados oferece um ou ambos estes métodos de autenticação:

- Entrar por um fluxo OAuth em navegador ou dispositivo.
- Informar uma chave de API.

Use `/login [provider]` para ver os métodos compatíveis com um provedor. Amazon Bedrock e Google Vertex AI também podem usar credenciais de nuvem disponíveis no ambiente.

<a id="authenticate-interactively"></a>
## Autentique-se de forma interativa

Execute `/login` e selecione um provedor. O FineCode orienta você pelo fluxo OAuth ou de chave de API e salva a credencial resultante em [`auth.json`](configuration.md#agent-directory).

Em uma máquina remota ou sem interface gráfica, o callback OAuth pode não chegar ao processo local. Quando solicitado, cole no FineCode a URL de redirecionamento final ou o código de autorização.

Execute `/logout` e selecione um provedor para remover a credencial armazenada. Isso não remove variáveis de ambiente, não apaga autenticação de `models.json` e não revoga a credencial junto ao provedor.

`auth.json` pode conter chaves de API e tokens OAuth. Mantenha-o privado e não o envie para o repositório.

<a id="use-an-api-key-from-the-environment"></a>
## Use uma chave de API do ambiente

Variáveis de ambiente são úteis em CI e em qualquer ambiente no qual o FineCode não deva armazenar a chave. Defina a variável antes de iniciar o FineCode:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
finecode
```

Esta tabela abrange provedores com uma única variável principal de chave de API. Provedores que precisam de configuração adicional ou aceitam credenciais disponíveis no ambiente estão descritos em [Configuração específica de provedores](#provider-specific-config).

| Provedor | Variável de ambiente |
|---|---|
| Anthropic | `ANTHROPIC_API_KEY` |
| Ant Ling | `ANT_LING_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| NVIDIA NIM | `NVIDIA_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| xAI | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| ZAI Coding Plan (Global) | `ZAI_API_KEY` |
| ZAI Coding Plan (China) | `ZAI_CODING_CN_API_KEY` |
| OpenCode Zen e Go | `OPENCODE_API_KEY` |
| Radius | `RADIUS_API_KEY` |
| TypeSafe ([modelos classificadores](models.md#use-classifier-models)) | `TYPESAFE_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| Fireworks | `FIREWORKS_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Baseten | `BASETEN_API_KEY` |
| Kimi For Coding | `KIMI_API_KEY` |
| Meta | `META_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| MiniMax (China) | `MINIMAX_CN_API_KEY` |
| Moonshot AI (Global and China) | `MOONSHOT_API_KEY` |
| Qwen Token Plan and Individual | `QWEN_TOKEN_PLAN_API_KEY` |
| Qwen Token Plan (China) | `QWEN_TOKEN_PLAN_CN_API_KEY` |
| Xiaomi MiMo | `XIAOMI_API_KEY` |
| Xiaomi MiMo Token Plan (China) | `XIAOMI_TOKEN_PLAN_CN_API_KEY` |
| Xiaomi MiMo Token Plan (Amsterdam) | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` |
| Xiaomi MiMo Token Plan (Singapore) | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` |

A Anthropic também reconhece `ANTHROPIC_OAUTH_TOKEN` como credencial de API e `ANTHROPIC_AUTH_TOKEN` como autenticação bearer.

Quando nenhuma chave ou token estiver definido, a Anthropic usa federação de identidade de carga de trabalho se `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID` e `ANTHROPIC_IDENTITY_TOKEN_FILE` estiverem definidos: o SDK da Anthropic troca o token de identidade por um token de acesso de curta duração e o atualiza automaticamente, relendo o arquivo do token de identidade. Mantenha esse arquivo atualizado durante sessões longas. Se definidas, `ANTHROPIC_SERVICE_ACCOUNT_ID` e `ANTHROPIC_WORKSPACE_ID` também são repassadas.

## Carregue uma chave de API por comando

Para usar um gerenciador de segredos sem gravar a chave resolvida em disco, defina `key` do provedor em `auth.json` como um comando precedido por `!`:

```json
{
  "anthropic": {
    "type": "api_key",
    "key": "!security find-generic-password -ws 'anthropic'"
  }
}
```

O FineCode executa o comando quando a chave é necessária pela primeira vez e armazena a saída padrão em cache durante a vida do processo. Saída vazia, timeout ou código de saída diferente de zero deixam a chave sem resolução até que o FineCode seja reiniciado.

<a id="provider-specific-config"></a>
## Configuração específica de provedores

Os provedores abaixo exigem configuração adicional, precisam de outras opções ou aceitam credenciais fornecidas pela própria plataforma.

Uma credencial de chave de API armazenada pode incluir um objeto `env`. Os valores nele têm prioridade sobre o ambiente do processo para aquele provedor:

```json
{
  "cloudflare-workers-ai": {
    "type": "api_key",
    "key": "...",
    "env": {
      "CLOUDFLARE_ACCOUNT_ID": "account-id"
    }
  }
}
```

### Radius

Radius é um serviço upstream da Earendil Works, originalmente criado para o Pi. O FineCode o usa como gateway de IA personalizável, com controles e análises por organização, além de artefatos para compartilhar o que você cria.

Para começar, execute `/login radius` no FineCode. Isso adiciona Radius como provedor, e seus modelos aparecem em `/model` como os dos demais provedores.

Radius também tem um servidor MCP, permitindo que o FineCode o gerencie para você.

Radius está atualmente em alfa inicial e evolui rapidamente. Consulte [radius.earendil.com](https://radius.earendil.com) para saber mais.

A autenticação Radius usa o catálogo do gateway e armazena em cache metadados atualizados dos modelos para inicializações offline posteriores. Um gateway Radius personalizado configurado em `models.json` usa seu próprio catálogo, em vez de herdar o catálogo público upstream do Pi em `radius.pi.dev`.

### OpenRouter

Autentique-se com `/login openrouter` ou `OPENROUTER_API_KEY`.

Com uma chave, o FineCode lista somente os modelos de chat do OpenRouter que ela pode usar, considerando o tamanho do contexto, a saída máxima e os preços dessa chave. Esses dados vêm do endpoint `/models/user` do OpenRouter e refletem as proteções e restrições de provedores configuradas no OpenRouter. Modelos de imagem e classificadores não são filtrados.

O FineCode atualiza a lista em segundo plano na inicialização do modo interativo, ao abrir `/model`, após `/login` e com `finecode update --models`. A última lista é salva e usada offline, no modo `finecode -p` e no modo RPC. Se você trocar as chaves fora de `/login`, a lista da chave anterior permanece até a próxima atualização.

Endpoints regionais filtram os modelos por região. Para usar um, defina a URL base em [`models.json`](models.md#configure-a-compatible-endpoint):

```json
{
  "providers": {
    "openrouter": { "baseUrl": "https://us.openrouter.ai/api/v1" }
  }
}
```

Se a URL base rejeitar a chave em `/models/user` ou não oferecer esse endpoint — por exemplo, se um proxy estiver configurado como URL base do OpenRouter —, o FineCode lista todos os modelos do OpenRouter.

### Azure OpenAI

O ID do provedor é `azure` (anteriormente `azure-openai-responses`). Use-o como chave em `auth.json`, `models.json` e `settings.json`, e em referências de modelos como `--model azure/gpt-5.4`.

O provedor `azure` disponibiliza modelos OpenAI pela API Responses e modelos Microsoft Foundry pela API Chat Completions, como `azure/deepseek-v4-pro`.

Defina uma chave de API e uma URL base ou nome de recurso:

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.ai.azure.com
# Or:
export AZURE_OPENAI_RESOURCE_NAME=your-resource
```

URLs raiz de recursos em `ai.azure.com`, `cognitiveservices.azure.com` e `openai.azure.com` são normalizadas para o caminho da API OpenAI.

O FineCode envia o ID do modelo como nome da implantação. Se a implantação tiver outro nome, mapeie-o com `AZURE_OPENAI_DEPLOYMENT_NAME_MAP`:

```bash
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-5.4=my-gpt-deployment,deepseek-v4-pro=my-deepseek
```

`AZURE_OPENAI_API_VERSION` substitui a versão da API para modelos OpenAI (o padrão é `v1`).

Para usar um modelo Foundry não incluído no FineCode, adicione-o em `azure` no [`models.json`](models.md#configure-a-compatible-endpoint) com `api: "openai-completions"`. Modelos personalizados exigem `baseUrl`; quando definidos, `AZURE_OPENAI_BASE_URL` e `AZURE_OPENAI_RESOURCE_NAME` têm prioridade:

```json
{
  "providers": {
    "azure": {
      "baseUrl": "https://your-resource.services.ai.azure.com",
      "models": [
        { "id": "your-deployment", "api": "openai-completions" }
      ]
    }
  }
}
```

### Amazon Bedrock

O Bedrock pode usar um token bearer ou uma fonte de credenciais AWS disponível no ambiente:

```bash
# Named profile
export AWS_PROFILE=your-profile

# IAM keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
# Required for temporary credentials
export AWS_SESSION_TOKEN=...

# Bedrock bearer token
export AWS_BEARER_TOKEN_BEDROCK=...

# Region, when not supplied by the profile or AWS SDK configuration
export AWS_REGION=us-west-2
# AWS_DEFAULT_REGION is also supported
```

O FineCode também aceita credenciais de tarefas ECS e IRSA pelas variáveis padrão `AWS_CONTAINER_CREDENTIALS_*` e `AWS_WEB_IDENTITY_TOKEN_FILE`.

### Cloudflare AI Gateway

O gateway exige um token, ID da conta e ID do gateway:

```bash
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...
```

Os IDs da conta e do gateway podem vir do ambiente do processo ou do objeto `env` da credencial em `auth.json`.

`CLOUDFLARE_API_KEY` autentica o FineCode no gateway. O acesso upstream pode usar faturamento unificado da Cloudflare, credenciais armazenadas no gateway ou um cabeçalho `Authorization` configurado para o provedor em `models.json`.

### Cloudflare Workers AI

O Workers AI exige um token e o ID da conta:

```bash
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
```

O ID da conta também pode ser armazenado no objeto `env` da credencial.

### Google Vertex AI

Use uma chave de API do Google Cloud:

```bash
export GOOGLE_CLOUD_API_KEY=...
```

Para usar Application Default Credentials, configure um projeto e uma região:

```bash
export GOOGLE_CLOUD_PROJECT=your-project
# GCLOUD_PROJECT is also supported
export GOOGLE_CLOUD_LOCATION=us-central1
```

Em seguida, autentique-se:

```bash
gcloud auth application-default login
```

Para usar um arquivo de chave de conta de serviço, defina `GOOGLE_APPLICATION_CREDENTIALS` junto com o projeto e a região.
