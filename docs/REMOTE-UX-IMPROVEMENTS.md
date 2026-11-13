# Ajustes de uso remoto — 13/11/2026

Implementados no cliente, sem alterar o protocolo público de sinalização, sem gerar instalador e sem fazer push/deploy nesta etapa.

## Mouse

Movimentos do mouse passaram para um canal WebRTC não ordenado e sem retransmissão. As posições têm sequência crescente, permitindo descartar pacotes atrasados; cliques e teclas permanecem no canal confiável. A visualização usa cursor de seta no lugar da mira.

O modo padrão agora é **Ponteiro independente (experimental)**. O helper mantém coordenadas virtuais e envia mensagens à janela alvo, sem mover o cursor do Windows. Não há fallback automático: o anfitrião pode escolher explicitamente **Cursor compartilhado do Windows** no painel da sessão.

Compatibilidade é limitada: aplicações que exigem entrada física, privilégios superiores ou tratamento próprio de mouse podem ignorar mensagens. Teclado e foco continuam compartilhados; isto não cria duas áreas de trabalho independentes. Arraste de barra de título e botões básicos de janela são tratados pelo helper. Validar os programas usados antes de adotar o modo experimental.

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

Após aceitar uma sessão de monitor, o visualizador pode alternar entre os monitores sem nova confirmação. A confirmação intermediária e sua antiga caixa de seleção foram removidas a pedido do responsável. O modal inicial informa esse alcance. Compartilhamento de janela isolada continua restrito à janela; a troca local para monitor permanece disponível ao anfitrião.

A troca usa a seleção/captura existente e respeita permissões vigentes. Trocar de janela para monitor não restaura controle que estava desativado. Pedidos inválidos, concorrentes e repetitivos são limitados; ausência de resposta é apresentada ao visualizador.

A fixture local validou o seletor e a troca concluída sem interação do anfitrião. Testar a alternância física entre dois ou mais monitores com escalas diferentes continua pendente por depender de hardware.

## Anfitrião sem prévia

A janela do anfitrião apresenta status de compartilhamento e identificação do participante, sem vídeo local em tempo real. Remover a prévia não interrompe a captura enviada ao outro computador. O comando de tentar novamente permanece disponível quando a captura para.

## Bandeja do sistema

- Novo botão **Enviar para bandeja** na barra da janela. A aplicação continua aberta, com sinalização e sessão ativas, e sai da barra de tarefas.
- Duplo clique no ícone restaura a janela. O menu oferece Abrir, Enviar para bandeja e Sair.
- A opção **Continuar em segundo plano ao fechar**, no menu da bandeja, controla se o X oculta a janela. Por padrão o X mantém o comportamento anterior de fechar; a opção fica persistida localmente.
- Sair durante uma sessão exige confirmação. A saída explícita e a instalação de atualização continuam encerrando a aplicação.
- Solicitação manual recebida restaura a janela do anfitrião e apresenta o modal de aceite. O modo de acesso por senha continua seguindo o perfil autorizado.
- O renderer continua processando os fluxos em segundo plano, e uma segunda execução restaura a instância existente.

## Verificações

- `npm run lint`, `npm run typecheck` e `npm run build` passaram.
- `npm run verify:redesign`: 106 verificações passaram, com canal de ponteiro sem retransmissão, descarte de pacote antigo, ausência de vídeo no anfitrião, seletor automático de monitor, arquivo do clipboard transferido de verdade e regressões de permissões.
- `npm run test:file-clipboard`: 14 verificações nativas passaram, incluindo FileDropList do Windows, leitura por token, revogação, rejeição de caminho arbitrário, limites e preservação dos originais.
- `npm run verify:startup`: passou incluindo ocultar na bandeja e restaurar a mesma janela.
- `npm run test:admin`: passou, incluindo encerramento por sanção e controle pausado.
- `npm run test:reliability`: 43 verificações passaram.

As duas janelas da fixture compartilham o clipboard da mesma sessão Windows. O teste de cópia de arquivo restringe a leitura à janela de origem para representar corretamente dois clipboards de computadores distintos; o transporte e a gravação continuam reais.

Ficam pendentes a validação final em duas máquinas físicas, colagem manual em aplicações de destino e múltiplos monitores reais. Não foi comprado certificado, criado serviço Windows ou prometida operação antes do login do usuário.
## Modal e captura de mouse — atualização posterior

O anfitrião recebe um modal com ID do solicitante, perfis Acesso completo/Apenas visualização, permissões individuais, seleção de fonte recolhível, prazo de resposta e ações de aceitar/recusar. Perfis não pulam a confirmação do servidor. A janela é restaurada inclusive a partir da bandeja.

No visualizador, **Capturar mouse** prende o ponteiro à área de vídeo, usa movimentos relativos e exibe um cursor local. **Esc** libera a captura. Revogação, perda de foco e encerramento descartam movimentos pendentes e solicitam a liberação das entradas remotas pressionadas. Eventos são agrupados por quadro preservando a última posição, em vez de descartá-la durante o limite de frequência.

Essa captura se inspira no modo descrito nas [configurações de exibição do AnyDesk](https://support.anydesk.com/docs/display). Ela não cria um cursor independente do Windows na máquina anfitriã e não bloqueia a entrada física do anfitrião. A lógica de captura tem dez testes com a API de Pointer Lock simulada; funcionamento do bloqueio real, permissões do sistema e sensação de uso ainda precisam ser conferidos em duas máquinas.

Capturas do modal ficam em `artifacts/redesign/incoming-session-request.png` e `incoming-session-request-1024.png`. O teste de inicialização confirmou a restauração da janela por solicitação recebida.

## Validação do ponteiro independente

`npm run test:virtual-mouse` executa o helper nativo contra uma janela Chromium real: clique recebido, cursor do Windows não deslocado para o alvo virtual e ausência de APIs de injeção/movimento no backend independente. São três verificações; o relatório fica em `artifacts/virtual-mouse/validation.json`. Não comprova compatibilidade universal nem isolamento de teclado.

Resultado final desta etapa: lint, TypeScript e build passaram; interface/sessões 106/106; captura do ponteiro 10/10; helper independente 3/3; inicialização/bandeja/restauração do anfitrião aprovadas. A primeira tentativa Electron no sandbox foi impedida pelas ACLs da sessão gráfica; a execução fora desse sandbox passou, sem alterar ACLs. O build mantém o aviso pré-existente do Vite sobre o formato da configuração.
