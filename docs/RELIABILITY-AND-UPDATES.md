# Sessões, confiabilidade e atualização integrada

Estado em 13/11/2026: código integrado e validado localmente. Não foram gerados instaladores, publicadas releases, enviado código ao GitHub ou feito deploy nesta etapa. A versão do pacote continua 1.0.1; a numeração da próxima release será definida antes de empacotar, sem sobrescrever os instaladores anteriores.

## Sessões e permissões

O servidor autentica a identidade Ed25519 e negocia a capacidade `session-permissions-v1`. Os dois participantes precisam dessa capacidade para iniciar novas chamadas. O anfitrião seleciona um monitor ou janela e autoriza recursos; a captura começa depois da confirmação do servidor para ambos.

Visualização é a base da sessão. Controle, clipboard e arquivos têm permissões independentes. Solicitações manuais começam com as três opções marcadas. Janelas desativam controle de mouse e teclado; voltar a um monitor não reativa automaticamente uma permissão revogada. O anfitrião pode alterar as permissões em **Tela e permissões**.

O processo principal também verifica permissões, origem e argumentos das APIs. Controle exige monitor identificado e captura pronta. Alterar a fonte suspende essa autorização até a nova captura estar pronta. Revogação libera entradas pressionadas e cancela arquivos em andamento; mensagens negadas são descartadas mesmo quando enviadas diretamente pelos canais. Campos de eventos de teclado e mouse são validados antes da injeção nativa.

O clipboard continua sincronizando durante a sessão autorizada, mesmo com o painel fechado. A opção de sincronização automática pode ser desativada pelo usuário. Abrir o painel permite ler, enviar e aplicar texto manualmente. Nenhuma leitura/aplicação remota é permitida com clipboard revogado.

Novos perfis de acesso por senha começam somente com visualização. Perfis habilitados antes desta mudança preservam o acesso já configurado; as preferências mostram os recursos permitidos e permitem revisá-los. O monitor principal é escolhido nesse modo. Senha e perfil são salvos juntos no processo principal.

Não existe fallback para vídeo de área de trabalho virtual. Fonte encerrada ou monitor removido pausa o compartilhamento e exige nova escolha. A implementação usa STUN, sem TURN; algumas redes não conseguirão estabelecer mídia. O diagnóstico diferencia serviço, identidade, chamada, captura e WebRTC, com estatísticas reais e relatório sanitizado copiável.

## Histórico

O histórico completo fica no processo principal, em `session-history.json` dentro do perfil Electron, separado por servidor e limitado a 1.000 registros em cada escopo. Tentativas têm resultado, direção e horários; duração só aparece quando os horários reais são conhecidos. Interrupção do aplicativo não inventa horário final.

Recentes continuam sendo atalhos atualizados após aceite confirmado. Favoritos têm persistência independente. O histórico antigo é migrado como resumo legado, sem fabricar resultados ou duração. Há busca por nome/ID, filtros e paginação. Limpar o histórico preserva identidade, favoritos e auditoria administrativa.

## Atualização

A implementação segue o fluxo de `electron/updater.ts` e do hook de atualização do Workspace Fiscal no commit `3f81857e1159c5313c5e585265e0562d53289923`, usando `electron-updater`, NSIS e GitHub Releases.

- Consulta automática três segundos após iniciar, quando a última consulta tem pelo menos 24 horas; consulta manual nas configurações.
- Estados de consulta, disponível, atualizado, download, baixado, instalação e erro, com notas, versão, data, bytes, velocidade e progresso.
- Download somente por ação explícita. Cancelar interrompe a operação. Fechar o aplicativo não inicia instalação.
- Aviso automático adiado enquanto houver chamada/sessão. Instalação bloqueada no processo principal quando ocupado.
- Fallback direto exige release estável correspondente, nome/arquitetura esperados, HTTPS e origens permitidas, tamanho e SHA-512 de `latest.yml`. O arquivo é verificado novamente antes de iniciar instalação. Sem metadados verificáveis, só resta o download manual no GitHub.
- Desenvolvimento permite consulta, mas não download/instalação. Os testes simulam ações e nunca executam instaladores.

Não há assinatura Authenticode contratada ou garantida. Checksums fornecem integridade conforme os metadados do repositório, não uma garantia independente caso a conta/release seja comprometida. Proteger a conta GitHub e revisar os artefatos continua necessário.

### Publicação futura

