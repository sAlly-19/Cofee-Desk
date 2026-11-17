# Histórico de versões

## 1.0.2 — 17/11/2026

- Pacote preparado para distribuir somente português brasileiro e inglês do Chromium.
- React, React DOM e Lucide classificados como dependências de desenvolvimento, mantendo o código da interface no bundle e as licenças no pacote.
- Artes de instalação/desinstalação em café e cobre, cabeçalho próprio, boas-vindas e conclusão em português e assinatura Café - Sistemas & Softwares.
- Atualizador e configuração de releases apontam para sAlly-19/Coffee-Desk.
- Painel de sessão do anfitrião, escolha compartilhada de fontes, barra contextual e confirmação real das trocas de captura.
- Cópia de ID pelo clipboard nativo e controles do painel de clipboard refinados.
- Correções dos testes Windows: partida PostgreSQL via pg_ctl com privilégios restritos e clipboard inicial sem tipos MIME.

A geração e validação do instalador e dos metadados associados são etapas separadas; código preparado não significa release publicada.

## 1.0.1 — 12/11/2026

- Identidade autenticada Ed25519 por servidor, com chave privada protegida pelo Electron safeStorage.
- Chamadas autorizadas por participante, desafios únicos, validação e limites de recursos.
- PostgreSQL com migrações, denúncias autenticadas, sanções e auditoria administrativa.
- Painel React com login por senha e TOTP, CSRF e sessões revogáveis.
- Senhas locais derivadas com scrypt e histórico separado por servidor.
- Endereço de sinalização configurável; assinatura Café - Sistemas & Softwares preservada.
- Implantação pública adiada para a próxima etapa.

## 1.0.0 — 11/11/2026

Primeira versão do Coffee Desk assinada por Café - Sistemas & Softwares.

- Interface espresso/copper com fontes e assets locais.
- Identidade por computador e conexão remota por ID.
- Solicitações de acesso com aceite, recusa e cancelamento.
- Acesso não supervisionado por senha.
- Vídeo WebRTC, controle remoto e transferência de arquivos.
- Histórico de sessões com reconexão, renomeação e exclusão.
- Correções na inicialização dos handlers IPC e no encerramento de sessões.
- Instalador Windows x64 e automação de build no GitHub.

O teste entre duas máquinas foi confirmado pelo responsável pelo projeto. Essa confirmação não substitui uma auditoria de segurança ou testes em todas as condições de rede.

Café - Sistemas & Softwares
