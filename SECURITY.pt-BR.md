[English](SECURITY.md) | **Português (Brasil)**

# Política de segurança do Pi upstream

Este arquivo preserva a política de segurança do Pi upstream. Ele não define o processo de relato do FineCode; as orientações específicas de segurança do FineCode ainda não foram publicadas. Não envie relatos sobre o FineCode aos canais upstream da Earendil ou do `pi.dev`.

Este documento ajuda a entender o conceito de segurança do Pi e os limites desse modelo.

Em geral, o Pi é um agente de programação que roda localmente, dentro do limite de segurança do usuário que o executa. Cabe ao usuário monitorar suas operações ou confiná-lo em um contêiner, máquina virtual ou outra solução de sandbox.

O Pi considera a conta local do usuário e os arquivos que ela pode gravar como pertencentes ao mesmo limite de confiança do próprio processo do Pi. Se um invasor puder modificar arquivos no diretório pessoal do usuário, no workspace, nos arquivos de inicialização do shell, no ambiente ou na configuração do Pi, geralmente poderá influenciar o Pi ou outras ferramentas locais de desenvolvimento. Relatos que dependem desse acesso prévio de gravação local não são vulnerabilidades de segurança, a menos que demonstrem como o Pi concede esse acesso ou atravessa um limite de privilégios do sistema operacional.

O Pi depende de que os usuários instalem extensões confiáveis, carreguem skills confiáveis e usem o Pi somente em repositórios confiáveis. Isso porque arquivos como `AGENTS.md` ou instruções em comentários podem injetar prompts no agente de programação com facilidade, e não é possível se proteger completamente contra isso.

## Como relatar uma vulnerabilidade

Se acredita ter encontrado uma vulnerabilidade de segurança no Pi ou em outro pacote deste repositório, faça o relato em particular por um destes meios:

- Envie um e-mail para `security@earendil.com`; ou
- Abra um relato privado pelo GitHub Security Advisories deste repositório.

Inclua:

- Descrição do problema e de seu impacto
- Passos para reproduzir, prova de conceito ou logs relevantes
- Pacote, versão, commit ou configuração afetados
- Mitigações conhecidas

Não abra uma issue pública para relatos sensíveis de segurança. Os relatos serão revisados e a divulgação será coordenada conforme apropriado.

## Escopo

Estão no escopo problemas de segurança nos pacotes distribuídos, ferramentas de linha de comando, APIs e código do repositório, bem como na infraestrutura operada pela Earendil em `pi.dev`.

## Fora do escopo

- Execução de código local ou comportamento de sandbox (o agente de programação Pi intencionalmente não inclui um sandbox)
- Comportamento de extensões ou skills do Pi instaladas pelo usuário
- Riscos de trabalhar em repositórios não confiáveis
- Riscos de instalar extensões, skills, pacotes ou ferramentas não confiáveis
- Problemas causados por proxies MITM não confiáveis
- Exposição pública de uma instalação do Pi à internet
- Ataques de injeção de prompt
- Segredos expostos que sejam credenciais controladas por terceiros ou pelo usuário
- Relatos que exijam a capacidade de criar, modificar, excluir ou substituir arquivos, diretórios, links simbólicos, variáveis de ambiente, configuração do shell ou outros dados locais controlados pelo usuário na máquina-alvo. Isso inclui `~/.pi`, `~/.pi/agent/models.json`, arquivos do workspace, `AGENTS.md`, skills, extensões, configuração de extensões, dotfiles e arquivos sincronizados por NFS, perfis itinerantes ou gerenciadores de dotfiles, a menos que o relato demonstre como o próprio Pi concede esse acesso.
- Problemas causados por configurações do usuário intencionalmente enfraquecidas
- Alegações de consumo excessivo de recursos/DoS que dependam de entrada ou configuração local confiável contra o agente de programação Pi
- Relatos sobre saídas maliciosas de modelos
- Ações locais aprovadas ou iniciadas pelo usuário e apresentadas como vulnerabilidades

## Observações para quem relata

Os relatos mais úteis demonstram uma violação atual e reproduzível do limite de segurança, com impacto comprovado. Relatos que mostram apenas o comportamento local esperado de um agente, injeção de prompt ou uma extensão/skill confiável maliciosa não são vulnerabilidades de segurança segundo este modelo.

Por exemplo, um relato que mostre que conteúdo malicioso gravado em um arquivo de configuração Pi confiável faz o Pi executar comandos, carregar ferramentas controladas por um invasor, enviar credenciais a um endpoint controlado por um invasor ou alterar o comportamento de outra forma está fora do escopo.

Quando possível, inclua o caminho exato afetado, a versão do pacote ou SHA do commit, a configuração e uma prova de conceito contra a versão mais recente ou o `main` mais recente. Para relatos sobre dependências, inclua evidências de que a dependência distribuída é afetada e de que o problema pode ser alcançado por meio do Pi. Para relatos sobre segredos expostos, demonstre que a credencial pertence à Earendil ou concede acesso à infraestrutura ou aos serviços operados pela Earendil.
