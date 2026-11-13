# Continuidade — Coffee Desk: confiabilidade, sessões e atualizações

Atualizado em 13/11/2026. O trabalho foi retomado nesta mesma máquina, sem push ou deploy. O checkpoint anterior é `18cb845`.

Incidente posterior: o executável falhou no aceite entre duas máquinas porque o servidor hospedado ainda usa a confirmação anterior. Correção e implantação necessária em [INCIDENT-ACCEPT-CONFIRMATION.md](docs/INCIDENT-ACCEPT-CONFIRMATION.md). Não foi feito deploy.

Documentação consolidada: [sessões, verificações, atualização e recuperação](docs/RELIABILITY-AND-UPDATES.md).

**Estado: implementação integrada em desenvolvimento; não é uma release liberada.** Não foram gerados instaladores, publicadas releases, alterado o banco de produção ou feito deploy do servidor nesta etapa. A versão do pacote permanece 1.0.1; decidir a próxima versão antes da futura publicação.

## Decisões que devem ser preservadas

- Não adicionar TURN nesta etapa. STUN não garante conectividade entre todas as redes.
- Preservar a identidade visual espresso/copper e a assinatura **Café - Sistemas & Softwares**.
- Manter conexão automática e não publicar o endereço do serviço no código ou na documentação.
- Não voltar a exibir configuração de URL nas preferências.
- Preservar favoritos independentes, atalhos de recentes e a primeira animação da xícara aprovada.
- Solicitações manuais começam com controle, clipboard e arquivos marcados. Compartilhar janela desativa o controle; clipboard e arquivos continuam seguindo as permissões independentes.
- Novas configurações de acesso por senha começam somente com visualização. Configurações antigas habilitadas preservam suas permissões, com indicação nas preferências.
- Não gerar instaladores, publicar releases ou executar instaladores nos testes desta entrega.
- Coordenar qualquer deploy futuro para não interromper sessões. O servidor novo exige negociação da capacidade `session-permissions-v1`; alinhar a atualização dos clientes antes de implantar.

## Implementado no código

### Sessões, diagnóstico e captura

- Contratos compartilhados de permissões, diagnóstico, seleção de fonte, histórico e atualização.
- Diagnóstico de sinalização/autenticação/chamada e mídia, estatísticas reais de WebRTC e relatório sanitizado copiável. A lista permitida exclui endereço do serviço, IPs, senhas, tokens, chaves, SDP e títulos de janelas.
- Seleção de monitor ou janela antes do aceite manual e seletor para troca durante a sessão.
- Removido o fallback de área de trabalho virtual. Falhas de captura são apresentadas com possibilidade de nova tentativa.
- Aceite confirmado pelo servidor para os dois participantes; só depois o cliente habilita a sessão.
- Monitoramento de desaparecimento da fonte e mudanças na topologia de monitores, com suspensão da captura/controle e solicitação de nova seleção.
- Captura limitada a até 1920 × 1080 para reduzir consumo de recursos; preferência de 30 quadros/s, sem promessa de desempenho fixo.
- Coordenadas normalizadas convertidas para o monitor escolhido, incluindo origem negativa; helper Win32 com reconhecimento de DPI. Eventos fora da área de vídeo são descartados.
- Permissões independentes, revogação pelo anfitrião, bloqueios nos receptores dos canais e APIs nativas. Revogação libera teclas/botões e cancela transferências.
- Acesso por senha com perfil persistente. Salvamento da senha e do perfil na mesma operação nativa.
- Clipboard textual pelo canal WebRTC e APIs nativas protegidas. A sincronização permanece ativa durante a sessão autorizada, mesmo com o painel fechado; revogação interrompe leitura, envio e aplicação.
- Limites de arquivos/fila/memória e validação do caminho de gravação. Abrir/revelar arquivos limita-se aos arquivos recebidos pela janela atual.

### Histórico e busca

- Histórico no processo principal (`electron-store`), por servidor, com até 1.000 registros por servidor.
- Tentativas canceladas, recusadas, falhas e sessões estabelecidas, direção, horários, duração quando conhecida e motivo de término.
- Migração dos recentes antigos como resumos legados, sem inventar horários ou duração.
- Recuperação de registros interrompidos sem inventar o horário final.
- Histórico completo com filtros e paginação; busca por nome/ID também nos recentes e favoritos, incluindo busca sem acentos e ID agrupado.
- Recentes continuam sendo atualizados somente após aceite confirmado. Limpeza do histórico preserva favoritos e identidade.

### Atualizador

Referência: Workspace Fiscal, commit `3f81857e1159c5313c5e585265e0562d53289923`, especialmente `electron/updater.ts` e o hook de atualização.

