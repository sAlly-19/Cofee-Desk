# Sessões e compartilhamento — 16/11/2026

## Implementação

- RemoteToolbar reúne identificação, monitor contextual, entrada, clipboard, arquivos, permissões, detalhes, tela cheia, denúncia e desconexão. O monitor só aparece com duas ou mais fontes remotas autorizadas. Ações secundárias ficam em menu nas janelas menores.
- SessionDetails apresenta identificação e diagnóstico real em popover, fecha com clique externo ou Esc e restaura foco no botão. Latência/quadros/taxa/perdas aparecem somente quando getStats fornece os valores. Não há classificação de qualidade inventada.
- SourcePicker é reutilizado na solicitação e na configuração da sessão. Monitores e Aplicativo específico usam cartões de seleção única e nomes/ícones realmente enumerados pelo Electron. A lista é atualizada a cada cinco segundos e sob demanda. Fontes desaparecidas invalidam a escolha; não se substitui silenciosamente uma janela por um monitor.
- IncomingCallModal apresenta identificação, perfis, permissões e fonte, com prazo no rodapé. Apenas visualização desabilita os três recursos opcionais e envia autorização restrita. Aceite repetido é bloqueado. Expiração também produz feedback no anfitrião.
- Tela e permissões carrega a seleção atual antes de abrir, aplica revogações nos mecanismos existentes e permite substituir a captura mantendo a conexão. Compatibilidade do mouse fica em uma seção avançada recolhida.
- HostStreamView virou painel com fonte, estado da mídia, identificação do controlador, permissões e ações efetivas. O vídeo local não é montado. A pausa do controle reflete o estado nativo; não concede autorização nova.
- Trocas locais/remotas são serializadas. A confirmação ao seletor aguarda replaceTrack e confirmação nativa; falha após preparar outra fonte interrompe a captura anterior. Corrigida a remoção do listener de troca para evitar handlers acumulados após mudanças de permissões.
- A barra fica fora da área do vídeo. Controles e popovers não enviam teclas ao computador remoto. Perder foco do vídeo libera entradas pressionadas. Não há Pointer Lock nem obrigação de liberar o mouse com Esc.

## Arquivos centrais

src/renderer/components/session/{RemoteToolbar,SessionDetails,SourcePicker,PermissionsFields,HostStreamView,ActiveSessionContainer}.tsx; src/renderer/components/{RemoteStreamView.tsx,modals/IncomingCallModal.tsx}; hooks/useRemoteMonitors.ts, useWebRTCPeer.ts, useRemoteInputCapture.ts e useCallManager.ts; src/main/screenManager.ts; src/styles/dashboard.css.

A alteração no processo principal acrescenta ícones opcionais das janelas enumeradas. Não altera autenticação, armazenamento de identidade, sinalização pública ou autorização nativa.

## Validação

Lint e TypeScript da base passaram antes das alterações. Build final mantém apenas o aviso conhecido do Vite sobre a configuração CommonJS/ESM.

- test:session-ui: 23 verificações dos componentes/hooks reais com dados controlados: inventário de um/dois monitores, mudança confirmada, remoção de display/fonte, janela, visualização restrita, expiração, aceite duplicado, popover, ações do anfitrião e largura disponível em 1672/1440/1024.
- test:pointer-capture: seis verificações de entrada livre, tecla Esc remota, revogação e limpeza por perda de foco.
- test:reliability: 43 verificações.
- test:security e test:admin: aprovados, incluindo impedimento de concessão pelo controlador, autorização de janela sem controle, revogação e encerramento por sanção.
- verify:startup: inicialização, IPC, bandeja e restauração por chamada recebida aprovados.
- verify:redesign: execução com duas instâncias Electron e sinalização/PostgreSQL locais, vídeo WebRTC real, clipboard, arquivos, revogação, troca de captura, janela encerrada, retomada, histórico e desconexão. O roteiro usa IDs canônicos enumerados e espera a lista de fontes carregar. Bancos são isolados por execução para evitar conflitos com testes interrompidos.

As primeiras execuções apontaram seletores de teste obsoletos, carregamento assíncrono de fontes e listener de troca não removido corretamente. Foram corrigidos; os resultados finais estão em artifacts/redesign/validation.json e artifacts/session-refactor/validation.json.

## Limites

A arquitetura transmite uma única fonte por vez. Seleção múltipla não é oferecida. Janela isolada permanece sem controle remoto. Ícones e nomes dependem do sistema operacional. Não são contornados os seletores/permissões de captura.

Múltiplos monitores foram exercitados em inventário controlado; o roteiro real também verifica a troca para outro monitor quando o ambiente o disponibiliza. Desconectar fisicamente monitores, DPI misto e uma sessão completa entre computadores de redes distintas continuam como validações manuais de liberação. Os testes locais não comprovam travessia universal de NAT.

O ponteiro independente continua experimental e alguns programas podem ignorar mensagens Win32. Teclado e foco permanecem compartilhados. A refatoração não cria uma sessão Windows isolada.

Sem instalador, push, release ou deploy nesta etapa. Segredos e endereço do serviço continuam fora dos arquivos versionados. Capturas e perfis de teste permanecem em artifacts/ ignorado pelo Git.

## Resultado de validação

A base iniciou com lint e TypeScript aprovados. Ao final: lint, TypeScript e build aprovados; 110/110 verificações de sessão/integração; 23/23 de componentes e topologia simulada; 6/6 de entrada; 43/43 de confiabilidade; 18/18 do atualizador; 9/9 do histórico. As suítes de segurança e painel administrativo passaram, assim como a inicialização real do processo principal. Não houve execução de instaladores.

A integração fez captura real de monitor, troca para o segundo monitor enumerado pelo Windows, seleção remota sincronizada, troca para uma janela Chromium real, fechamento da janela e retorno a monitor sem reconectar. Também exercitou vídeo WebRTC, teclado pelo canal, clipboard, arquivo real, revogação e tentativas de contornar as permissões via IPC/canais.

Falhas intermediárias encontradas e corrigidas: carregamento inicial sobrescrevendo escolha de categoria; listener de captura removido com nome divergente; concorrência entre trocas; seletores antigos da suíte e teste enviando duas solicitações antes da confirmação. Os clusters locais do roteiro agora são isolados por processo. O relatório final de integração não contém falhas.

O aviso existente do Vite sobre o formato da configuração continua presente. Mensagens de IPC negado são esperadas nos testes de autorização. A fixture de captura não registra a ação de restaurar a janela por chamada recebida; esse caminho é exercitado e aprovado pelo smoke test do processo principal.

Imagens atualizadas em artifacts/capturas-coffee-desk-2026-11-16/index.html. As imagens de UI usam dados demonstrativos; as da integração usam duas instâncias locais e fontes reais. Sem validação em dois computadores de redes distintas nesta execução, desconexão física de monitor ou DPI misto.
