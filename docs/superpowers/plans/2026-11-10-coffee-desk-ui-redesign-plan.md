# Coffee-Desk UI Redesign — Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar e estilizar a interface do Coffee-Desk para atingir 100% de fidelidade visual à imagem de referência dark amber, utilizando os assets gráficos fornecidos na pasta `assets/`, habilitando janela frameless no Electron e mantendo intacta toda a funcionalidade do app.

**Architecture:** Electron frameless (`frame: false`), Vite alias/asset handling para carregar imagens de alta resolução de `assets/`, tema CSS com variáveis dark amber / glassmorphism, componentes reutilizáveis refinados e integração de navegação e histórico funcional.

**Tech Stack:** Electron + React 18 + TypeScript strict + Vite + lucide-react

---

## Tasks

### Task 1: Configurar suporte a Assets no Vite e Frameless Window no Electron
- [x] Configurar `vite.config.ts` com alias ou publicDir para acessar `assets/` no renderer (`@assets`).
- [x] Configurar `createMainWindow()` em `src/main/windowManager.ts` com `frame: false`, `transparent: false`, `backgroundColor: '#0d0805'` e registro dos IPCs de janela (`minimize`, `maximize`, `close`).
- [x] Verificar `tsc --noEmit` e compilação do Vite.

### Task 2: Atualizar Sistema de Cores e Estilos Globais (`theme.css` e `globals.css`)
- [x] Definir tokens exatos da imagem:
  - Fundo escuro: `#0c0704`, `#120c06`, `#180f08`
  - Gradiente primário laranja: `linear-gradient(90deg, #ff7a00 0%, #ff4d00 100%)`
  - Glows âmbar: `rgba(255, 120, 0, 0.35)`, `0 0 25px rgba(255, 110, 0, 0.4)`
  - Bordas de vidro: `1px solid rgba(255, 180, 100, 0.12)`
  - Superfícies em glassmorphism: `rgba(28, 18, 12, 0.75)` com `backdrop-filter: blur(16px)`
  - Variáveis de tipografia e raio de curvatura (`border-radius: 18px`).
- [x] Adicionar utilitários para scrollbar customizada e drag region (`-webkit-app-region`).

### Task 3: Criar Barra de Título Customizada (Window Controls + Version Badge)
- [x] Componente `TitleBar` ou header com:
  - Área arrastável (`-webkit-app-region: drag`).
  - Badge `v0.1.0 • MVP` com indicador neon verde.
  - Botões de controle no topo direito: Minimizar (`—`), Maximizar/Restaurar (`□`), Fechar (`✕`) com suporte a hover.

### Task 4: Implementar Sidebar com Logo Brilhante e Menu Ativo Âmbar
- [x] Logo no topo usando `Logo Coffee-Desk com Xícara Brilhante.png` com fallback em SVG de alta fidelidade.
- [x] Itens de navegação:
  - `Minha Identidade` com fundo laranja em gradiente e glow.
  - `Conexão Remota`, `Sessões Recentes`, `Configurações`, `Ajuda`.
- [x] Rodapé com pill de status "Conectado" (ponto verde brilhante) e versão.
- [x] Suporte a clique para navegação/foco nos cards e abertura de modais.

### Task 5: Implementar Card "Minha Identidade" (Fidelidade ao Mockup)
- [x] Avatar com duplo anel laranja/âmbar brilhante e checkmark verde `✓`.
- [x] Título "Minha Identidade" e subtítulo "Seu ID único para conexões remotas."
- [x] Campo escuro com ícone de cópia e ID no formato `123-456-789`.
- [x] Botão de copiar com badge verde "✓ Copiado!" e cópia real para o clipboard.
- [x] Imagem de marca d'água da xícara (`Xícara.png`) no canto direito do card.

### Task 6: Implementar Card "Conectar a um Computador Remoto"
- [x] Lado esquerdo com a imagem 3D do laptop (`Laptop.png`) e anel de brilho de base.
- [x] Lado direito com ícone de transmissão `((•))`, título e subtítulo.
- [x] Campo de entrada de ID com ícone de monitor `[🖥] ID do Coffee-Desk remoto`.
- [x] Botão chamativo `⚡ Conectar →` com gradiente âmbar e efeito hover iluminado.
- [x] Rodapé com badges: `🛡 Conexão segura`, `⚡ Acesso rápido`, `🔒 Controle total`.

### Task 7: Implementar Card "Sessões Recentes" com Persistência
- [x] Cabeçalho com ícone de relógio em anel âmbar e botão `Ver todas →`.
- [x] Lista de conexões recentes com ícone de tela, nome da máquina, data e hora formatada.
- [x] Botão de ação `▷ Conectar` (que preenche o ID e inicia conexão) e menu `⋮`.
- [x] Persistência de histórico no `electron-store` (ou localStorage com fallback seguro).

### Task 8: Modais de Configurações e Ajuda + Sessão Remota Integrada
- [x] Modal/Drawer para "Configurações" (preferências de conexão, qualidade, display).
- [x] Modal/Drawer para "Ajuda" (instruções rápidas de conexão e atalhos).
- [x] Visualização da sessão remota ativa compatível com a paleta escura (vídeo WebRTC, clipboard, arquivos).

### Task 9: Validação, Testes e Verificação Visual Completa
- [x] Teste de tipos com `npx tsc --noEmit`.
- [x] Build com `npx vite build`.
- [x] Compilação do main process com `tsc -p tsconfig.electron.json`.
- [x] Build integrado completo com `npm run build`.
- [x] Extração e configuração do binário do Electron para inicialização.

### Task 10: Implementar Manipulação Remota Completa (Mouse, Teclado e Helper Nativo Win32 SendInput)
- [x] Criar helper nativo C# em `src/main/native/CoffeeInput.cs` compilado via `csc.exe` nativo do Windows com streaming via `stdin`.
- [x] Refatorar `src/main/inputManager.ts` para gerenciar o processo nativo em background e ouvir canais `REMOTE_INPUT_MOUSE` e `REMOTE_INPUT_KEYBOARD`.
- [x] Registrar `registerInputIpcHandlers()` no ciclo de vida de `src/main/index.ts`.
- [x] Atualizar `RemoteStreamView.tsx` com captura de mouse completa (`mousemove` throttled a 60fps, `mousedown`, `mouseup`, `contextmenu`, `wheel`) e cálculo de coordenadas normalizadas `(0..1)` compensando letterbox.
- [x] Implementar captura de teclado focada no Client (`keydown`/`keyup` prevenindo atalhos locais concorrentes).
- [x] Adicionar botão/toggle de pausar/bloquear controle remoto na visualização do Host.
- [x] Validar com `npx tsc --noEmit` e `npm run build`.