- `electron-updater`, NSIS, GitHub Releases do repositório `sAlly-19/Cofee-Desk`.
- Consulta após três segundos quando a consulta anterior tem pelo menos 24 horas, e botão de consulta manual nas preferências.
- Estados e ações de verificar, disponível, atualizado, baixar, cancelar, depois, instalar/reiniciar, erro/tentar novamente e abrir GitHub.
- Progresso com bytes e velocidade; notas de versão renderizadas como texto.
- Download e instalação dependem de ação do usuário. `autoDownload` e `autoInstallOnAppQuit` desativados.
- Aviso automático adiado durante chamada/sessão; instalação bloqueada no processo principal quando ocupado.
- Fallback de download direto, com validação de versão estável, arquitetura, nome, HTTPS, origem/redirecionamentos, tamanho e SHA-512 de `latest.yml`; arquivo novamente verificado antes da execução.
- Cancelamento, proteção contra downloads duplicados, remoção de arquivos parciais e mensagens sem dados de transporte.
- Desenvolvimento permite consulta, mas bloqueia download e instalação.
- Configuração futura de publicação e artefatos `latest.yml`, blockmap e checksums preparada. Nenhum instalador foi executado ou gerado.

### Infraestrutura de desenvolvimento

- Configuração ESLint adicionada e comando de lint cobrindo aplicativo, servidor e painel.
- Build do helper nativo versionado como `CoffeeInput-v2.exe`, evitando sobrescrever um executável antigo em uso. Linux não tenta compilar o helper Windows.
- Backup lógico específico do esquema atual, criptografado com AES-256-GCM e chave derivada por scrypt, sem gravar um dump em texto claro.
- Restauração transacional somente em banco com esquema `public` vazio; não sobrescreve banco existente. Sessões administrativas não são restauradas.
- Scripts de testes novos para atualização/geometria/diagnóstico/busca, histórico/IPC e recuperação PostgreSQL.

## Verificações executadas

Resultados da última execução disponível nesta máquina:

| Verificação | Resultado |
| --- | --- |
| `npm run lint` | Passou, inclusive após os últimos ajustes |
| `npm run typecheck` | Passou, inclusive após os últimos ajustes |
| `npm run build` | Passou: renderer, TypeScript do Electron, helper nativo e preload |
| `npm run build:server` | Passou |
| `npm run build:admin` | Passou |
| `npm run test:security` | 78 verificações passaram |
| `npm run test:admin` | 21 verificações do navegador e confirmação final de persistência/notificação passaram |
| `npm run test:hosting` | 31 verificações passaram, em ambiente local isolado |
| `npm run test:client-config` | 11 verificações passaram |
| `npm run test:reliability` | 43 verificações passaram, incluindo compatibilidade de aceite |
| `npm run test:update-ui` | 18 verificações do modal/hook em Electron passaram |
| `npm run test:history` | 9 verificações passaram, usando Electron e armazenamento reais |
| `npm run test:recovery` | 12 verificações passaram, usando PostgreSQL real isolado |
| `npm run verify:startup` | Passou com a entrada principal real e controle bloqueado sem sessão |
| `npm run verify:redesign` | **Última execução em 13/11 passou: 91 verificações, zero falhas** |
| `npm run audit:security` | Zero vulnerabilidades reportadas para cliente, servidor e runtime do servidor |

A última regressão visual/funcional testou duas janelas Electron com identidades diferentes, servidor local e PostgreSQL reais: vídeo WebRTC, teclado, arquivo recebido e gravado, recusa/cancelamento, revogação e reautorização, bloqueios de clipboard/arquivos por IPC nos dois participantes, senha, perfil inicial somente visualização, histórico, favoritos, reconexão e controles nativos da janela.

Houve execuções intermediárias com `Renderer gone: oom` e monitor indisponível no Windows; a captura foi limitada e uma repetição final terminou sem falhas. Outra falha intermediária era uma corrida do teste que recarregava antes de terminar o salvamento da senha; o teste agora aguarda a conclusão. Não interpretar as falhas intermediárias como resultados da última execução.

Os testes de segurança incluem tomada de identidade, desafios, mensagens sem autorização, aceite forjado, capacidade ausente, alteração de permissões por terceiros/visualizador, controle de janela negado, sanções, CSRF/TOTP, limites e persistência. A recuperação confirmou também a imutabilidade da auditoria e a recuperação do TOTP com a chave administrativa mantida separadamente.

Evidências locais **ignoradas pelo Git**, que não acompanharão o clone:

- `artifacts/redesign/validation.json` e capturas nas três resoluções.
- `artifacts/security-live/validation.json`.
- `artifacts/admin-browser/browser.json`.
- `artifacts/reliability/validation.json`.
- `artifacts/history-native-*/validation.json`.
- `artifacts/recovery-drill/validation.json`.
- `artifacts/startup-smoke/result.json` e `artifacts/security-audit/`.

## Situação após a retomada em 13/11

