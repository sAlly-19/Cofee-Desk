# Auditoria de segurança

Auditoria local: 17/11/2026. Base: 26cfb1baf44571a58353c1af9426fbc1c9b597e8, versão 1.0.2, Windows x64. Nenhuma alteração funcional. Não é certificação.

## Escopo e método

Inventário de 226 arquivos rastreados; scanner leu 208 textos sem bytes NUL (1.266.191 bytes, incluindo locks). Revisão semântica concentrada nas fronteiras main/preload, hooks ativos, servidor/API, C#, banco, atualização, CI e documentação. Leitura automatizada não equivale a verificação formal de cada linha/binário. Arquivos privados do operador, capturas reais e arquivo pessoal de auditoria não foram analisados para conteúdo sensível.

Suítes usam bancos/perfis locais isolados. Builds regeneraram saídas ignoradas necessárias aos testes. Somente docs/audit recebeu mudanças rastreáveis. Sem deploy, atualização de dependências, instalação ou teste ofensivo público.

## Controles positivos

Ed25519 com nonce/audiência e ID atribuído; scrypt com sal; safeStorage recusando basic_text; TOTP AES-GCM e tokens hash; cookies Secure/HttpOnly/SameSite=Strict/__Host em produção; CSRF/origem; chamadas UUID/papéis; filas/heartbeat/limites; SQL parametrizado e runtime role restrita. Janela principal bloqueia navegação/janelas externas, contextIsolation=true, nodeIntegration=false. Sandbox não é desabilitado e preload é compatível com sandbox moderno; ausência da flag explícita não significa sandbox=false. Não foi encontrada desativação de webSecurity/certificados.

## Achados

### CD-01 — Autoridade nativa autodeclarada pelo renderer

- **Severidade:** ALTO
- **Arquivo/localização:** src/main/sessionAuthority.ts:127–154; src/main/preload.ts:79–85
- **Evidência:** session:confirmed valida formato/papel/permissões, mas não comprova aceite do servidor no main. Prova P1 em memória criou sessão sintética sem servidor: clipboardAuthorized=true e filesAuthorized=true.
- **Descrição técnica:** assertTrusted verifica origem/frame, não a legitimidade da concessão. Seleção e capture:ready também são acessíveis pela bridge.
- **Cenário de risco:** Script na origem legítima, após XSS ou comprometimento de renderer, concede a si permissões. Não foi demonstrada cadeia remota de XSS.
- **Impacto:** Clipboard e arquivos sem consentimento comprovado no main; potencial captura/controle após selecionar fonte.
- **Probabilidade:** Condicional: baixa sem comprometimento do renderer, elevada após essa precondição.
- **Recomendação:** Manter transporte autenticado e estado autoritativo no main; renderer envia intenções e reduções, não concessões autodeclaradas.
- **Critério de validação:** Sessão sintética/replay/papel trocado devem falhar; concessão só após confirmação independente e correlacionada.
- **Referência:** CWE-862; ASVS autorização

### CD-02 — Abertura arbitrária de caminhos pela bridge

- **Severidade:** ALTO
- **Arquivo/localização:** src/main/ipcHandlers.ts:115–125; src/main/preload.ts:210–212
- **Evidência:** file:openFile chama shell.openPath após existsSync; sem assertTrusted ou lista de recebidos. P2 usou package.json fora da lista: uma chamada ao shell simulado, nenhuma execução real.
- **Descrição técnica:** Método permite pedir abertura de caminho existente conhecido; showInFolder, ao contrário, restringe a savedFiles.
- **Cenário de risco:** Renderer comprometido pede execução de executável, atalho ou programa associado. Não é execução remota sem precondição.
- **Impacto:** Ação local além do escopo de visualizar arquivos recebidos.
- **Probabilidade:** Condicional a script na origem legítima e caminho existente.
- **Recomendação:** Verificar origem, argumento, caminho canônico e recebimento da sessão; tratar executáveis/atalhos e decisão explícita; conferir retorno de openPath.
- **Critério de validação:** Nenhuma chamada ao shell para caminho não autorizado, subframe ou extensão bloqueada.
- **Referência:** CWE-862; Electron shell

