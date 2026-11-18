> Andamento posterior à aprovação de 18/11/2026: [correções, resultados e pendências](REMEDIATION-STATUS.md). O texto abaixo preserva o plano e as condições da auditoria original.

Auditoria local — 17/11/2026, commit 26cfb1b, versão 1.0.2, Windows x64. Sem alterações funcionais; não é certificação.

# Plano de correção

Nenhuma correção aplicada. Dias úteis são estimativas de engenharia com familiaridade no projeto, não compromisso de prazo; revisão, decisões e infraestrutura podem ampliar esforço. P0 antes de ampliar distribuição; P1 antes de uso comercial; P2 manutenção planejada.

| Fase | Correção | Prioridade | Esforço | Dependências | Aceite |
|---|---|---|---|---|---|
| 1 — Críticas | Nenhum crítico comprovado. Priorizar CD-01/CD-02 pela capacidade nativa | P0 | 4–8 dias | Contrato de sessão e regressões IPC | P1/P2 da auditoria falham fechadas; aceite real funciona |
| 2 — Segurança | CD-03/CD-04/CD-14; autenticidade CD-05 | P0/P1 | 3–7 dias + processo de assinatura | Fase 1 e decisão de canal/conta | CSP/origem/mídia mínima; teto distribuído; artefatos adulterados negados |
| 3 — Estabilidade | CD-06/CD-07/CD-08/CD-09/CD-15: filas, helper, cancelamento, ACK, TTL/streaming/lease | P1 | 6–12 dias | Autoridade e contrato peer | Zero gravação após cancelar, ACK de entrega, memória limitada, crash revoga |
| 4 — Arquitetura | CD-13: contratos ativos, estado único e descontinuação de placeholders | P2 | 3–6 dias | Regressões de sessão | Toda bridge tem consumidor/handler/teste; estados sem duplicação |
| 5 — Qualidade | CD-11/CD-12/CD-17/CD-18: tooling, harness, carga/métricas e CI | P1/P2 | 4–8 dias | Ambiente isolado e fases anteriores | Gates confiáveis, relatório admin zero, curvas medidas e falhas recuperadas |
| 6 — Documentação/publicação | CD-10/CD-16 e concluir CD-05: privacidade, runbook, assinatura/artefatos | P1 | 2–5 dias + jurídico/provedor | Decisões de produto, alto mitigado e validação | Docs reproduzíveis, backup restaurado, release e upgrade reais ensaiados |

## Ordem incremental

1. Corrigir harness admin e transformar P1/P2/P3 em regressões antes de corrigir cada fluxo.
2. Restringir abertura de arquivos; mover prova da sessão/autorização para main com contrato pequeno e revisável.
3. Cancelamento/ACK e cleanup de ambos os lados. Testar perda/revogação durante cada await e mensagens atrasadas/duplicadas.
4. CSP/permissão mínima, orçamento nativo, lease e abuso agregado; não ampliar permissões para satisfazer teste.
5. Carga/recuperação e testes reais de fonte/DPI, redes distintas, suspensão/despertar. Sem dados reais ou testes destrutivos públicos.
6. Tratar autenticidade e processo de release; ensaiar atualização entre dois instaladores. Somente depois divulgar prontidão.

## Fronteiras de autorização da próxima fase

Relatórios não autorizam reescrever o aplicativo, remover recursos, trocar dependências ou publicar automaticamente. Corrigir mediante escopo aprovado. Operações sobre produção/contas, reescrita do histórico Git e assinatura paga exigem decisões específicas. Nesta execução só docs/audit foi acrescentada; saídas locais ignoradas dos testes não entram em release nem no Git.
