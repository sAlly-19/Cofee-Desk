# Design — Reestruturação Visual Coffee-Desk (Fidelidade ao Mockup Dark Amber)

**Data:** 2026-11-10  
**Status:** Aprovado pelo usuário via `/grill-me`  
**Autor:** Antigravity + Engenheiro Sênior REA  

## 1. Visão Geral e Objetivo

A interface atual do Coffee-Desk possui a lógica funcional de conexão WebRTC, sinalização, clipboard e transferência de arquivos, porém a interface visual foi parcialmente implementada com elementos genéricos e SVGs improvisados. O usuário forneceu na pasta `assets/` os arquivos gráficos de alta resolução e uma imagem de referência visual (`media_1794318544955_993e94dc.jpg`).

O objetivo desta etapa é alinhar 100% a interface visual do aplicativo com a imagem de referência fornecida, criando uma experiência elegante com tema café escuro, brilhos âmbar/dourados, efeitos de glassmorphism e micro-interações refinadas.

---

## 2. Decisões de Arquitetura e Design (Alinhadas via /grill-me)

1. **Janela Frameless Customizada:**
   - Janela do Electron configurada com `frame: false` e cantos arredondados.
   - Barra de controle de janela no topo direito integrada no header (`—` Minimizar, `□` Maximizar, `✕` Fechar).
   - Área superior com drag habilitado (`-webkit-app-region: drag`), preservando botões e inputs interativos (`-webkit-app-region: no-drag`).
   - Badge de versão `v0.1.0 • MVP` com indicador verde neon no topo direito.

2. **Uso dos Assets de Alta Resolução (`assets/`):**
   - `background.png`: Linhas de luz âmbar onduladas no fundo escuro.
   - `Laptop.png`: Laptop 3D com a xícara brilhante para o card "Conectar a um Computador Remoto".
   - `Xícara.png`: Marca d'água luminosa na lateral direita do card "Minha Identidade".
   - `Logo Coffee-Desk com Xícara Brilhante.png`: Logo da marca no topo da sidebar.
   - `icon.png`: Ícone da aplicação.

3. **Dashboard Principal ("Minha Identidade"):**
   - **Sidebar Esquerda:**
     - Logo Coffee-Desk REMOTE ACCESS.
     - Menu vertical com ícones refinados:
       - `Minha Identidade` (estado ativo: gradiente laranja/âmbar brilhante `linear-gradient(135deg, #ff7a00, #ff4d00)` com sombra glow).
       - `Conexão Remota`
       - `Sessões Recentes`
       - `Configurações`
       - `Ajuda`
     - Rodapé com status pill: ponto verde pulsante + texto "Conectado" + "v0.1.0 • MVP".
   - **Área Central (Dashboard):**
     - Saudação superior: "Olá! 👋" + "Gerencie sua identidade e acesse computadores remotos com segurança."
     - **Card 1 — Minha Identidade:**
       - Avatar circular com anel duplo âmbar luminoso + badge de status verde `✓`.
       - Exibição de ID formatado (ex: `123-456-789`).
       - Botão de cópia rápido com feedback dinâmico visual ("Copiado!").
       - Gráfico da xícara (`Xícara.png`) posicionado suavemente no canto direito como watermark.
     - **Card 2 — Conectar a um Computador Remoto:**
       - Lado esquerdo: Laptop 3D (`Laptop.png`) apoiado sobre elipses de brilho âmbar.
       - Lado direito: Ícone de transmissão `((•))`, título e subtítulo.
       - Campo de input customizado com ícone de monitor `[🖥] ID do Coffee-Desk remoto`.
       - Botão primário chamativo com gradiente laranja e raio: `⚡ Conectar →`.
       - Rodapé com os 3 diferenciais: `🛡 Conexão segura`, `⚡ Acesso rápido`, `🔒 Controle total`.
     - **Card 3 — Sessões Recentes:**
       - Ícone de relógio com anel brilhante + botão `Ver todas →`.
       - Lista de máquinas recentes com persistência local (`electron-store`), inicializada com os itens do mockup ("Maquina A", "Maquina B2", "Maquina C"), botão `▷ Conectar` e menu `⋮`.

4. **Navegação e Modais Integrados:**
   - Clicar em "Conexão Remota" ou "Sessões Recentes" realiza auto-scroll suave com foco no card correspondente.
   - Clicar em "Configurações" e "Ajuda" abre modais em glassmorphism elegantes sobre o dashboard.

5. **Transição de Sessão Remota:**
   - Ao estabelecer a conexão WebRTC, a tela transiciona da Home para a visão de sessão remota mantendo a mesma paleta dark amber, com barra de ações de saída/desconexão, visualização de vídeo de baixa latência e abas inferiores (Clipboard e Arquivos).

---

## 3. Requisitos Não-Funcionais
- Zero regressão na lógica WebRTC, signalling WebSocket e IPC do Electron.
- TypeScript strict sem erros (`tsc --noEmit`).
- Responsividade fluida a partir de 960x650px.