### CD-03 — Ausência de CSP explícita no renderer desktop

- **Severidade:** MÉDIO
- **Arquivo/localização:** src/renderer/index.html:1–17; src/main/windowManager.ts:24–39
- **Evidência:** Não há meta CSP no HTML nem política equivalente no carregamento desktop. A CSP do servidor aplica-se ao painel HTTP.
- **Descrição técnica:** Falta defesa adicional contra injeção; contextIsolation e nodeIntegration=false continuam positivos. Não foi encontrada XSS concreta nos textos React revisados.
- **Cenário de risco:** Futura interpolação insegura permite código ou recursos sem a barreira CSP.
- **Impacto:** Amplifica CD-01/CD-02.
- **Probabilidade:** Condicional; exploração XSS não demonstrada.
- **Recomendação:** Definir CSP de produção sem eval/scripts externos ou inline desnecessário; separar desenvolvimento e destinos de rede permitidos.
- **Critério de validação:** Scripts inline/remotos negados sem quebrar fontes locais, captura e WSS.
- **Referência:** CWE-693; Electron security

### CD-04 — Permissões genéricas de mídia sem origem

- **Severidade:** MÉDIO
- **Arquivo/localização:** src/main/screenManager.ts:108–115
- **Evidência:** Handlers de permissão aprovam media e display-capture por nome, ignorando origem e WebContents.
- **Descrição técnica:** Handler específico de displayMedia verifica sessão/fonte, mas concessão genérica de media é mais ampla que captura de tela sem áudio.
- **Cenário de risco:** Conteúdo malicioso pede câmera/microfone; SO ainda pode bloquear.
- **Impacto:** Superfície desnecessária de acesso a mídia.
- **Probabilidade:** Condicional ao conteúdo e permissões do SO.
- **Recomendação:** Negar por padrão, verificar frame/origem e necessidade; negar câmera/microfone enquanto não utilizados.
- **Critério de validação:** Origem externa/subframe e mídia não solicitada negados; captura consentida preservada.
- **Referência:** CWE-863; Electron permissions

### CD-05 — Distribuição/helper sem autenticidade independente do publicador

- **Severidade:** ALTO
- **Arquivo/localização:** electron-builder.json; src/main/updaterCore.ts:295–331,413–426; src/main/inputManager.ts:95–113
- **Evidência:** Get-AuthenticodeSignature: NotSigned no Setup 1.0.2 e CoffeeInput-v2.exe. Fallback usa SHA-512 do latest.yml da mesma release; helper escolhido por existência.
- **Descrição técnica:** Checksum detecta corrupção, não comprometimento simultâneo do binário e manifesto. ASAR não é assinatura.
- **Cenário de risco:** Conta/workflow de release comprometido fornece ambos; escrita local na instalação troca helper.
- **Impacto:** Distribuição/execução de código adulterado.
- **Probabilidade:** Depende de comprometimento da cadeia ou escrita local; alto impacto.
- **Recomendação:** Proteger conta/releases, origem do build e revisão; planejar assinatura verificável/MSIX e integridade do helper; avaliar fuses/ASAR integrity.
- **Critério de validação:** Artefato/helper adulterado deve falhar fechado; ensaiar upgrade real e verificação do publicador.
- **Referência:** CWE-494; NIST SSDF PS

### CD-06 — Fila e erros assíncronos do helper sem controle completo

