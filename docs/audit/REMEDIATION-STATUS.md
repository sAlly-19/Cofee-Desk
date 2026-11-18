# Andamento da remediação aprovada

Atualizado em 18/11/2026. Auditoria original: base 26cfb1b, preservada como fotografia de 17/11. Este documento descreve o código posterior, ainda não publicado. Não usar a contagem original de achados como se todos permanecessem iguais, nem tratar mitigação parcial como risco encerrado.

## Correções integradas

| Achado | Estado do código / evidência |
|---|---|
| CD-01 | Sinalização e autenticação no main; concessão somente após resposta real do serviço. IPC não cria/aumenta privilégios. Busy pendente/ativo independente de flags UI. Regressões de concessão/papel/replay de contexto e integração local |
| CD-02 | Abrir exige origem, sessão/permissão, lista de recebidos, tipo permitido e confirmação nativa; erro do SO não vira sucesso |
| CD-03 | CSP de produção, sem script inline/eval ou rede arbitrária no renderer; estilos inline existentes permitidos. Desenvolvimento só em loopback |
| CD-04 | Permissão de captura exige host/fonte/origem; câmera/microfone não liberados genericamente; fonte vinculada ao contexto da chamada |
| CD-05 | **Parcial.** Manifesto SHA-256 do helper no ASAR, somente helper v2 no diretório de recursos, recusa adulteração e fallback fora do pacote. Fuses preparados/validados por schema. Autenticidade do pacote completo/assinatura ainda pendentes |
| CD-06 | **Mitigado parcialmente.** Fila nativa limitada, não reativa acima do teto; erros de child/stdin/exit pausam controle e refletem status na UI. Comandos já presentes no pipe e morte abrupta do helper continuam exigindo ensaios adicionais |
| CD-07 | Cancelamento remove entrada/fila, usa ID estável, notifica peer e rejeita conclusão tardia; recebimento duplicado não grava duas vezes. Cancelar não desfaz um arquivo já confirmado e salvo |
| CD-08 | Remetente aguarda ACK após gravação/flush; falha de disco, ACK indevido ou ausência de confirmação não viram entrega. Ambos clientes novos são necessários para confirmação completa |
| CD-09 | **Mitigado parcialmente.** Aggregate de entrada 64 MiB, quatro entradas, TTL 60 s sem atividade, backpressure real e cancelável, criação exclusiva, 256 MiB/500 recebimentos por chamada, ledger limpo ao terminar. Streaming para disco e profiling sustentado ainda pendentes |
| CD-10 | **Parcial.** Aviso de automático, logs de ID/caminho removidos dos fluxos novos, erros sanitizados e política técnica de dados documentada. Canal privado definido em SECURITY.md. Retenção jurídica e obrigações operacionais precisam de definição do responsável |
| CD-11 | **Aberto com mitigação temporária.** Sem troca cega de dependências. Gate bloqueia novos advisories/produção/falha de consulta e permite somente picomatch high no tooling até 02/12/2026 UTC. Exceção vence e CI deve falhar se não houver solução/revisão |
| CD-12 | Harness usa diretório isolado comum; updater registrado; comando admin volta a terminar com sucesso e confirma persistência/peer notificado |
| CD-13 | **Consolidação parcial.** Métodos legados não usados e assinatura removidos da bridge, registradores placeholder não ligados ao main. APIs de janela/store remanescentes validadas. Limpeza física de módulos legados e coordenador único de todos estados ainda planejados |
| CD-14 | Limite agregado por destino, além de IP/identidade, testado com remetentes e IPs sintéticos distintos. Não é proteção absoluta contra botnet ou bloqueio físico de pessoa |
| CD-15 | **Mitigado parcialmente.** Main possui heartbeat/tolerância, encerra socket/recursos em crash, travamento ou navegação; teste de perda do renderer revoga permissões. Ensaios de mídia com renderer realmente travado e comandos nativos em voo permanecem pendentes |
| CD-16 | ADMIN/RELEASE atualizados; health deriva versão do pacote; arquitetura, resposta a incidentes e retenção técnica documentadas |
| CD-17 | **Parcial.** Métricas privadas e ensaio local limitado de 50 identidades/25 chamadas, isolamento e teto de conexão. Não mede a capacidade da Render; soak, falhas sustentadas e alertas reais pendentes |
| CD-18 | Actions fixadas por SHA consultado; Dependabot/CodeQL configurados; novos gates/testes no CI; SBOM local gerado. Workflows novos ainda precisam rodar no GitHub após push autorizado |
| CD-19 | Limite documentado: endpoint recuperável do binário e identidade por chave, não pessoa/equipamento permanente |

