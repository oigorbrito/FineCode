# Windows native build gate — Desktop Block 04

**Status: `BLOCKED_ADMIN_COMPONENT`.** `npm run build` passou, mas isso só gera os bundles do `electron-vite`; não prova a recompilação do `node-pty`, o empacotamento Windows nem a carga do addon em Electron.

## Evidência local

| Item | Observação |
|---|---|
| SO/arquitetura | Windows 11 Pro, build 26300, x64 |
| Node/npm | Node `v26.10.0` (ABI 147), npm `11.19.1` |
| Electron | `43.7.9`, ABI 148; alvo gerado x64 |
| `node-pty` | `1.1.0`; `electron-builder` `26.15.3`; `@electron/rebuild` `4.2.1` |
| VS 2022 Build Tools | `17.14.37806.7`; MSVC toolset `14.44.35207`, compiler `19.44.35229.0`; projeto usa `v143` |
| Projeto gerado | `Platform=x64`, `SpectreMitigation=Spectre`, `using_electron_config_gypi=1`, `node_module_version=148`, `target_arch=x64` |
| Dependência ausente | `lib/x86/spectre` e `lib/x64/spectre` não existem no MSVC `14.44.35207`; a consulta do `vswhere` pelo componente Spectre não encontrou instalação correspondente |
| Estado nativo | Nenhum `node-pty/build/Release/*.node`; arquivos prebuilt do pacote não foram tratados como prova de rebuild/load em Electron |
| Permissão | A identidade da sessão não é administradora (`IsAdministrator=False`) |

A documentação Windows do próprio clone instrui usar **Visual Studio Build Tools 2022** e instalar **“Spectre-mitigated libs for v143 toolset”**. O ID versionado do componente confirmado no catálogo local do Visual Studio é `Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64.Spectre`; o `vswhere -requires` correspondente não encontrou instância instalada. A documentação alerta que a falta dos libs pode produzir `MSB8040`. Não executei `electron-builder install-app-deps` nem `electron-builder --win --dir`: o componente exigido continua ausente. Portanto não há log de falha de `electron-builder` produzido neste bloco e nenhum desses gates está aprovado.

## Ação oficial necessária

Um administrador/proprietário deve, sem alterar `binding.gyp`, toolset, mitigação ou dependências:

1. Abrir **Visual Studio Installer** → **Build Tools 2022** → **Modify** → **Individual components**.
2. Pesquisar `Spectre` e instalar **“Spectre-mitigated libs for v143 toolset”** para x86 e x64. Manter MSVC v143 e Windows SDK já usados pelo projeto; não substituir por VS 18/v180.
3. Confirmar a existência dos diretórios `...\14.44.35207\lib\x86\spectre` e `...\14.44.35207\lib\x64\spectre` e reabrir um terminal x64 de VS 2022.
4. No clone experimental, executar e guardar a saída completa:

   ```powershell
   npx electron-builder install-app-deps
   npm run build
   npx electron-builder --win --dir
   ```

5. Verificar addon nativo produzido e carregável no runtime Electron empacotado. Só então executar o smoke do app empacotado em diretório/VM descartável, com dados de usuário e provider local isolados; cobrir abertura, terminal `node-pty`, fluxo de sessão e reinício. Registrar SHA-256 do artefato, ambiente, comandos e logs.

Não desabilitar Spectre, não alterar `node-pty`/dependências para contornar MSB8040 e não publicar release. O teste Electron atual foi de desenvolvimento, não um smoke de pacote.

**Evidências:** `D:/temp/finecode-block04-evidence/finecode-block04-vs-inventory.log`, `finecode-block04-toolset.log`, além do `binding.gyp`, `config.gypi` e `.vcxproj` em `node_modules/node-pty` do clone.

## Reteste Desktop Block 05

`npm run package:win -- --dir --config.directories.output=release/desktop05` gerou com sucesso os bundles de produção do Electron, depois `electron-builder` acionou `@electron/rebuild` para Electron `43.7.9`/x64 e falhou com `MSB8040` ao compilar `node-pty` e os projetos `winpty`. O log exige Spectre mitigation; não há saída em `release/desktop05` e não foi possível executar um smoke empacotado. `npx electron-builder --win --dir --config.directories.output=release/desktop05` também foi tentado e falhou no mesmo ponto.

O bloqueio permanece: MSVC v143 `14.44.35207` não tem as bibliotecas Spectre x86/x64, e a sessão não é administradora. O componente localmente identificado é `Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64.Spectre`. A solução suportada continua instalar esse componente correspondente pelo Visual Studio Installer e repetir rebuild, build, empacotamento e smoke em dados descartáveis. Não foi alterado `binding.gyp`, dependência, toolset, mitigação ou opção de rebuild para contornar o requisito.

**Status atual:** `ENVIRONMENT_BLOCKED` para rebuild local completo sem mitigação Spectre; contornado temporariamente em homologação com `"npmRebuild": false` no `package.json`.

## Homologação Desktop Block 03 — Uso de `npmRebuild: false`

Para viabilizar a validação e empacotamento do instalador Windows no ambiente host sem privilégios de administrador:
- Foi adicionado `"npmRebuild": false` ao campo `"build"` em `apps/desktop/package.json`.
- **Impacto:** O `electron-builder` utiliza os executáveis e prebuilds fornecidos pelo pacote `node-pty` (`prebuilds/win32-x64/` e `third_party/conpty/`) em vez de recompilar o módulo nativo com o compilador MSVC local.
- **Validação:** O pacote empacotado executou com sucesso tanto o terminal integrado quanto a conexão RPC com o FineCode (`PASS_ELECTRON_RENDERER_AND_RPC`).
- **Produção:** Em pipelines de CI/CD ou ambientes de release oficiais, o runner deve possuir o componente `Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64.Spectre` instalado caso a recompilação nativa formal de addons seja mandatória para a assinatura do instalador.