- **Severidade:** MÉDIO
- **Arquivo/localização:** src/main/inputManager.ts:175–207,213–224,270–365
- **Evidência:** Retorno de stdin.write ignorado, sem orçamento/teto da fila nativa e sem listener error do ChildProcess no fluxo de produção.
- **Descrição técnica:** try/catch de spawn não cobre todos os erros assíncronos; coalescimento do cliente oficial não limita cliente modificado.
- **Cenário de risco:** Peer autorizado envia eventos válidos em alta frequência a helper lento, ou executável falha ao abrir.
- **Impacto:** Pressão de memória, latência de revogação, erro não tratado.
- **Probabilidade:** Média em falhas/abuso autorizado; sem benchmark de saturação.
- **Recomendação:** Limitar taxa/fila no main, coalescer movimentos, respeitar drain e tratar error/exit/EPIPE sem laços de retry.
- **Critério de validação:** Helper lento/falhando mantém recursos limitados, libera entradas e não derruba main.
- **Referência:** CWE-400/CWE-755

### CD-07 — Cancelar recebimento não impede gravação

- **Severidade:** MÉDIO
- **Arquivo/localização:** src/renderer/hooks/useFileTransfer.ts:192–270,366–380,653–663
- **Evidência:** cancelTransfer muda abortRef/estado visual, não remove incomingTransfersRef nem notifica remetente. P3: meta → cancelar → chunk → done ainda chamou save simulado uma vez.
- **Descrição técnica:** Cancelamento local não é terminal no estado do recebimento; IDs provisórios da fila também diferem do ID final.
- **Cenário de risco:** Usuário cancela e arquivo continua sendo recebido/salvo.
- **Impacto:** Perda de controle e consumo após cancelamento.
- **Probabilidade:** Alta no fluxo reproduzido.
- **Recomendação:** Cancelar entrada/saída por ID estável, notificar peer e rejeitar chunks/done após término.
- **Critério de validação:** P3 com zero gravações; testar cancelamento pendente, envio, entrada e reconexão.
- **Referência:** CWE-841

### CD-08 — Sucesso de envio sem ACK de persistência

- **Severidade:** MÉDIO
- **Arquivo/localização:** src/renderer/hooks/useFileTransfer.ts:244–294,546–570
- **Evidência:** Após enviar file-done, remetente marca complete e informa sucesso; não há ACK do receptor após saveToDownloads.
- **Descrição técnica:** Erro de disco, nome inválido ou revogação no fim não se transforma em resultado final no remetente.
- **Cenário de risco:** Usuário confia em cópia que não foi persistida.
- **Impacto:** Perda operacional de arquivo/diagnóstico incorreto.
- **Probabilidade:** Média em falhas finais.
- **Recomendação:** ACK correlacionado, prazo e distinção enviado/entregue; digest de arquivo se necessário. DTLS já protege integridade em trânsito.
- **Critério de validação:** Disco cheio, revogação e queda antes do ACK não podem concluir como entregue.
- **Referência:** CWE-754

### CD-09 — Buffers grandes, estados sem TTL e cota de sessão ausente

- **Severidade:** MÉDIO
- **Arquivo/localização:** src/renderer/hooks/useFileTransfer.ts:45–57,131–168,253–288,399–414; src/main/ipcHandlers.ts:73–84
- **Evidência:** Até quatro arquivos de 32 MiB em Maps; conclusão duplica buffers/base64. Entradas incompletas sem TTL. Drain resolve após 2 s mesmo sem drenar; savedFiles cresce até destruir WebContents.
- **Descrição técnica:** Há limites reais por arquivo, não memória ilimitada por uma entrada. Ainda faltam orçamento global, expiração e cota de disco.
- **Cenário de risco:** Peer autorizado ocupa slots ou envia sucessivos arquivos; canal lento mantém pressão.
- **Impacto:** Bloqueio de entradas, latência, memória/disco elevados.
- **Probabilidade:** Média; RSS sob carga não medido.
- **Recomendação:** Streaming para temporários exclusivos, TTL, limites globais e de disco, backpressure real; revisar TOCTOU na criação de nomes.
- **Critério de validação:** Medir recursos com quatro arquivos máximos/canal parado; queda/cancelamento recuperam temporários e orçamento.
- **Referência:** CWE-400; OWASP API4

### CD-10 — Retenção e transparência incompletas