Além da fotografia inicial, foram corrigidas corridas de aceite: seleção de fonte ou verificação de senha atrasadas não podem autorizar uma chamada posterior do mesmo peer. O aceite leva seu callId original e a seleção nativa revalida o contexto após enumeração assíncrona. Desativar ou trocar a senha invalida verificações em andamento; o aceite automático revalida política, verificador e monitor principal no main.

## Evidências locais

- Lint, TypeScript, builds e testes de fronteiras nativas, transferência, corrida de chamada, política de captura/CSP, helper, gate de advisory e configuração executados.
- Regressão Electron local usa servidor/PG efêmeros em porta exclusiva, sem reaproveitar serviço existente. Valida mídia real, teclado, arquivo, clipboard, fonte, permissão, senha, histórico e favoritos. Capturas desativadas por padrão no modo verify.
- Teste administrativo usa banco/perfil isolados e valida login/TOTP, ações, sanção, revogação e responsividade. Sem prints por padrão.
- Ensaio de carga: 50 identidades, 25 chamadas simultâneas; p95 de autenticação ~419 ms e aceite ~25 ms naquela execução. RSS do processo servidor+harness ~60,3→71,2 MB decimais; banco filho não incluído. É uma amostra de loopback com limites de teste ajustados, não SLA/capacidade pública ou prova de ausência de leak.
- SBOM gerado em artifacts/sbom (cliente/tooling e servidor), sem publicação. Advisory de tooling continua reportado; runtime cliente/servidor sem advisories na consulta realizada.
- Resultados detalhados e limites estão nos scripts e artefatos ignorados. Inicialização de código em desenvolvimento não valida o pacote com fuses novos.

### Reexecução final (18/11/2026)

| Verificação | Resultado |
|---|---|
| ESLint, TypeScript, build cliente/main, servidor e painel | Passaram |
| Fronteiras nativas/autorização/abertura de arquivos | 27 checks |
| Corridas de chamada / senha | 3 + 3 checks |
| Protocolo de transferência / helper com streams simulados | 13 + 6 checks |
| Política de captura/CSP em Electron real | 5 checks |
| Segurança / hospedagem | 81 + 31 checks |
| Confiabilidade/atualizador / UI atualização / UI sessão | 43 + 18 + 23 checks |
| Regressão integrada Electron local | 112 checks; zero falhas; sem capturas |
| Painel administrativo integrado | 22 checks; persistência e revogação confirmadas |
| Inicialização / schema builder e fuses | Passaram; nenhum instalador executado |
| Gate de advisories com fixtures | 7 checks |
| Clipboard de arquivos / cópia de ID / histórico / configuração privada | 20 + 9 + 9 + 11 checks |
| Consulta real de advisories | Runtime cliente/servidor e tooling servidor: zero; tooling cliente: 16 pacotes afetados pelo advisory explicitamente permitido até 02/12/2026 |

O teste integrado foi atualizado para exigir a bridge nova e confirmar ausência da mutação de ID e da assinatura no renderer; a expectativa antiga foi removida após falhar na primeira reexecução. Avisos de configuração CommonJS do Vite permanecem informativos, sem impedir build. Recusas IPC induzidas nos testes são esperadas e verificadas como bloqueios, não falhas inesperadas.

## Bloqueios e próximos gates

Não foi gerado/instalado pacote novo, feita assinatura, publicado release, feito push ou realizado deploy nesta etapa. O instalador anterior não contém automaticamente estas correções. Servidor hospedado só recebe limite agregado/métricas após deploy autorizado e coordenado.

Permanecem para liberação: novo pacote/fuses/upgrade/rollback reais; decisão de assinatura/Store; duas máquinas em redes distintas; múltiplos monitores/DPI/UAC; suspensão/despertar do provedor; carga sustentada e monitoramento; streaming/profiling e falhas extremas do helper/renderer; responsabilidades jurídicas e retenção. Não declarar toda a auditoria encerrada ou produto comercial de alta confiança enquanto esses gates faltarem.

Revisão final da árvore: git diff --check passou; nenhum novo arquivo de mídia ou .env entre os arquivos não rastreados; varredura dirigida dos arquivos alterados/novos não encontrou o endpoint privado, credencial PostgreSQL, chave privada PEM ou URI TOTP com segredo. Isso é uma verificação dirigida, não substitui um scanner completo de segredos no CI. O e-mail de contato em SECURITY.md foi informado e autorizado pelo mantenedor para divulgação.

Preparação da versão 1.0.2 autorizada pelo mantenedor em 18/11/2026: código, documentação e testes selecionados para commit local. Sem geração de instalador, tag, push, release ou deploy. A versão do cliente, servidor e locks permanece coerente em 1.0.2.