- Corrigida a sincronização de clipboard para funcionar também com os painéis fechados.
- Validados envio/aplicação efetiva de clipboard, payloads negados nos canais e revogação durante arquivo de 4 MB com envio controlado pelo teste.
- Validadas troca para uma janela real da própria fixture, fechamento da fonte, aviso ao visualizador e retorno ao monitor sem restaurar controle revogado.
- Controle nativo agora exige captura pronta, além de autorização e monitor identificado.
- Adicionada validação de tipos dos campos de teclado/mouse também antes da injeção nativa; eventos inválidos são descartados.
- Mapeamento de barras do vídeo extraído para função usada pelo aplicativo e coberta por testes. Sem metadados reais de vídeo, entrada é descartada.
- Corrigida a recusa de captura no Electron 45 para usar callback nulo, evitando rejeição sem tratamento quando uma fonte desaparece.
- Modal/hook de atualização testado em Electron com 18 verificações, sem rede ou execução de instalador.
- Documentação operacional e CI atualizados. O workflow não publica uma release automaticamente.

## Pendências externas e de liberação

1. Matriz em hardware físico com vários monitores, posições negativas e escalas diferentes; a geometria e o letterboxing têm testes automatizados, mas não substituem hardware.
2. Sessão completa entre duas máquinas de redes distintas. A comunicação local em duas instâncias passou, incluindo mídia, teclado, arquivos e clipboard.
3. Suspensão/despertar da hospedagem gratuita e implantação coordenada do servidor. Não houve acesso a produção nesta retomada.
4. Executável empacotado desta implementação e atualização real entre dois instaladores; continuam pendentes conforme a instrução de não gerar instaladores nem publicar releases.
5. Definir a próxima versão antes da publicação. Clientes antigos sem atualizador precisarão de instalação manual inicial.
6. Revisar os resultados locais em caso de novas mudanças. Não enviar segredos nem configuração privada ao repositório.

A fronteira nativa confia no renderer oficial, com origem/argumentos validados. Isso não protege contra um renderer integralmente adulterado. A atualização depende dos metadados do GitHub e não oferece assinatura Authenticode garantida. Consulte os riscos residuais no documento consolidado.

## Retomar no outro computador

1. Este checkpoint é um **commit local**. Enviar os commits ao GitHub antes de trocar de PC: `git push origin main`. Confirmar que deploy automático da Render continua desativado; o envio não deve implantar este protocolo novo inadvertidamente.
2. No outro computador, clonar/atualizar `sAlly-19/Cofee-Desk` e abrir este arquivo primeiro.
3. Instalar Node.js compatível (22.12 ou superior) e executar no PowerShell:

   ```powershell
   npm.cmd ci
   npm.cmd ci --prefix signaling-server
   npm.cmd run lint
   npm.cmd run typecheck
   npm.cmd run build:server
   npm.cmd run build:admin
   npm.cmd run build
   npm.cmd run test:reliability
   npm.cmd run test:history
   npm.cmd run test:recovery
   ```

4. Os testes locais usam bancos isolados em `artifacts/`; não precisam do banco de produção. Os testes Electron/captura exigem Windows com sessão gráfica disponível.
5. A configuração privada do cliente fica em `.env.client.local`, ou na variável `COFFEE_OFFICIAL_SIGNALING_URL` usada pelo build. Sem ela, desenvolver/testar localmente é possível; não empacotar um cliente para produção sem restaurar a configuração privada.
6. Segredos de operador estão somente em arquivos ignorados (`artifacts/hosting/.env.operator` e `.env.render`). Não enviá-los ao chat, ao GitHub ou a logs. Se forem necessários no outro PC, transferi-los por canal privado; não copiar identidades protegidas pelo `safeStorage` entre máquinas como se fossem portáveis.
7. Os commits anteriores relevantes são `9a690f6` (favoritos/interface aprovados), `2b4486a` (endereço fora do código público) e `72875f3` (segurança e preparação Render/Neon).

## Operação dos novos scripts de recuperação

- `npm run database:backup -- CAMINHO_DO_ARQUIVO` e `npm run database:restore -- CAMINHO_DO_ARQUIVO`.
- Recebem `DATABASE_URL` e `COFFEE_BACKUP_PASSPHRASE` por ambiente privado; não colocar valores literais no Git ou no histórico do terminal.
- Usar credencial de operador apropriada para ler o esquema completo ou criar objetos na restauração. A credencial restrita da aplicação não serve para migrações/restauração.
- Usar senha de backup longa e exclusiva (mínimo implementado: 14 caracteres). A chave `ADMIN_ENCRYPTION_KEY` fica em recuperação separada: não está incluída no backup.
- O backup implementado é lógico e específico do esquema atual (versão 1); não substitui um processo geral de `pg_dump` para futuras alterações de esquema ou volumes muito grandes.
- Restauração recusa esquema público que já possua tabelas. Não executar testes em produção. O ensaio automatizado cria e descarta outro banco local, sem sobrescrever produção.