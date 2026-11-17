# Preparação do Coffee Desk 1.0.2

## Tamanho

Baseline local do pacote 1.0.1: 421.269.873 bytes instalados (401,8 MiB), instalador de 131.488.192 bytes (125,4 MiB). A medição inclui a pasta win-unpacked existente, não uma instalação nova.

A configuração 1.0.2 mantém apenas pt-BR e en-US no Chromium. React, React DOM e Lucide ficam no bundle Vite, sem suas cópias de desenvolvimento no conjunto de dependências de produção. Licenças dessas bibliotecas e das fontes são incluídas explicitamente. Electron, DLLs e helpers de controle necessários são preservados.

Economia potencial estimada a partir dos arquivos anteriores: aproximadamente 77 MiB instalados. O tamanho final e o efeito sobre o instalador dependem do novo empacotamento e ainda não foram medidos. Electron continua respondendo pela maior parte do espaço.

## Instalador

NSIS assistido com escolha de diretório, textos em português, ícones existentes e artes espresso/copper em BMP de 24 bits: sidebar 164 × 314 e cabeçalho 150 × 57. Mantém as rotinas padrão de atualização e inicialização. As áreas nativas do assistente continuam com o tema do Windows.

As artes são geradas por código a partir do logo e fontes locais, sem capturar a área de trabalho. Para regenerar: node scripts/build-installer-art.js. PNGs de prévia ficam apenas em artifacts/installer-art, ignorado pelo Git.

## Verificações nesta preparação

- Lint, TypeScript e build do aplicativo: passaram.
- Build do servidor: passou.
- Confiabilidade: 43 verificações passaram.
- Configuração privada do serviço: 11 verificações passaram.
- Clipboard: 6 verificações de snapshot e 14 de arquivos passaram.
- Prévia do cabeçalho revisada; arte gerada sem acesso à tela do usuário.
- Versões do aplicativo, servidor e locks: 1.0.2.
- ZIP de fontes passa a selecionar somente arquivos rastreados, evitando inclusão acidental de arquivos locais não versionados.

## Pendências

A revisão automática de aprovação bloqueou package:win por existir instrução anterior para não gerar instaladores. Nenhum instalador 1.0.2, latest.yml, blockmap ou checksum foi gerado nesta etapa. Os arquivos anteriores em release não representam o novo pacote.

Após autorização explícita: executar npm run package:win, verificar conteúdo e inicialização do pacote, medir tamanho, conferir o assistente NSIS e gerar metadados/checksums correspondentes ao executável real. Não publicar antes dessas verificações. Atualização real entre dois instaladores permanece pendente.

Não houve publicação, push ou deploy. Endereço do serviço e arquivos de operação continuam fora do Git; capturas reais não fazem parte desta entrega.
