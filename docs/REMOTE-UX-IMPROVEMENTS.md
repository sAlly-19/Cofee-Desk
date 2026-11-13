# Ajustes de uso remoto — 13/11/2026

Implementados no cliente, sem alterar o protocolo público de sinalização, sem gerar instalador e sem fazer push/deploy nesta etapa.

## Mouse

Movimentos do mouse passaram para um canal WebRTC não ordenado e sem retransmissão. As posições têm sequência crescente, permitindo descartar pacotes atrasados; cliques e teclas permanecem no canal confiável. A visualização usa cursor de seta no lugar da mira.

Isso melhora o transporte e evita reaplicar movimentos antigos, mas **não cria um segundo cursor independente**. O helper atual usa `SetCursorPos` para movimentar o cursor compartilhado do Windows. Isolar completamente a entrada exigiria outra arquitetura de sessão/desktop, não uma simples alteração de estilo. Não foram feitas promessas sobre comportamento interno do AnyDesk.

Referência: [Microsoft — SetCursorPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setcursorpos).

## Copiar e colar arquivos

Com as permissões de **clipboard e arquivos** habilitadas, e sincronização automática ativa, arquivos individuais copiados no sistema são identificados no processo principal, transferidos pelo canal de arquivos e colocados no clipboard nativo do destinatário. Depois da conclusão é possível usar Ctrl+V ou o comando Colar do Explorador.

A API `text/uri-list` do Electron corresponde ao formato nativo de arquivos do sistema. O teste Windows confirmou a lista recebida usando `System.Windows.Forms.Clipboard.GetFileDropList`, além dos testes do transporte WebRTC. Referência: [Electron — ClipboardItem](https://www.electronjs.org/docs/latest/api/clipboard-item).

- Até 20 arquivos por seleção, 32 MB por arquivo e 64 MB por seleção/fila; pastas ainda não são suportadas.
- Esperar o aviso de arquivos prontos antes de colar. A transferência é antecipada; não há renderização adiada do clipboard pelo Explorer.
- **Recortar envia uma cópia e preserva o original.** Não há exclusão automática da origem: ela exigiria confirmação confiável da colagem no destino, que ainda não foi implementada.
- Caminhos locais não são transmitidos ao outro computador. O renderer recebe nomes/tamanhos e tokens opacos; leitura exige token da sessão e permissões vigentes, com blocos limitados.
- Links simbólicos, caminhos fora do formato permitido, diretórios, arquivos grandes e seleções excessivas são rejeitados. O arquivo é conferido antes da leitura.
- Só arquivos realmente recebidos pela janela atual podem ser preparados no clipboard nativo. Arquivos recebidos carregam um marcador local para evitar sincronização em ciclo.
- A sincronização textual evita sobrescrever um clipboard que contém arquivos com uma string vazia. Desativar a sincronização automática também suspende a exportação automática de arquivos.
- A fila prioriza transferências já em andamento para não carregar repetidamente seleções grandes em memória.

## Monitores

O visualizador passa a ter um seletor **Monitor** durante a sessão. A lista contém somente monitores, sem títulos de janelas.

Por padrão, trocar de monitor exige confirmação do anfitrião. Em **Tela e permissões**, o anfitrião pode marcar **Permitir que o computador remoto alterne entre meus monitores nesta sessão**. A autorização é local à sessão, não fica habilitada permanentemente.

A troca usa a seleção/captura existente e respeita permissões vigentes. Trocar de janela para monitor não restaura controle que estava desativado. Pedidos inválidos, concorrentes e repetitivos são limitados; ausência de resposta é apresentada ao visualizador.

A fixture local validou o seletor, a solicitação e a recusa pelo anfitrião. Testar a alternância física entre dois ou mais monitores com escalas diferentes continua pendente por depender de hardware.

## Anfitrião sem prévia

A janela do anfitrião apresenta status de compartilhamento e identificação do participante, sem vídeo local em tempo real. Remover a prévia não interrompe a captura enviada ao outro computador. O comando de tentar novamente permanece disponível quando a captura para.

## Bandeja do sistema

- Novo botão **Enviar para bandeja** na barra da janela. A aplicação continua aberta, com sinalização e sessão ativas, e sai da barra de tarefas.
- Duplo clique no ícone restaura a janela. O menu oferece Abrir, Enviar para bandeja e Sair.
- A opção **Continuar em segundo plano ao fechar**, no menu da bandeja, controla se o X oculta a janela. Por padrão o X mantém o comportamento anterior de fechar; a opção fica persistida localmente.
- Sair durante uma sessão exige confirmação. A saída explícita e a instalação de atualização continuam encerrando a aplicação.
- Solicitação manual recebida com a janela oculta gera aviso na bandeja; clicar no aviso abre a janela. O modo de acesso por senha continua seguindo o perfil autorizado.
- O renderer continua processando os fluxos em segundo plano, e uma segunda execução restaura a instância existente.

## Verificações

- `npm run lint`, `npm run typecheck` e `npm run build` passaram.
- `npm run verify:redesign`: 99 verificações passaram na última execução, com canal de ponteiro sem retransmissão, descarte de pacote antigo, ausência de vídeo no anfitrião, seletor/consentimento de monitor, arquivo do clipboard transferido de verdade e regressões de permissões.
- `npm run test:file-clipboard`: 14 verificações nativas passaram, incluindo FileDropList do Windows, leitura por token, revogação, rejeição de caminho arbitrário, limites e preservação dos originais.
- `npm run verify:startup`: passou incluindo ocultar na bandeja e restaurar a mesma janela.
- `npm run test:admin`: passou, incluindo encerramento por sanção e controle pausado.
- `npm run test:reliability`: 43 verificações passaram.

As duas janelas da fixture compartilham o clipboard da mesma sessão Windows. O teste de cópia de arquivo restringe a leitura à janela de origem para representar corretamente dois clipboards de computadores distintos; o transporte e a gravação continuam reais.

Ficam pendentes a validação final em duas máquinas físicas, colagem manual em aplicações de destino e múltiplos monitores reais. Não foi comprado certificado, criado serviço Windows ou prometida operação antes do login do usuário.