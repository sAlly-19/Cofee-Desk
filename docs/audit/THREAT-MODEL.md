Auditoria local — 17/11/2026, commit 26cfb1b, versão 1.0.2, Windows x64. Sem alterações funcionais; não é certificação.

# Modelo de ameaças

## Ativos e fronteiras

Ativos: tela/documentos do host, ações de teclado/mouse, clipboard/arquivos, identidade/chave privada e senha não supervisionada, banco/chave TOTP/tokens admin, artefatos de atualização e confiança do usuário. Fronteiras: peer ↔ rede; servidor ↔ cliente; renderer ↔ preload/main; main ↔ helper/SO; API ↔ DB; operador ↔ provedores/GitHub.

Adversários: visitante não autenticado, dispositivo autenticado malicioso, peer com permissões, script na origem legítima após XSS/renderer comprometido, usuário local com escrita no perfil/instalação e conta de release comprometida. Admin é confiado para sanções; painel não tem acesso à mídia. Servidor vê sinalização e senha encaminhada, não é criptograficamente excluído desses dados.

| Ameaça | Controle real | Residual |
|---|---|---|
| Spoofing ID | Ed25519/nonce/audiência e ID atribuído | Nova chave pode contornar banimento de identidade |
| Terceiro aceita/desconecta | UUID/participantes/papéis testados | CD-01 é outra fronteira: IPC |
| Elevação renderer | Context isolation, nodeIntegration false, origem IPC | CD-01/CD-02, CSP/mídia CD-03/CD-04 |
| Adulteração em trânsito | WSS e DTLS-SRTP/DataChannels | Sinalização confiada, sem fingerprint externo |
| Repúdio admin | Auditoria append-only e antes/depois | Não resiste a operador superusuário do DB/infra |
| Dados expostos | safeStorage/scrypt/AES-GCM/Tokens hash | CD-10: históricos/Downloads/logs/backups/terceiros/memória |
| DoS servidor | Limites/fila/heartbeat/prazo | CD-14/CD-17: distribuído/capacidade |
| DoS cliente | Limites arquivo/validação input | CD-06/CD-09/CD-15 |
| Consentimento e entrega | Modal/permissões | CD-07/CD-08 cancelamento/ACK |
| Supply chain | Locks/CI e checksums | CD-05/CD-11/CD-18 |

## Premissas e limites

Não é possível prometer proteção do app contra root/admin com controle total do SO. Helper herda privilégios do pai; não há serviço elevado instalado, mas executar app elevado amplia impacto. PostMessage/SetForegroundWindow do mouse virtual pode mudar foco: ponteiro separado não cria sessão Windows isolada. Teclado usa foco global. Compatibilidade universal, UAC e secure desktop não foram validados.

Sem TURN, conectividade de todas as redes não é garantida. Sem identidade física permanente. Helper não tem porta própria de rede. Serviço pode revogar sinalização e cliente oficial, não cortar P2P adulterado diretamente. Endpoint incorporado pode ser extraído; autenticação não depende de URL secreta.

## Aceitação de residual

Antes de uso comercial: mitigar altos com evidência, provar autoridade/consentimento/revogação no main, transferência cancelável com ACK, distribuição autenticada, privacidade/retention/recuperação e ensaio de abuso/falhas/carga. Cada aceitação precisa de responsável, motivo, prazo e revisão. Este relatório não aceita riscos em nome do operador.
