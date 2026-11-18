# Dados, retenção e privacidade — estado técnico

Documento operacional, não parecer de conformidade jurídica. A política legal, responsáveis e prazos de produção ainda precisam ser aprovados pelo operador e assessor jurídico. Não houve expurgo de produção nesta etapa.

| Dados | Comportamento implementado | Decisão pendente |
|---|---|---|
| Chave privada por serviço | safeStorage no perfil, preservada ao redefinir preferências | Recuperação e descarte de perfil pelo usuário |
| Senha não supervisionada | Verificador scrypt; texto transitório no uso e sinalização WSS | Comunicação clara sobre confiança no serviço |
| Sessão admin | Hash de token/CSRF, expiração padrão 8 h, cleanup periódico | Revisar prazo conforme operação |
| TOTP | AES-GCM no DB, chave privada de operação separada | Recuperação/rotação protegidas e testadas |
| IDs/chave pública/sanções/denúncias/audit | Persistência sem expurgo automático por idade; audit append-only | Prazos por finalidade, base legal, pseudonimização e direitos do titular |
| Histórico completo | 1.000 entradas por servidor, limpeza local disponível | Prazo e limite global entre escopos |
| Recentes/favoritos | 10 recentes e favoritos separados por servidor | Retenção e limite de favoritos por perfil |
| Clipboard | Pode sincronizar automaticamente quando autorizado; conteúdo em memória e clipboard do SO | Avisos ao usuário e proteção operacional de dados copiados |
| Arquivos | Recebimento limitado por chamada; Downloads persistem após sessão | Usuário gerencia arquivos; não existe exclusão segura garantida |
| Logs | Sem caminho/ID nos logs novos de startup/recebimento; erros de escrita sanitizados | Retenção/transcrições e logs dos provedores |
| Backups | Snapshot lógico cifrado, sem sessões admin, chave TOTP separada | Agenda, retenção, acesso e RPO/RTO de produção |
| Capturas de testes | artifacts ignorado; suites de sessão/admin não capturam por padrão | Revisão privada antes de compartilhar; legado Git pode permanecer |

Terceiros incluem serviço de hospedagem/banco, GitHub para releases e STUN público para descoberta de conectividade. STUN e peer podem observar metadados de rede. O serviço vê senha encaminhada e SDP/ICE; WebRTC cifra mídia/dados entre peers negociados. Não existe gravação de sessão implementada por padrão, mas operador/usuário pode capturar a própria tela fora do app.

Registrar controlador/operadores, finalidades, base legal, contratos/transferência internacional, fluxo de solicitações e incidentes. Não assumir consentimento de acesso remoto como base suficiente de toda retenção administrativa. Superusuário do banco pode alterar infraestrutura; append-only limita aplicação/role, não substitui governança.

Não enviar .env, artifacts/hosting, chaves, TOTP, relatórios com dados reais ou capturas do PC para GitHub/chat. Remover imagem da árvore não remove commits/forks históricos. Qualquer limpeza de histórico/rotação de credenciais precisa de escopo próprio. Exclusão lógica não é apagamento físico garantido em SSD/cache/backup.
