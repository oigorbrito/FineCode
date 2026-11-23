[English](../security.md) | **Português (Brasil)**

# Execute o FineCode com segurança

O FineCode é um agente de programação local, não um sandbox de segurança. Suas ferramentas são executadas com as permissões do sistema operacional do processo FineCode. Elas podem ler ou modificar arquivos, executar comandos e acessar recursos de rede disponíveis para esse processo.

O FineCode não solicita confirmação antes de cada chamada de ferramenta nem restringe, por padrão, o acesso ao sistema de arquivos, processos, rede ou credenciais. Use controles do sistema operacional, um contêiner ou outro sandbox quando precisar de isolamento mais forte.

## Confie nos recursos que você carrega

Extensões são módulos TypeScript ou JavaScript executáveis. Elas rodam no mesmo processo e podem acessar os mesmos arquivos, credenciais e ferramentas disponíveis ao FineCode. Carregue extensões somente de fontes confiáveis.

Skills e modelos de prompt fornecem instruções ao modelo. Eles não são executados como código por si só, mas podem influenciar as ações do agente. Revise-os antes de usar, especialmente se vierem de uma fonte não confiável.

O FineCode pode carregar recursos do projeto de trabalho. Revise os arquivos e as instruções do projeto antes de confiar em um repositório e tenha cuidado especial com instruções para agentes, extensões e configurações MCP.

<a id="understand-project-trust"></a>
<a id="project-trust"></a>
## Entenda a confiança no projeto

A confiança no projeto controla se o FineCode carrega recursos no nível do projeto. Ela não cria um sandbox para chamadas de ferramentas nem limita as permissões do sistema operacional do processo.

Até que um projeto seja considerado confiável, o FineCode não carrega extensões, skills, modelos de prompt, temas ou servidores MCP desse projeto. Ainda pode ler e editar arquivos e executar comandos quando solicitado. Não trate a solicitação de confiança como um limite de segurança para a execução de ferramentas.

## Isole tarefas de risco

Para repositórios não confiáveis ou tarefas sem supervisão, execute o FineCode em um contêiner ou outro sandbox com acesso somente aos arquivos e credenciais necessários. Consulte [Contêineres e isolamento](containerization.md) para ver padrões de configuração.

Evite expor ao processo credenciais desnecessárias. Um provedor de modelos, uma extensão ou um comando pode receber dados acessíveis ao FineCode.

## Política de segurança upstream

O [SECURITY.md](../../../../SECURITY.md) do repositório descreve o modelo de segurança e o processo de relato do projeto Pi upstream. O FineCode não opera os serviços upstream `pi.dev`.
