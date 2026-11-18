# Segurança do Coffee Desk

O Coffee Desk está em beta. Não há garantia de segurança absoluta, disponibilidade contínua ou suporte comercial com SLA. Consulte docs/audit/REMEDIATION-STATUS.md antes de distribuir um pacote. Instaladores anteriores não recebem as correções de código até uma atualização efetivamente instalada.

## Relatar uma vulnerabilidade

Use um canal privado. Se a opção Report a vulnerability estiver disponível na aba Security do repositório sAlly-19/Coffee-Desk, utilize-a. Você também pode enviar o relato para [alissontar18@gmail.com](mailto:alissontar18@gmail.com). Não publique detalhes técnicos da exploração em issues públicas.

Informe versão, ambiente, precondições, passos mínimos reproduzíveis com dados fictícios, impacto e arquivos/locais relevantes. Não envie senhas, chaves, TOTP, tokens, URLs privadas, imagens do seu desktop ou dados de terceiros. Não teste infraestrutura pública ou máquinas de outras pessoas sem autorização específica.

A triagem é feita pelo mantenedor, sem prazo de resposta contratual definido nesta etapa. Divulgação e prazo de correção devem ser coordenados após validar impacto e mitigações. Não publique exploit ou dados pessoais em uma issue pública.

## Estado e limites

A linha 1.0.2 está em validação, sem afirmar que qualquer binário com esse número contém todas as correções da árvore atual. Confira procedência, data e notas de release. Se 1.0.2 já tiver sido publicada, a próxima entrega precisará de nova versão; não substituir silenciosamente um instalador publicado.

Autenticação Ed25519 protege identidade perante o serviço. O servidor é confiado para sinalização; senha de acesso transita por ele em WSS. WebRTC protege mídia/dados entre os peers negociados, sem verificação independente de fingerprint. Banimento vincula chave de dispositivo, não pessoa física. Não há TURN nesta etapa. URL incorporada ao cliente não é um segredo de autenticação.

Hash do helper e validações de download ajudam contra adulteração, mas não substituem assinatura do pacote/publicador. A decisão de Authenticode ou MSIX/Store e os ensaios do pacote novo permanecem pendentes. Consulte o modelo de ameaças e o registro de riscos, que explicitam precondições e limitações.
