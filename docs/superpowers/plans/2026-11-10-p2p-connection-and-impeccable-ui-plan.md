# Plano de Implementação — Conexão P2P, UID Único e Impeccable UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformular o servidor de sinalização e o cliente Coffee-Desk para garantir registro de UID único de 9 dígitos (`XXX-XXX-XXX`), implementar o handshake P2P WebRTC ponta a ponta e adicionar estados de interface com acabamento Impeccable (chamando, modal de autorização com timer, acesso não supervisionado e status do servidor).

**Tech Stack:** TypeScript + WebRTC + WebSocket (`ws`) + React 18 + Electron + lucide-react

---

## Tasks

### Task 1: Reformular Signaling Server para Gerenciamento de UID e Handshake P2P
- [x] Atualizar `signaling-server/src/index.ts` para mapear conexões por `coffeeDeskId` (formato `XXX-XXX-XXX`).
- [x] Implementar gerador de UID único de 9 dígitos sem colisões em memória.
- [x] Implementar mensagens de protocolo:
  - `register` / `registered`
  - `connect-request` -> `incoming-call`
  - `call-accepted` / `call-rejected`
  - `offer`, `answer`, `ice-candidate` roteados por `targetId`
  - `disconnect`
- [x] Testar compilação do servidor de sinalização (`cd signaling-server && npx tsc --noEmit`).

### Task 2: Cliente Electron — Captura de Tela Automática e IPC Bridge
- [x] Em `src/main/screenManager.ts`, implementar método para obter o `sourceId` da tela primária principal automaticamente sem prompts intrusivos.
- [x] Em `src/main/preload.ts`, expor método de captura de fontes.
- [x] Verificar tipos com `npx tsc --noEmit`.

### Task 3: Cliente React — Conexão WebSocket Persistente com Signaling e Registro de UID
- [x] Em `src/renderer/App.tsx`, conectar automaticamente ao Signaling Server logo ao abrir a aplicação.
- [x] Enviar registro do ID salvo (ou solicitar novo se não existir).
- [x] Atualizar o status da sidebar em tempo real (Conectado / Reconectando).
- [x] Adicionar reconexão automática com backoff se a conexão cair.

### Task 4: Fluxo de Chamada e Modal de Autorização com Acabamento Impeccable
- [x] Criar modal de "Chamada Recebida" com design dark amber impecável:
  - Avatar com anel de atenção âmbar pulsante.
  - Exibição de ID do solicitante.
  - Barra de progresso circular/linear regressiva de 30 segundos.
  - Botão "Aceitar e Compartilhar Tela" e botão "Recusar".
- [x] Atualizar o botão de conexão durante o processo:
  - Estado `idle` -> `calling` (com spinner suave) -> `waiting-auth` -> `connected` ou `error`.
  - Tratamento de timeout de 30 segundos com cancelamento automático.

### Task 5: WebRTC P2P Completo com Streaming de Tela e DataChannel
- [x] Conectar os eventos de `offer`, `answer` e `ice-candidate` diretamente através do WebSocket de sinalização ativo.
- [x] Iniciar a transmissão do stream de vídeo na máquina Host quando a conexão for aceita.
- [x] Na máquina visualizadora, receber o stream remoto e renderizar no `<video>` com controles de mouse e teclado mapeados.
- [x] Adicionar barra flutuante de controle na sessão ativa (latência, tela cheia, pausar, desconectar).

### Task 6: Acesso Não Supervisionado com Senha nas Configurações
- [x] Adicionar configuração de "Acesso Não Supervisionado" com campo de senha no modal de Configurações.
- [x] Se habilitado e a senha for informada pelo cliente solicitante, aceitar a conexão automaticamente.

### Task 7: Build, Testes e Verificação Ponta a Ponta
- [x] Testar compilação do cliente com `npm run build`.
- [x] Testar compilação do servidor de sinalização com `npm run signaling`.
- [x] Testar troca de mensagens e handshake simulado entre dois IDs de teste.