- **Severidade:** MÉDIO
- **Arquivo/localização:** signaling-server/migrations/001_security.sql; src/main/historyManager.ts:6,108–117; src/renderer/hooks/useSessionClipboard.ts:19–23; src/main/ipcHandlers.ts:84
- **Evidência:** Sem prazo implementado para denúncias/identidades/sanções; histórico limitado por servidor sem expiração. Clipboard automático inicia habilitado; log local inclui caminho/nome recebido.
- **Descrição técnica:** Auditoria imutável não define por si retenção legítima. Consentimento de sessão não resolve toda base legal.
- **Cenário de risco:** Conteúdo pessoal de relatos/clipboard permanece em logs, Downloads e backups.
- **Impacto:** Risco de privacidade/governança, sem declaração de infração jurídica.
- **Probabilidade:** Média conforme dados/uso.
- **Recomendação:** Definir finalidades/base legal/retenção com jurídico, avisar automático, reduzir logs e atender direitos compatíveis com auditoria.
- **Critério de validação:** Política refletida em mecanismos reais, exclusão/anonimização e backups; relatórios sem dados pessoais.
- **Referência:** Privacidade; minimização ASVS

### CD-11 — Advisory alto em ferramentas de desenvolvimento

- **Severidade:** MÉDIO
- **Arquivo/localização:** package-lock.json: node_modules/picomatch; package.json:devDependencies
- **Evidência:** npm audit raiz completa reportou 16 pacotes high associados a picomatch 4.0.7, GHSA-fc5q-39xc-vjpf/CVE-2026-112366. Runtime cliente e servidor completo/runtime: zero.
- **Descrição técnica:** Um advisory propagado não equivale a 16 CVEs independentes. Exposição identificada é ReDoS via glob em tooling.
- **Cenário de risco:** Padrão adversarial alcança ferramenta build/lint; não foi demonstrado vetor remoto no app distribuído.
- **Impacto:** Indisponibilidade de tooling/CI. Severidade upstream alta, contextual média.
- **Probabilidade:** Baixa a média conforme controle dos padrões.
- **Recomendação:** Avaliar mitigação/versões compatíveis. Fonte oficial não indicava patch; não aplicar audit fix --force ou downgrade cegamente.
- **Critério de validação:** Audit e teste do vetor limitado em processo isolado, seguido de build/testes.
- **Referência:** CWE-1333; SSDF RV

### CD-12 — Teste administrativo falha no destino do relatório

- **Severidade:** MÉDIO
- **Arquivo/localização:** scripts/test-admin.js:148–150; scripts/admin-browser-worker.js:4–7,316
- **Evidência:** Pai procura browser.json em db.root/run-* e worker grava em artifacts/admin-browser. Comando terminou ENOENT após checks visuais passarem. Harness também registrou updater:getState sem handler.
- **Descrição técnica:** Diretório isolado do banco não é propagado ao relatório do worker. CI não executa test:admin atualmente.
- **Cenário de risco:** Teste aparentemente passa na UI mas falha na integração do relatório.
- **Impacto:** Lacuna de garantia e regressões administrativas não bloqueadas.
- **Probabilidade:** Alta, reproduzida nesta execução.
- **Recomendação:** Compartilhar diretório único por execução, verificar exit/report e registrar/mockar updater explicitamente.
- **Critério de validação:** test:admin sai zero e confirma persistência, sanção, ambos peers e isolamento.
- **Referência:** Qualidade/testabilidade

### CD-13 — APIs legadas e placeholders ainda expostos

