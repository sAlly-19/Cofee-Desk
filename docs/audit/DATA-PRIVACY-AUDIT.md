Auditoria local — 17/11/2026, commit 26cfb1b, versão 1.0.2, Windows x64. Sem alterações funcionais; não é certificação.

# Dados e privacidade

| Dados | Trânsito/persistência | Proteção | Pendência |
|---|---|---|---|
| Chave privada | Main/perfil por servidor | safeStorage, não entregue em texto à bridge | Integridade do perfil, backup/recuperação e usuário do SO |
| Senha de acesso | UI/main e WSS via servidor até peer | Verificador scrypt local; sem persistência intencional no serviço | Renderer/servidor veem texto durante uso; JS não garante zeroização de memória |
| Admin/TOTP/tokens | API/banco/cookie | scrypt, AES-GCM TOTP, token/CSRF hash, cookie seguro produção | Rotação, recuperação e proteção da chave administrativa |
| IDs/nomes/horários/favoritos | Perfil, localStorage/history e DB | Escopo por servidor, 1.000 registros histórico e 10 recentes | Sem cifra própria de histórico, prazo/limite global entre escopos |
| Denúncias/sanções/auditoria | WSS/API/DB/backups | Autorização admin, limites e append-only | Finalidade/base legal/retenção/direitos |
| IP/SDP/ICE | Serviço/peer/STUN | WSS/WebRTC, não logados intencionalmente no servidor | Metadados visíveis a participantes/provedores |
| Tela/teclado/mouse | WebRTC e pipes locais | Consentimento oficial/permissões/DTLS-SRTP | CD-01 e revogação em crash; sem gravação implementada |
| Clipboard | SO/main/renderer/peer | Permissão, texto limitado e tokens de arquivo | Automático pode enviar conteúdo confidencial copiado durante sessão |
| Arquivos | Chunks em memória e Downloads | Nomes/tamanhos limitados, sem execução automática no recebimento | CD-02/CD-07–09, disco sem cota e arquivos persistem após sessão |
| Logs/temporários | Console/artifacts/perfis | artifacts/.env ignorados, diagnóstico allowlist | Nomes/caminhos/IDs locais e retenção de transcrições |

Fontes: deviceSecurity.ts, historyManager.ts, fileClipboard.ts, ipcHandlers.ts:84, useSessionClipboard.ts, migração 001 e database-recovery.js.

## Git e segredos

Scanner limitado de padrões de chave privada, token GitHub e URL PostgreSQL com senha leu textos rastreados. Uma candidata em signaling-server/.env.example foi confirmada como loopback/placeholder sem expor valor. Nenhum segredo ativo foi confirmado nessa busca. Não substitui scanner de entropia, secret scanning ou revisão de todo histórico Git. Arquivos .env privados e artifacts/hosting não foram abertos para segredos.

Confirmada referência histórica a docs/images/coffee-desk-1.0.0.png. Hoje capturas reais são ignoradas e só quatro imagens README de fixtures são permitidas. Remover arquivo da árvore não o remove de commits/forks/clones antigos. Não reabri nem republiquei essa imagem nesta auditoria; avaliar conteúdo histórico e eventual limpeza/rotação em ação específica.

ACLs dos dados reais, dumps, backups de produção e configurações de conta não foram inspecionados. mode 0600 no código não comprova ACL Windows. Exclusão lógica não garante apagamento físico em SSD/cache/backups. Histórico local e JSON não são registros invioláveis contra usuário local.

## LGPD

Avaliação técnica, sem parecer de conformidade. Definir controlador/operadores, finalidades e bases legais por dado; consentimento de sessão não resolve sozinho auditoria e denúncias. Inventariar Render/Neon/GitHub/STUN, contratos/terceiros e eventual transferência internacional com avaliação jurídica. Preparar aviso de privacidade, retenção justificada, proteção de backups e fluxo de direitos/incidentes. Auditoria imutável precisa conciliar conservação necessária e minimização/pseudonimização aprovada.

Consulta automática ao texto legal oficial foi bloqueada por verificação de acesso; não foram emitidas conclusões jurídicas ou prazos legais. Validar decisões com responsável especializado.
