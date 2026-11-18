# Publicação do Coffee Desk 1.0.2

Autoria: **Café - Sistemas & Softwares**. Repositório: sAlly-19/Coffee-Desk. Este guia descreve uma etapa futura; as correções da auditoria não geraram instalador, publicaram release, fizeram push ou deploy.

## Antes de empacotar

- Revisar docs/audit/REMEDIATION-STATUS.md. Código/testes aprovados não fecham assinatura digital, validação externa ou requisitos jurídicos.
- Confirmar pacote e locks em 1.0.2, protocolo compatível, diff revisado e árvore de fontes selecionada para commit. Nunca usar git add . sem conferir arquivos pessoais/segredos/capturas.
- Executar lint, typecheck, builds cliente/servidor/painel e regressões. Gate de advisory possui exceção específica de tooling até 02/12/2026 UTC, não exceção para produção ou novos advisories.
- Endereço oficial somente em segredo de build ou .env.client.local ignorado. Nenhum valor deve aparecer em logs, ZIP, screenshots ou documentação. Usuário final não digita URL; o endereço pode ser extraído do binário, não é credencial.
- Guardar enrolamento TOTP e chave administrativa em recuperação privada separada. Estes não participam do pacote do cliente.

## Empacotamento futuro, quando autorizado

Execute npm run package:win. O build gera manifesto SHA-256 do helper no ASAR e distribui somente o helper v2 validado. Configuração prepara fuses para restringir RunAsNode, NODE_OPTIONS, Node inspect e carregamento fora do ASAR, com validação de integridade ASAR. Esses controles precisam ser inspecionados no pacote novo, não são prova de assinatura do publicador.

Depois: npm run verify:package; ensaiar assistente NSIS e atualização entre dois instaladores de teste sem sobrescrever instaladores anteriores. Testar aplicação instalada, bandeja, captura, teclado, clipboard, arquivo, fonte e revogação. Não executar instaladores em produção como teste.

Preparar fonte somente após seleção/revisão no Git: npm run release:source. O script usa arquivos rastreados e conteúdos atuais; arquivos pessoais não rastreados não entram. Executar npm run release:sbom para inventário CycloneDX em artifacts/sbom (cliente inclui ferramentas, não representa exatamente o ASAR). Revisar metadados antes de anexar.

Gerar npm run release:checksums a partir dos artefatos reais da mesma versão. Publicar instalador, latest.yml, blockmap, fonte e SHA256SUMS coerentes; não reutilizar manifesto antigo com executável novo. SBOM pode ser anexo adicional revisado, sem segredos ou caminhos pessoais. Workflow prepara artefatos e não cria automaticamente release pública.

## Autenticidade e atualização

O fallback valida HTTPS/origem/redirect, nome/versão/arquitetura, tamanho e SHA-512; revalida antes de executar. Não baixa/instala ao fechar e bloqueia instalação com chamada ativa ou pendente reconhecida pelo main. Download/instalação em desenvolvimento permanecem desativados.

Instaladores anteriores são NotSigned. Hash e metadados no mesmo repositório não provam autenticidade caso a conta seja comprometida. Assinatura Authenticode ou uma edição MSIX/Store exige decisão e ensaio separados; não foi comprado certificado nem preparada aprovação de Store. Antes de divulgação comercial, concluir essa etapa e validar atualização/rollback reais.

## Deploy e rollback

Servidor/painel exigem build Linux, banco migrado por operador e role de runtime restrita. Coordenar deploy fora de sessão ativa, com backup/restauração ensaiados e compatibilidade confirmada. Mudança de cliente não atualiza automaticamente o serviço hospedado. Limites agregados e métricas novos só entram na hospedagem após deploy autorizado. Não reverter banco/esquema ou apagar dados de produção como parte de rollback de UI.

Nesta implementação o protocolo de sinalização permanece v2. Confirmação de persistência de arquivos foi adicionada ao canal P2P: para confirmação de entrega, ambos aplicativos precisam da versão nova. Peer antigo pode receber bytes, mas o remetente novo informará ausência de confirmação em vez de inventar sucesso.

Se 1.0.2 já tiver sido publicada, escolher uma versão superior antes de empacotar/distribuir estas correções. Não substituir silenciosamente artefatos de versão existente.
