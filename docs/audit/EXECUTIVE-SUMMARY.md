Andamento posterior: [remediação aprovada](REMEDIATION-STATUS.md). O texto abaixo preserva a avaliação da base original.

Auditoria local em 17/11/2026. Base 26cfb1baf44571a58353c1af9426fbc1c9b597e8, versão 1.0.2, Windows x64. Sem alterações funcionais; não é certificação.

# Resumo executivo

**Parecer: beta controlado; ainda não recomendado como produto comercial de acesso remoto de alta confiança ou serviço com disponibilidade garantida.** Existem controles reais e testes fortes de servidor; faltam autoridade independente no main, confiabilidade da transferência e distribuição autenticada.

**0 críticos comprovados, 3 altos, 12 médios, 3 baixos e 1 informativo (19).** Altos: CD-01 (concessão de sessão autodeclarada no renderer), CD-02 (abertura arbitrária pela bridge), CD-05 (autenticidade de distribuição/helper). Os dois primeiros pressupõem script na origem legítima; o terceiro, comprometimento da cadeia/escrita local. Não são três cadeias remotas sem autenticação demonstradas.

## Maturidade

| Dimensão | Nota /100 | Motivo |
|---|---:|---|
| Segurança | 58 | Autenticação/protocolo testados, três altos e hardening pendente |
| Arquitetura | 62 | Módulos separados, autoridade no renderer e APIs legadas |
| Qualidade | 60 | TS/lint/regressões; harness administrativo quebrado e advisory em tooling |
| Confiabilidade | 55 | Recuperação/sanções testadas; cancelamento, ACK e cenários externos pendentes |
| Desempenho | 45 | Limites reais; falta medição sustentada e orçamento de recursos |
| **Geral** | **56** | Média aritmética das cinco dimensões |

Rubrica: 0–20 ausente; 21–40 parcial sem evidência; 41–60 controles com lacunas relevantes; 61–80 cobertura consistente e operação parcial; 81–100 evidência sustentada/revisão independente. São julgamentos de maturidade, não percentuais de segurança nem certificação.

## Dez riscos prioritários

1. CD-01: permissões nativas sem prova independente do aceite no main.
2. CD-02: abertura de caminho não recebido pela bridge.
3. CD-05: binário/helper sem assinatura; checksum e manifesto da mesma origem.
4. CD-07: cancelar recebimento não impede gravação (reproduzido).
5. CD-08: sucesso de envio sem ACK de persistência.
6. CD-06/CD-15: fila/erro do helper e revogação em crash/hang.
7. CD-03/CD-04: ausência de CSP desktop e mídia genérica ampla.
8. CD-09: buffers e entradas sem TTL/cota de sessão.
9. CD-14/CD-17: abuso distribuído e capacidade/disponibilidade não medidas.
10. CD-10/CD-11/CD-12: retenção, tooling vulnerável e teste administrativo com erro.

## Evidências

Lint, TypeScript e builds cliente/servidor/painel passaram. Segurança: 78 checks; hospedagem isolada: 31; recuperação: 12; confiabilidade: 43; configuração: 11; histórico: 9; clipboard arquivos: 20; cópia ID/UI: 9; helper banco: 13; sessão UI: 23; atualização UI: 18; ponteiro: 6; mouse virtual: 3. Main e pacote 1.0.2 existente iniciaram. **test:admin falhou** após checks de UI, por caminho de relatório divergente. Contagens não são cobertura percentual nem sessão real entre redes.

npm audit: raiz completa 16 pacotes high ligados ao advisory picomatch; runtime cliente, servidor completo/runtime zero reportados. Nenhuma dependência atualizada. Instalador/helper existentes NotSigned. Nenhum instalador novo gerado/executado.

## Ação recomendada

Priorizar CD-01/CD-02 e testes; corrigir cancelamento/ACK e revogação, depois operação/distribuição. Completar ensaios em redes distintas, hardware, carga e atualização real. [Achados](SECURITY-AUDIT.md), [testes](TEST-COVERAGE-AUDIT.md), [roadmap](REMEDIATION-ROADMAP.md). Sem deploy, push, commit ou alteração funcional nesta auditoria.
