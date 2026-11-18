# Coffee Desk 1.0.2

Café - Sistemas & Softwares

## Melhorias

- Instalador com identidade café/cobre e pacote reduzido a idiomas português brasileiro e inglês.
- Refinamentos no painel do anfitrião, seleção de monitores/janelas e controles de clipboard.
- Sinalização autenticada no processo principal e permissões vinculadas à chamada confirmada pelo servidor.
- Captura e abertura de arquivos mais restritas; confirmação nativa antes de abrir tipos permitidos.
- Transferências com cancelamento, limites e confirmação de gravação no computador de destino.
- Correções de concorrência no aceite de chamadas e no acesso por senha.
- Proteções adicionais no helper, CSP, limites do servidor, métricas privadas e testes automatizados.

## Validação e limites

Lint, TypeScript e builds passaram. Validação local incluiu 112 verificações integradas, 81 de segurança e 31 de hospedagem, além das regressões específicas. Relatório: [remediação](audit/REMEDIATION-STATUS.md).

Para confirmação de entrega de arquivos, atualize os dois computadores. O aplicativo continua sem TURN; algumas redes podem impedir conexões P2P. Assinatura digital, novo pacote instalado, atualização real e testes externos continuam pendentes. Há uma exceção temporária de advisory no tooling documentada no relatório; não se aplica às dependências de execução.

Estas notas acompanham a preparação do código. Binários e metadados de atualização deverão ser gerados e validados juntos antes da publicação; não reutilizar latest.yml ou blockmap antigos. Se 1.0.2 já estiver publicada, usar versão superior para distribuir as novas correções.
