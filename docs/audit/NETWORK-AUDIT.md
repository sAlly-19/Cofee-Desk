Auditoria local — 17/11/2026, commit 26cfb1b, versão 1.0.2, Windows x64. Sem alterações funcionais; não é certificação.

# Rede e comunicação

| Origem → destino | Canal e dados | Proteção/limite |
|---|---|---|
| Renderer → serviço configurado | WSS /ws: chave pública/desafio/assinatura, IDs, chamada, senha transitória, SDP/ICE e denúncias | WSS fora de loopback; servidor vê sinalização e senha encaminhada |
| Peer ↔ peer | ICE, mídia SRTP/DTLS e DataChannels SCTP/DTLS | Chromium/WebRTC; sem autenticação de fingerprint por canal independente |
| Cliente → STUN Google | stun.l.google.com e stun1.l.google.com:19302 | Descobre endereço público; terceiro observa IP; sem TURN |
| Browser admin → serviço | HTTPS /admin e /api/admin | CSP/headers, sessão, TOTP e CSRF |
| Servidor → PostgreSQL | Conexão com credencial restrita | verify-full exigido em produção remota; pool 10 e timeout |
| Main → GitHub | API e assets HTTPS | Fallback valida redirect/origem, versão/arquitetura/nome/tamanho/hash |
| Desenvolvimento → loopback | HTTP 5173, WS/HTTP 8080 e PostgreSQL efêmero local | Sem TLS deliberadamente no dev; não expor à internet |
| Main → helper local | stdin/stdout | Sem porta de rede dedicada; privilégios herdados |

Endereços privados do serviço/banco omitidos. Fonte principal: useSignaling.ts, useWebRTCPeer.ts:13–16, updaterCore.ts, deviceSecurity.ts, server.ts/config.ts/proxy.ts.

## Criptografia e identidade

WSS/HTTPS protegem cada transporte até servidor/terminador TLS. Ed25519 prova posse da chave perante o serviço. WebRTC cifra mídia/dados entre os peers negociados, mas o servidor de sinalização é confiado: não há verificação independente de fingerprint entre usuários. Não prometer resistência a servidor malicioso nem criptografia ponta a ponta da senha encaminhada. [RFC 8827](https://www.rfc-editor.org/rfc/rfc8827.html).

Não encontrada desativação de validação de certificado. TLS público depende da hospedagem: cadeia real, TLS 1.2/1.3, DNS e firewall não foram sondados nesta etapa, logo não são declarados validados. Cliente instalado usa o endpoint incorporado privadamente; localhost é fallback/desenvolvimento/valor legado explícito, não diagnóstico universal do pacote atual.

## Proxy, origem e abuso

Upgrade exige /ws, transporte considerado seguro em produção e allowlist quando Origin presente. Origin ausente é permitido para cliente não-browser; file/null não são credenciais. Autenticação continua obrigatória. Proxy Render verifica ambiente da plataforma, Host, IP direto e cadeia da direita para esquerda com ranges explícitos. Não confia em todos os proxies; redes privadas amplas/Cloudflare são hipótese operacional que precisa ser mantida e confirmada na implantação real. Testes locais negaram cabeçalhos forjados de origem não confiável; isso não prova configuração privada dos provedores.

## Falhas

Sem TURN, alguns NATs/firewalls não permitem mídia: decisão de escopo, não quebra criptográfica. Cliente oficial encerra sessão ao perder sinalização; reconexão usa backoff até 30 s com jitter. Chamadas ativas são voláteis; reinício não retoma sessão automaticamente. Não localizado fluxo completo de ICE restart/retomada transparente. Testar VPN/Wi-Fi, hibernação e suspensão da hospedagem. Serviço pode revogar sinalização/clientes oficiais, não interromper diretamente P2P mantido por clientes adulterados.
