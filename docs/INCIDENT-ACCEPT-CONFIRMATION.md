# Aceite preso em “Confirmando...” — 13/11/2026

O teste do executável entre duas máquinas falhou nas duas direções. O cliente novo aguarda confirmação autoritativa com papel, permissões e fonte de captura para os dois participantes. O servidor antigo confirma somente para o chamador e não inclui esses campos; o anfitrião permanece esperando e o chamador descarta a mensagem incompleta.

A implementação do servidor já havia sido alterada nos commits locais, mas o envio/deploy permanecia pendente. A sondagem `node scripts/probe-session-protocol.js`, usando a configuração privada, retornou ausência da capacidade no serviço hospedado. A sondagem envia somente `hello`, fecha ao receber o desafio e não autentica nem cadastra identidades. Não imprime endereço, desafio ou chaves.

## Correção preparada

- Servidor anuncia `session-permissions-v1` no desafio e no registro, mantendo a confirmação completa para os dois participantes.
- Cliente verifica a capacidade ao registrar e apresenta erro de servidor desatualizado antes de iniciar chamadas incompatíveis.
- Confirmação com campos ausentes é recusada com diagnóstico explícito, sem habilitar captura/controle por fallback.
- Aceite pendente tem prazo de 12 segundos; a espera é cancelada após confirmação, encerramento ou falha. Falha de autorização nativa também recebe feedback.
- Regressões cobrem registro e aceite antigos, capacidade nova e confirmação com papel correto. Testes de segurança continuam verificando aceite forjado e permissões por participantes.

## Aplicar no ambiente público

1. Confirmar que nenhuma sessão de produção está ativa.
2. Executar `git push origin main` na máquina com autenticação GitHub.
3. Na Render, abrir o serviço e escolher **Manual Deploy → Deploy latest commit**; aguardar estado **Live** e conferir o commit implantado.
4. Reiniciar o aplicativo nas duas máquinas e repetir A→B e B→A. A confirmação completa do servidor é necessária ao executável já gerado com o protocolo novo; a implantação pode corrigir esse executável sem regenerá-lo.
5. Os novos avisos de incompatibilidade/prazo fazem parte do código do cliente e só aparecem em uma nova compilação dele. Não foi gerado outro instalador nesta correção.
6. A sondagem do protocolo deve informar capacidade presente depois do deploy. Manter o deploy automático desativado até coordenar futuras mudanças.

Sem implantar o servidor, a conexão do executável atual continua incompatível. Não atribuir essa espera de aceite a STUN/TURN: a negociação de mídia ainda não começou. Depois do aceite funcionar, eventuais falhas de mídia devem ser diagnosticadas separadamente.