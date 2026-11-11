# Publicação da versão 1.0.0

Autoria: **Café - Sistemas & Softwares**.

## Antes de enviar

A versão do cliente e a do servidor estão em 1.0.0. O rodapé, a tela de ajuda e os metadados do instalador usam a mesma autoria. O teste entre duas máquinas foi confirmado pelo responsável pelo projeto.

O diretório local está preparado para Git. Não há URL de repositório configurada e nenhum arquivo foi enviado ao GitHub.

## Enviar o código

Crie um repositório vazio no GitHub. Na raiz do projeto, configure sua identidade Git se necessário e execute, substituindo a URL pelo endereço real:

```bash
git add .
git commit -m "Release Coffee Desk 1.0.0"
git remote add origin https://github.com/SEU-USUARIO/coffee-desk.git
git push -u origin main
git tag -a v1.0.0 -m "Coffee Desk 1.0.0"
git push origin v1.0.0
```

Não envie node_modules, dist-electron, artifacts, release, arquivos .env ou perfis de teste. As exclusões estão no .gitignore.

## Gerar arquivos locais

```bash
npm run package:win
npm run release:source
```

O arquivo ZIP de código-fonte usa os caminhos preparados no índice Git e os conteúdos atuais desses arquivos. Atualize o índice com git add . antes de gerá-lo. Ele não inclui histórico Git, dependências, perfis ou capturas do desktop.

## Criar a release no GitHub

O workflow Build Windows compila o projeto e disponibiliza o instalador como artefato. Depois do build, crie uma release para a tag v1.0.0, use as notas do CHANGELOG.md e anexe o instalador, o ZIP de código-fonte e SHA256SUMS.txt quando disponível.

O instalador local não tem assinatura Authenticode. A assinatura visual Café - Sistemas & Softwares identifica a autoria e não é um certificado digital do Windows.

## Ambiente da versão

- O servidor de sinalização é separado do instalador.
- O aplicativo empacotado usa atualmente ws://localhost:8080; mantenha o acesso ao servidor configurado conforme seu ambiente validado.
- Nenhuma alteração de protocolo ou de armazenamento de credenciais foi feita para esta publicação.
- Os dados locais do usuário não são incluídos no repositório nem no pacote de código-fonte.

## Verificação local da entrega

Build do cliente e do servidor e TypeScript passaram. A inicialização completa e as 56 verificações Electron/WebRTC passaram na versão 1.0.0. O executável empacotado foi aberto e validado com a assinatura, o preload e o helper Win32 reais. O pacote inclui os módulos compartilhados de IPC e mantém o helper fora do ASAR.

Para repetir a verificação do executável após gerar release/win-unpacked, execute npm run verify:package. Depois de gerar o instalador e o ZIP, execute npm run release:checksums para atualizar SHA256SUMS.txt.
