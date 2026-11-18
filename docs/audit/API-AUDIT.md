Auditoria local — 17/11/2026, commit 26cfb1b, versão 1.0.2, Windows x64. Sem alterações funcionais; não é certificação.

# APIs, IPC e autorização

## HTTP

| Rota | Verbo | Proteção e efeito |
|---|---|---|
| /health | GET | Público; consulta banco; versão fixa incorreta CD-16 |
| /admin/* | GET | Assets sob raiz fixa, CSP e sem listagem; dados exigem API autenticada |
| /api/admin/login | POST | Origem, limites global/IP/usuário, senha scrypt + TOTP sem replay |
| /api/admin/session | GET | Cookie válido, gira CSRF sem renovar prazo |
| /api/admin/logout | POST | Sessão/origem/CSRF, revoga atual |
| /api/admin/sessions/revoke | POST | Sessão/origem/CSRF, revoga todas e audita |
| /api/admin/network | GET | Sessão; IP efetivo |
| /api/admin/devices?q=&page= | GET | Sessão, SQL parametrizado, 50 registros |
| /api/admin/devices/:id | GET | Sessão, detalhes/sanções/auditoria; remove public_key do detalhe |
| /api/admin/devices/:id/sanctions | POST | Sessão/origem/CSRF, motivo; bloqueio 1–8760 h, ban com confirmação ID |
| /api/admin/reports?status=&page= | GET | Sessão, enum/50 registros |
| /api/admin/reports/:uuid | POST | Sessão/origem/CSRF, decisão manual justificada/auditada |
| /api/admin/audit?page= | GET | Sessão, somente consulta, 50 registros |

Fonte: signaling-server/src/admin.ts:65–362 e server.ts:111–180. Todos admins têm mesmas atribuições: não existe RBAC granular. Login novo revoga sessões anteriores do administrador; padrão expira em oito horas. GET session gira CSRF compartilhado e pode afetar outra aba (testar UX concorrente; não é bypass demonstrado). Body JSON limitado a 16 KiB. Sem bootstrap público, anexos ou gravações em denúncia. Queries usam parâmetros; role fixa escapa senha SQL.

## WebSocket e estados

| Estado | Mensagens | Regra |
|---|---|---|
| Não autenticado | hello/challenge/authenticate | v2, Ed25519 canônica, nonce/audiência e prazo |
| Autenticado | ping/report-device/connect-request | Remetente derivado do socket, limites e alvo validado |
| Pendente | accepted/rejected/disconnect | Participantes, somente alvo aceita/recusa, prazo padrão 30 s |
| Ativo | offer/answer/ICE/permissions-update/disconnect | UUID, ambos participantes e papéis; somente host altera permissões |

Denúncia permite alvo existente diferente do remetente; callId opcional só valida chamada ainda ativa. Não há comprovação de participação histórica quando referência é omitida: regra atual de denúncia, não autorização de sessão. MAX_PAYLOAD 64 KiB padrão, sem compressão, até 32 mensagens pendentes por conexão e orçamento global 8 MiB; saída bufferedAmount limitada.

## IPC e peer

assertTrusted exige main frame e HTML local exato (ou dev loopback 5173), mas CD-01 demonstra concessão autodeclarada. CD-02 abre caminho não recebido. APIs legadas de janela/store/conexão não seguem validação uniforme (CD-13); bridge não oferece invoke genérico, porém métodos específicos também exigem proteção.

Mouse/teclado são validados no main: host + controle + monitor/bounds + captura pronta; revogação libera entradas. Clipboard arquivo exige clipboard E files, tokens por sessão, arquivos locais sem symlink, 20 itens/32 MiB cada/64 MiB seleção, revogação invalida token. Salvar Downloads valida nome sem traversal textual, nomes reservados e tamanho. CD-07/08/09 continuam abertos.

Não demonstrado SSRF backend: nenhuma rota faz fetch de URL arbitrária fornecida pelo usuário. Configurar servidor WSS no cliente é capacidade local, não fetch feito pelo servidor público. API administrativa sem sessão não expõe dados; auditoria append-only é protegida por role/trigger, não contra superusuário do banco.