1. Concluir as validações externas e definir uma versão nova, coerente no pacote e nos metadados.
2. Manter o deploy automático da Render desativado até coordenar a atualização. O servidor novo exige suporte a permissões; não implantá-lo durante sessões ou supondo compatibilidade com todos os clientes antigos.
3. Configurar `COFFEE_OFFICIAL_SIGNALING_URL` como segredo de build, ou usar `.env.client.local` privado no computador do operador. O endereço não deve entrar no código, fonte ZIP, relatório ou logs. Ele será incorporado ao executável; não é um segredo recuperável apenas por quem possui o repositório.
4. Quando autorizado a empacotar, produzir o instalador NSIS da arquitetura desejada, `latest.yml`, blockmap e `SHA256SUMS.txt`. Preservar os instaladores anteriores.
5. Revisar nome, versão, arquitetura e correspondência dos metadados. Publicar os arquivos juntos na GitHub Release; nunca publicar `latest.yml` apontando para um instalador ausente.
6. O workflow Windows prepara os artefatos em execução manual/tag; não publica automaticamente uma release. Não disparar o empacotamento enquanto vigorar a instrução de entregar somente código/testes.
7. Validar atualização real entre duas versões instaladas antes de divulgar. Versões antigas sem atualizador precisam de uma primeira instalação manual.

## Backup e recuperação do PostgreSQL

Os scripts `scripts/database-recovery.js` e `scripts/test-recovery.js` implementam e testam um backup lógico do esquema atual. O snapshot consistente é criptografado antes de gravar, com AES-256-GCM e chave derivada por scrypt. Inclui identidades públicas, administradores, sanções, denúncias e auditoria; não restaura sessões administrativas.

Os comandos recebem `DATABASE_URL` e `COFFEE_BACKUP_PASSPHRASE` em ambiente privado:

```powershell
npm.cmd run database:backup -- CAMINHO_PRIVADO_DO_BACKUP
npm.cmd run database:restore -- CAMINHO_PRIVADO_DO_BACKUP
```

Não inserir valores de segredos no histórico de comandos, Git ou chat. Usar credencial de operador apropriada; o usuário restrito da aplicação não pode criar objetos na restauração. A senha de backup é exclusiva e longa, com mínimo de 14 caracteres no script.

Manter `ADMIN_ENCRYPTION_KEY` em recuperação separada. Ela não está incluída no backup e é necessária para decifrar o TOTP restaurado. Proteger e testar ambos os meios de recuperação; copiar somente o banco não basta para recuperar os administradores.

Restauração exige banco novo com esquema `public` vazio. O script recusa sobrescrever um banco com tabelas e usa transação. O ensaio automatizado cria outro banco PostgreSQL local, restaura, reconecta, confere sanções/auditoria/TOTP, verifica senha errada e tentativa de sobrescrita, e descarta o destino. Nenhum teste usa produção.

O formato atual é específico do esquema versão 1, com snapshot em memória; para novos esquemas ou volumes grandes, adaptar e ensaiar antes, ou estabelecer um fluxo geral com `pg_dump`/`pg_restore`. Não considerar este formato um backup universal de PostgreSQL.

## Evidências e limites

- Regressão Electron local: 91 verificações passaram, com vídeo, teclado, arquivo real, clipboard com painéis fechados, payloads negados, revogação de transferência longa, troca para janela real, fechamento da fonte e retorno ao monitor.
- Núcleo: 39 verificações cobrem atualizador simulado, diagnóstico sanitizado, busca e geometria, incluindo barras do vídeo e coordenadas negativas.
- Modal/hook de atualização: 18 verificações em Electron, incluindo teclado, aviso adiado, progresso, cancelamento, erro, desenvolvimento e três resoluções.
- Segurança do servidor: 78 verificações; painel: 21; configuração/hospedagem: 31; privacidade da configuração: 11; histórico/IPC: 9; recuperação: 12, conforme os relatórios locais e o checkpoint anterior.
- Lint, TypeScript, builds e entrada principal foram verificados. As saídas locais ficam em `artifacts/`, ignorado pelo Git. Capturas principais em `artifacts/redesign/coffee-desk-1672x941.png`, `coffee-desk-1440x900.png` e `coffee-desk-1024x680.png`.

Permanecem pendentes por dependerem de ambiente externo: vários monitores físicos com escalas distintas, duas máquinas em redes diferentes, suspensão/despertar do serviço gratuito, executável empacotado desta implementação e atualização real entre dois instaladores. A execução em duas janelas locais não substitui esses ensaios.

O renderer oficial faz parte da fronteira de confiança das APIs nativas: a validação de origem e argumentos não é uma defesa contra um renderer integralmente adulterado. Sanções encerram sessões nos clientes oficiais e impedem o uso do serviço, mas não interrompem diretamente P2P mantido por clientes modificados. Não prometer identificação física permanente, conectividade universal ou criptografia ponta a ponta de toda a sinalização.