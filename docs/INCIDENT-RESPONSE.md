# Resposta a incidentes — roteiro operacional

Estado: roteiro técnico proposto para aprovação operacional. Contato, responsáveis, SLA, obrigações de notificação e política de retenção precisam ser definidos pelo operador com assessor jurídico. Não é parecer de conformidade.

1. **Detectar e delimitar.** Anotar versão/hash do artefato, janela temporal, componente e sintomas. Não coletar indiscriminadamente tela, clipboard ou arquivos do usuário. Preservar logs sanitizados em acesso restrito.
2. **Conter.** Em abuso de identidade, aplicar sanção administrativa com justificativa e confirmar revogação nos dois clientes oficiais. Se houver suspeita de release adulterada, suspender divulgação/atualização desse artefato e revisar permissões do GitHub. Não apagar evidências nem executar teste ofensivo em produção.
3. **Avaliar alcance.** Separar servidor, conta/release, banco, cliente e helper. Um ID não é pessoa física; clientes adulterados podem manter P2P fora do controle do serviço. Históricos locais não são auditoria inviolável.
4. **Tratar segredos.** Se houver exposição comprovada, revogar credenciais/sessões e coordenar rotação de DATABASE_URL e ADMIN_ENCRYPTION_KEY com procedimento que preserve TOTP. Guardar recuperação fora de logs/Git/chat. Não trocar chave de cifragem sem migrar os valores existentes.
5. **Recuperar.** Usar backup lógico cifrado e chave administrativa separada; restaurar primeiro em banco novo e isolado. Não executar restore sobre produção existente. Ensaiar identidades, sanções, denúncias, auditoria, login/TOTP e revogação de sessões restauradas.
6. **Validar.** Reexecutar regressões da fronteira afetada, verificar integridade de pacote/helper e compatibilidade. Deploy exige janela coordenada e atenção a sessões ativas. Não reverter esquema ou excluir dados automaticamente junto com um rollback de UI.
7. **Comunicar.** Elaborar comunicação factual sem dados pessoais/segredos; responsáveis e prazos legais devem ser confirmados juridicamente. Registrar decisões e riscos residuais.
8. **Aprender.** Documentar causa raiz, evidências, alterações, testes e ações preventivas com dono e prazo. Manter advisory/contato privado até divulgação coordenada.

GET /api/admin/metrics fornece indicadores operacionais autenticados, não grava conteúdo de sessão. Monitore cotas/erros pelos provedores, sem pings para contornar suspensão. Definir e medir RPO/RTO de produção; teste local de restauração não comprova recuperação da infraestrutura hospedada.
