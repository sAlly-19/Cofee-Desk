# Coffee Desk 1.0.1

Implantação na Render + Neon: consulte [o guia de implantação](docs/DEPLOY-RENDER-NEON.md). Não é necessário gerar instalador para publicar o servidor e o painel.

A versão 1.0.1 usa identidades Ed25519, PostgreSQL e painel administrativo com senha e TOTP. O protocolo protegido exige o cliente novo; o instalador 1.0.0 permanece disponível para o ambiente antigo.

Para iniciar o ambiente local, execute `npm ci`, `npm ci --prefix signaling-server` e `npm run dev:secure`. Em outro terminal, execute `npm run electron:dev`. Não há administrador padrão: siga [Administração](docs/ADMIN.md) para criar o primeiro usuário. Os comandos antigos de sinalização abaixo exigem agora a configuração descrita nesse documento.

Consulte o [relatório de segurança](docs/SECURITY-1.0.1.md). O servidor e o painel não foram publicados. A confirmação anterior entre duas máquinas refere-se à versão 1.0.0; a versão atual foi validada entre instâncias locais reais.

O novo instalador fica em `release/Coffee-Desk-1.0.1-x64-Setup.exe`.

**Café - Sistemas & Softwares**

Aplicativo de acesso remoto P2P para Windows, desenvolvido com Electron, React, TypeScript e WebRTC.

![Coffee Desk 1.0.0](docs/images/coffee-desk-1.0.0.png)

## Recursos

- Conexão por ID e autorização de acesso.
- Compartilhamento de tela e controle remoto de mouse e teclado.
- Acesso não supervisionado por senha.
- Transferência de arquivos e painel de clipboard.
- Histórico de dispositivos, reconexão e configurações locais.
- Interface espresso/copper com fontes locais.

O funcionamento entre duas máquinas foi confirmado pelo responsável pelo projeto. O controle nativo de mouse e teclado da versão 1.0.0 é voltado ao Windows.

## Desenvolvimento

Requisitos: Windows x64 e Node.js 22 ou superior.

```bash
npm ci
npm ci --prefix signaling-server
```

Inicie o servidor em um terminal e o aplicativo em outro:

```bash
npm run signaling
npm run electron:dev
```

A sinalização usa a porta 8080. No desenvolvimento, o endereço acompanha o hostname do renderer; no aplicativo instalado, o endereço atual é ws://localhost:8080. O instalador não inicia nem hospeda o servidor de sinalização. Para computadores distintos, ambos precisam alcançar o servidor conforme a configuração de rede usada no teste.

## Build e instalador

```bash
npm run typecheck
npm run build
npm run package:win
```

O build do aplicativo fica em dist-electron. O instalador fica em release/Coffee-Desk-1.0.0-x64-Setup.exe. O helper Win32 é incluído como recurso executável separado do ASAR.

O servidor pode ser compilado e iniciado separadamente:

```bash
npm run build --prefix signaling-server
npm start --prefix signaling-server
```

## Verificação

```bash
npm run verify:startup
npm run verify:redesign
```

Os testes usam perfis isolados e salvam os resultados em artifacts. O lint ainda depende da configuração ESLint, ausente no projeto. No PowerShell com bloqueio de scripts, use npm.cmd.

## Publicação

Veja [como enviar ao GitHub e preparar a release](docs/RELEASE.md) e o [histórico da versão](CHANGELOG.md). O workflow do GitHub gera um artefato com o instalador; a publicação de uma release é uma etapa separada.

## Licença

MIT. As fontes incorporadas mantêm suas licenças SIL OFL em assets/fonts.

© 2026 Café - Sistemas & Softwares
