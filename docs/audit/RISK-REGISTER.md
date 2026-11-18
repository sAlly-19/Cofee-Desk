Andamento posterior: [remediação aprovada](REMEDIATION-STATUS.md). O texto abaixo preserva a avaliação da base original.

Auditoria local em 17/11/2026. Base 26cfb1baf44571a58353c1af9426fbc1c9b597e8, versão 1.0.2, Windows x64. Sem alterações funcionais; não é certificação.

# Registro de riscos

Um único registro, sem duplicar achados entre relatórios. Todos abertos; nenhuma correção aplicada.

| ID | Severidade | Risco |
|---|---|---|
| CD-01 | ALTO | Autoridade nativa autodeclarada pelo renderer |
| CD-02 | ALTO | Abertura arbitrária de caminhos pela bridge |
| CD-03 | MÉDIO | Ausência de CSP explícita no renderer desktop |
| CD-04 | MÉDIO | Permissões genéricas de mídia sem origem |
| CD-05 | ALTO | Distribuição/helper sem autenticidade independente do publicador |
| CD-06 | MÉDIO | Fila e erros assíncronos do helper sem controle completo |
| CD-07 | MÉDIO | Cancelar recebimento não impede gravação |
| CD-08 | MÉDIO | Sucesso de envio sem ACK de persistência |
| CD-09 | MÉDIO | Buffers grandes, estados sem TTL e cota de sessão ausente |
| CD-10 | MÉDIO | Retenção e transparência incompletas |
| CD-11 | MÉDIO | Advisory alto em ferramentas de desenvolvimento |
| CD-12 | MÉDIO | Teste administrativo falha no destino do relatório |
| CD-13 | BAIXO | APIs legadas e placeholders ainda expostos |
| CD-14 | MÉDIO | Tentativas de senha sem orçamento agregado por alvo |
| CD-15 | MÉDIO | Autoridade nativa sem lease independente do renderer |
| CD-16 | BAIXO | Runbooks e versão do health desatualizados |
| CD-17 | MÉDIO | Capacidade e operação sem SLO/carga sustentada comprovados |
| CD-18 | BAIXO | Gates de segurança e fixação de Actions incompletos |
| CD-19 | INFORMATIVO | Endpoint embutido não é segredo; identidade não é pessoa |

Total: 19 achados — 0 críticos, 3 altos, 12 médios, 3 baixos e 1 informativo. Impacto, probabilidade, precondições e critérios completos em [SECURITY-AUDIT](SECURITY-AUDIT.md). CD-01/CD-02/CD-07 têm provas isoladas com efeitos simulados; CD-12 falha real do comando; CD-05 inspeção de assinatura e código; CD-11 consulta npm/advisory; demais revisão estática, com condições explícitas.

Altos CD-01/CD-02 exigem script na origem legítima; nenhuma XSS remota foi demonstrada. CD-05 exige comprometimento da distribuição ou escrita local. Não confundir severidade contextual de tooling com execução remota no app.
