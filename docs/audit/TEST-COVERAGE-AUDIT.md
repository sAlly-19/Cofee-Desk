Auditoria local — 17/11/2026, commit 26cfb1b, versão 1.0.2, Windows x64. Sem alterações funcionais; não é certificação.

# Testes e lacunas

## Execuções desta auditoria

| Comando | Resultado |
|---|---|
| lint / typecheck | Passaram, ESLint e TypeScript strict |
| build:server / build:admin / build | Passaram; aviso Vite sobre futura troca de configLoader |
| test:security | Passou, 78 verificações em servidor/PG isolados |
| test:hosting | Passou, 31 verificações de role/proxy/config local |
| test:recovery | Passou, 12 verificações backup/restore em outro banco local |
| test:reliability | Passou, 43 verificações; atualizador simulado |
| test:client-config | Passou, 11 |
| test:history | Passou, 9 |
| test:file-clipboard | Passou, 6 snapshot + 14 arquivo |
| test:device-clipboard | Passou, 9 |
| test:database-helper | Passou, 13 |
| test:admin | **Falhou**, ENOENT no relatório final, CD-12 |
| test:session-ui | Passou, 23 com fixtures |
| test:update-ui | Passou, 18; instalação simulada |
| test:pointer-capture | Passou, 6; sem input global |
| test:virtual-mouse | Passou, 3, botão real de janela de teste sem mover cursor |
| node scripts/verify-startup.js | Passou, main real/preload/helper/tray; controle sem autorização permanece negado |
| verify:package | Passou, win-unpacked existente 1.0.2; não executou instalador |
| npm audit (quatro escopos) | Raiz completa 16 high, demais zero; ver CD-11 |

Avisos GPU de shutdown não invalidaram as asserções. Harness admin registrou updater:getState sem handler e depois ENOENT. O sucesso dos comandos posteriores em PowerShell não apaga essa falha. Não se soma assert count como cobertura percentual.

## Matriz requisito → evidência → pendência

| Requisito | Teste atual | Falta |
|---|---|---|
| Identidade sem impersonação | security: Ed25519/replay/ID | Abuso distribuído, troca de chaves |
| Mensagem autenticada | security: legado/não autenticado | Fuzz limitado por tipo/campo |
| Aceite/isolamento | security: terceiro, SDP/ICE/disconnect | Main independente de renderer CD-01 |
| Permissão e revogação | security/clipboard/pointer/UI | IPC adversarial origem legítima, lease/crash/races |
| Arquivos autorizados | file-clipboard/nome no main | CD-02, cancelamento/ACK, symlink/TOCTOU |
| Login/TOTP/CSRF | security/hosting | Login concorrente/abas e harness admin corrigido |
| Sanção persistente | security/recovery, UI parcial admin | Duas máquinas e renderer travado |
| Histórico por servidor | history/client-config | Retenção/limite global e disco cheio |
| Fonte/monitor/input | session-ui/pointer/virtual | Hardware/DPI/UAC/apps legados e posições negativas reais |
| Mídia/rede | Código e registros anteriores | Nova sessão completa entre máquinas/redes distintas, VPN/NAT/hibernação |
| Atualização | reliability/update-ui | Upgrade real, rollback, autenticidade do publicador |
| Recuperação | recovery/hosting | RPO/RTO, backup agendado e perda da chave |
| Recursos/concorrência | security: filas/binário/oversize | Carga sustentada, slow consumer nativo e reconnect storm |
| Acessibilidade | UI/session/update e checks admin | Leitor de tela/zoom 200%/contraste e axe completo |

## Provas adicionais em memória

P1: Electron/IPC substituídos; sessão sintética aceita sem servidor, clipboard e files autorizados. Prova lógica da fronteira, não exploit de XSS.

P2: shell.openPath spy recebeu abertura de package.json fora da lista de recebidos: 1 chamada; actualExecution=false.

P3: hook real transpilado em memória com React/save simulados: meta → cancelar → chunk → done: saveInvocationsAfterCancel=1; realFilesWritten=false.

Nenhum script permanente criado para provas; sequência/resultados constam nos achados e devem virar regressões na correção. Não se publicaram payloads contra serviço real.

## Limitações

Sem novas capturas de tela. Scripts de catálogo/redesign não foram usados para evitar conteúdo sensível. Sem instalação/upgrade, deploy/probe/prepare-production, carga, testes ofensivos públicos ou hardware adicional. Regressão WebRTC ampla de documentos anteriores (91 checks) não foi reexecutada aqui e não é resultado novo. Sem cobertura instrumentada de linhas. Inicialização de unpacked não prova instalação/atualização NSIS.