- **Severidade:** BAIXO
- **Arquivo/localização:** src/main/connectionManager.ts:38–55,80–138; src/main/webrtcManager.ts:579–590; src/main/preload.ts:154–177,232–249; src/main/index.ts:99–117; src/main/ipcHandlers.ts:34–47
- **Evidência:** Mapa de conexão placeholder, GET_SESSION_INFO sempre desconectado, bridge com métodos sem handler correspondente ou validação uniforme. Captura no main lança erro placeholder.
- **Descrição técnica:** Fluxo ativo usa hooks React e WebSocket. Não se pode contar API exposta como funcionalidade entregue nem declarar código legado vulnerável remotamente sem provar reachability.
- **Cenário de risco:** Manutenção reutiliza API antiga supondo garantias modernas.
- **Impacto:** Estado divergente e superfície IPC aumentada.
- **Probabilidade:** Média para manutenção; exploração remota não demonstrada.
- **Recomendação:** Mapear consumidores/handlers, consolidar estado e descontinuar APIs antigas em mudanças aprovadas; validar store/janela legados.
- **Critério de validação:** Todo método exposto tem consumidor, handler e teste ou é retirado em fase posterior.
- **Referência:** OWASP API9/coerência

### CD-14 — Tentativas de senha sem orçamento agregado por alvo

- **Severidade:** MÉDIO
- **Arquivo/localização:** signaling-server/src/server.ts:450–462; src/main/deviceSecurity.ts:security:verify-password
- **Evidência:** Buckets caller+target e IP+target; main limita duas derivações simultâneas, sem janela agregada por dispositivo alvo.
- **Descrição técnica:** Trocar chave no mesmo IP não derrota o bucket de IP, mas múltiplos IPs/identidades somam tentativas. Senhas novas exigem 12 caracteres.
- **Cenário de risco:** Remetentes distribuídos adivinham senha ou ocupam chamadas do alvo.
- **Impacto:** Força bruta distribuída/indisponibilidade; não assume ID sem chave.
- **Probabilidade:** Condicional à distribuição e força da senha.
- **Recomendação:** Orçamento progressivo por alvo, alertas e mitigação sem bloqueio permanente facilmente abusável; manter limites de IP/identidade.
- **Critério de validação:** Múltiplos remetentes sintéticos atingem teto agregado sem impedir indefinidamente uso legítimo.
- **Referência:** CWE-307; OWASP API2

### CD-15 — Autoridade nativa sem lease independente do renderer

- **Severidade:** MÉDIO
- **Arquivo/localização:** src/main/sessionAuthority.ts:76–83; src/main/inputManager.ts:259–264; src/main/windowManager.ts
- **Evidência:** Cleanup do proprietário escuta destroyed; não localizado tratamento de render-process-gone/unresponsive ou lease. Revogação de sinalização passa pelo renderer.
- **Descrição técnica:** Crash/hang do renderer não necessariamente destrói WebContents nem processa mensagem de término.
- **Cenário de risco:** Renderer trava com tecla pressionada/estado autorizado.
- **Impacto:** Entrada presa e atraso de revogação; não foi provocado crash destrutivo para medir atraso.
- **Probabilidade:** Média em falhas; identificado por revisão estática.
- **Recomendação:** Revogar no main por crash/perda de autoridade/lease e liberar teclas/filas de forma idempotente.
- **Critério de validação:** Simular falta de heartbeat e render-process-gone: APIs negadas e entradas liberadas no prazo definido.
- **Referência:** CWE-664/fail closed

### CD-16 — Runbooks e versão do health desatualizados

- **Severidade:** BAIXO
- **Arquivo/localização:** docs/ADMIN.md:Cliente/Antes da hospedagem; docs/RELEASE.md; signaling-server/src/server.ts:136
- **Evidência:** Guia manda configurar URL em tela retirada e diz hospedagem pendente; release 1.0.0 afirma sem remoto Git/localhost. Health retorna 1.0.1 com pacote 1.0.2.
- **Descrição técnica:** Histórico e instrução atual não estão claramente separados.
- **Cenário de risco:** Operador segue receita antiga ou valida binário/serviço errado.
- **Impacto:** Falhas operacionais e suporte confuso.
- **Probabilidade:** Alta ao seguir documentos antigos.
- **Recomendação:** Separar histórico/runbook atual e derivar versão do pacote.
- **Critério de validação:** Reproduzir setup limpo e confirmar versões coerentes.
- **Referência:** Qualidade/documentação

### CD-17 — Capacidade e operação sem SLO/carga sustentada comprovados

- **Severidade:** MÉDIO
- **Arquivo/localização:** render.yaml:plan free,numInstances; signaling-server/src/config.ts:56–69; signaling-server/src/server.ts:176–180,679–775; scripts/database-recovery.js:50–65
- **Evidência:** Uma instância free e limites presentes; sem suíte de carga/métricas/alerta versionados. Backup lógico reúne tabelas em memória.
- **Descrição técnica:** MAX_CONNECTIONS=250 é configuração, não capacidade medida. Suspensão/reinício perde chamadas em memória.
- **Cenário de risco:** Pico/reconnect storm, banco lento ou suspensão durante sessão.
- **Impacto:** Indisponibilidade sem diagnóstico proativo.
- **Probabilidade:** Média; nenhum ensaio no serviço real.
- **Recomendação:** Definir SLO beta, métricas de fila/pool/event loop/RSS, carga/recuperação isoladas e backup agendado/retido.
- **Critério de validação:** Curvas de latência/consumo/erros, recuperação e RPO/RTO medidos.
- **Referência:** OWASP API4/operação

### CD-18 — Gates de segurança e fixação de Actions incompletos

- **Severidade:** BAIXO
- **Arquivo/localização:**  .github/workflows/build.yml; .github/workflows/hosting.yml; package.json:scripts
- **Evidência:** Actions por tags v6. Sem execução de audit/test:admin/test:device-clipboard nos workflows; sem arquivos Dependabot/CodeQL ou SBOM.
- **Descrição técnica:** Ausência versionada não comprova secret scanning desabilitado na conta; configurações privadas não consultadas.
- **Cenário de risco:** Action upstream/advisory ou regressão passa sem avaliação contextual automática.
- **Impacto:** Risco de supply chain e cobertura.
- **Probabilidade:** Condicional; configuração da conta não examinada.
- **Recomendação:** Fixar SHA revisado, atualizações/SAST/audit contextual, SBOM e regressões críticas.
- **Critério de validação:** PR demonstra gates e revisão de permissões/proteções de branch/release.
- **Referência:** NIST SSDF PO/PS

### CD-19 — Endpoint embutido não é segredo; identidade não é pessoa

- **Severidade:** INFORMATIVO
- **Arquivo/localização:** scripts/configure-client-build.js; src/main/serviceSelection.ts; docs/RELIABILITY-AND-UPDATES.md
- **Evidência:** URL injetada privadamente é necessária ao WebSocket; outro software pode extrair endereço e gerar novas chaves.
- **Descrição técnica:** Sigilo do Git evita divulgação incidental, não extração do binário/tráfego; banimento vincula chave.
- **Cenário de risco:** Cliente alterado extrai endpoint ou recria identidade.
- **Impacto:** Limite de arquitetura/abuso, não vazamento de credencial.
- **Probabilidade:** Esperada para quem possui binário e capacidade técnica.
- **Recomendação:** Controles independentes do sigilo da URL; não prometer identidade física permanente.
- **Critério de validação:** Documentação/UX e testes não usam URL secreta como autorização.
- **Referência:** Modelo de ameaças

## Limites e referências

Nenhum risco crítico foi comprovado; isso não afirma inexistência de críticos desconhecidos. Não demonstrada tomada de ID apenas por conhecê-lo nem cadeia remota completa sem autenticação. Infraestrutura física e configurações privadas das contas não foram auditadas.

Referências: [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security), [OWASP ASVS](https://owasp.org/projects/asvs), [OWASP API Security](https://api-security.owasp.org/editions/2023/en/0x11-t10/), [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final), [RFC 8827](https://www.rfc-editor.org/rfc/rfc8827.html), [picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). CWE indica classe, não CVE próprio. MASVS seria analogia para armazenamento/canais; não há cliente Android nem conformidade MASVS avaliada.
