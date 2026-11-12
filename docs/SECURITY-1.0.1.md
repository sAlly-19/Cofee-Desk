# Revisão de segurança — Coffee Desk 1.0.1

Revisão de código, dependências e testes locais realizada em 12/11/2026. Esta revisão não equivale a uma auditoria independente ou a um teste de intrusão do serviço na internet. Nenhuma hospedagem foi criada.

## Problemas encontrados e correções

| Problema da sinalização 1.0.0 | Impacto | Correção |
| --- | --- | --- |
| Um cliente podia escolher um ID já conectado e substituir seu socket | Tomada de identidade | Autenticação Ed25519 com desafio único, audiência e ID atribuído pelo servidor; vínculo persistente entre ID e chave pública |
| Aceite, SDP, ICE e desconexão não exigiam uma chamada válida entre os pares | Sessões forjadas, interferência e encerramento de terceiros | Identificador criptográfico de chamada, autorização por participante e estado, validação do papel e expiração de solicitações |
| JSON era tratado como um tipo TypeScript sem validação em execução | Dados inesperados podiam provocar exceções | Validação dos campos, limites de tipos/tamanhos e tratamento de erros por conexão |
| Não havia proteção suficiente de conexão, mensagens e filas | Abuso de memória, banco e serviço | Limites por IP/dispositivo, filas limitadas em mensagens e bytes, limite global de memória da fila, backpressure e timeouts |
| Sinalização externa usava `ws://` e senhas locais eram persistidas em texto | Exposição de credenciais | WSS obrigatório fora de loopback; migração e verificação de senhas com `scrypt` no processo principal |
| Não havia moderação nem registro de decisões | Sem controle de abuso | Dispositivos suspensíveis, denúncias autenticadas, análise manual e auditoria transacional |

O protocolo protegido é v2. A versão 1.0.0 permanece como instalador para o ambiente legado e não é aceita pelo novo serviço público. Para esse serviço, ambos os computadores precisam usar 1.0.1.

## Identidade e credenciais

- A chave privada Ed25519 é cifrada pelo Electron `safeStorage` no perfil local. Os IPCs de identidade aceitam somente o frame principal e o arquivo do aplicativo, ou a origem local explícita de desenvolvimento.
- A assinatura inclui versão, origem do serviço, nonce e chave pública. O desafio tem prazo, só pode ser usado uma vez e não autentica outra origem.
- IDs usam geração criptográfica e unicidade no PostgreSQL. O ID é público; sua segurança não depende de ser secreto.
- Senhas administrativas e de acesso não supervisionado usam `scrypt` com salt aleatório, N=32768, r=8, p=1 e comparação constante. A derivação concorrente é limitada.
- TOTP usa códigos de seis dígitos, intervalo de 30 segundos e janela de um intervalo para cada lado. O contador de códigos usados é atualizado atomicamente para impedir replay. O segredo fica cifrado com AES-256-GCM no banco.
- Sessões e tokens CSRF são persistidos como hashes. O painel não oferece cadastro público de administradores. O primeiro administrador é criado localmente, sem credenciais padrão.

## Autorizações e moderação

O servidor mantém chamadas pendentes e ativas em memória, sempre entre dois dispositivos autenticados. Somente o destinatário pode aceitar ou recusar uma solicitação pendente. A oferta parte do host e a resposta do cliente. Desconexão e candidatos ICE precisam pertencer à chamada autorizada.

Sanções, denúncias e auditoria são persistidas em PostgreSQL. A aplicação usa consultas parametrizadas e transações para decisões administrativas. Os registros de auditoria têm proteção contra alteração e exclusão por comandos SQL comuns, além de não existir uma rota para isso no painel. Um operador com privilégios de proprietário do banco continua sendo uma autoridade confiável; o banco não é um livro-razão inviolável.

Uma denúncia não bloqueia ninguém automaticamente. O remetente vem da conexão autenticada, e uma referência de sessão ativa só é aceita quando denunciante e denunciado participam dela. Conteúdo e anexos do desktop não são coletados.

## Limites padrão

| Controle | Padrão |
| --- | --- |
| Conexões WebSocket simultâneas | 250, até 20 por IP |
| Dispositivos cadastrados | 10.000 |
| Mensagens | 300/minuto por dispositivo, com limite agregado por IP |
| Payload WebSocket | 64 KiB |
| Fila de entrada | Até 32 mensagens e quatro payloads por conexão; 8 MiB no total |
| Buffer de saída | 256 KiB por conexão antes de encerramento |
| Cadastro de novos dispositivos | 20/hora por IP |
| Chamadas | 10/minuto por dispositivo, com limite agregado por IP |
| Tentativas com senha | 5/15 minutos por alvo e dispositivo/IP |
| Denúncias | 10/hora por dispositivo, com limite agregado por IP |
| Login administrativo | 10/15 minutos por IP e nome; 30/minuto globalmente |
| Autenticação de dispositivo | 10 segundos |
| Solicitação de chamada | 30 segundos |
| Sessão administrativa | 8 horas |

Os limites podem ser ajustados por variáveis de ambiente documentadas no código de configuração. Endereços encaminhados por proxy só são utilizados quando o proxy foi explicitamente configurado. Logs operacionais não recebem senhas, chaves privadas, tokens, SDP ou texto de denúncias.

## Dependências

Foi removido `uuid`, não utilizado pelo servidor e afetado por GHSA-w5hq-g745-h8pq. As ferramentas Vite, esbuild e electron-builder foram atualizadas; versões vulneráveis do minimatch foram substituídas preservando as versões antigas não afetadas que possuem outra API.

Execute `npm run audit:security` para obter o estado atual. O comando grava relatórios UTF-8 em `artifacts/security-audit`, separados entre cliente completo, servidor completo e servidor em execução. Ausência de avisos do npm não prova ausência de vulnerabilidades desconhecidas.

## Evidências reproduzíveis

Resultado local de 12/11/2026: TypeScript e builds do cliente, servidor e painel aprovados; 70 verificações de segurança, 21 verificações de navegador administrativo e 57 verificações funcionais aprovadas. A confirmação adicional do driver verificou persistência das decisões e notificação ao participante. Não houve mensagens de erro do renderer na regressão funcional. Inicialização pelo entrypoint principal e teste do executável empacotado 1.0.1 também passaram, incluindo preload, assinatura visual e helper Win32.

As três auditorias npm (cliente completo, servidor completo e servidor em execução) retornaram zero vulnerabilidades conhecidas. O lint permanece indisponível porque o repositório não possui configuração ESLint; essa condição já existia antes da mudança. O build emite aviso de compatibilidade futura do carregamento das configurações Vite, sem impedir a compilação. O executável não possui certificado de assinatura de código Authenticode; a assinatura “Café - Sistemas & Softwares” identifica visualmente o produto.

Capturas reais estão em `artifacts/admin-browser` e `artifacts/redesign`; relatórios de testes e auditoria em `artifacts/security-live/validation.json`, `artifacts/admin-browser/browser.json`, `artifacts/redesign/validation.json` e `artifacts/security-audit`. Os perfis e bancos de teste contêm identidades descartáveis e não entram no arquivo-fonte distribuído.

- `npm run test:security`: autenticação, replay, mensagens forjadas, consentimento, expiração, limites, login/TOTP, CSRF, sessões, sanções, auditoria e persistência com PostgreSQL real.
- `npm run test:admin`: navegador com API real, denúncia pelo aplicativo, decisões pelo painel, revogação de uma sessão oficial, pausa da entrada nativa, navegação por teclado e layout em três larguras.
- `npm run verify:redesign`: regressão funcional do cliente, com identidades separadas, vídeo WebRTC, arquivos, transporte de teclado, senhas, histórico e janela.
- `npm run verify:startup` e `npm run verify:package`: entrada principal e executável empacotado, respectivamente.

Os testes e suas credenciais são isolados dos dados do operador, dentro de `artifacts`. Nenhuma credencial de teste é uma conta padrão da aplicação.

## Riscos residuais e operação

- Banir uma identidade não identifica uma pessoa nem impede criar outra chave, apagar os dados locais ou utilizar outro computador. Não há fingerprint físico ou conta pessoal nesta versão.
- A sinalização revoga autorizações e os clientes oficiais encerram a sessão. O servidor não consegue interromper fisicamente um fluxo P2P que clientes adulterados decidam manter.
- O serviço de sinalização continua sendo parte confiável do sistema. A senha informada para acesso é encaminhada transitoriamente ao destino por WSS e pode ser vista pelo processo do servidor; não é criptografia ponta a ponta da sinalização. Mídia WebRTC usa sua proteção de transporte própria.
- TLS público, certificado, configuração de proxy, backups, cotas e disponibilidade só poderão ser verificados depois da escolha do provedor. Não há garantia de resistência a DDoS volumétrico ou a botnets distribuídas.
- Limites por IP podem atingir usuários legítimos atrás do mesmo NAT. A capacidade deve ser monitorada antes de ampliar o acesso público. Auditoria e denúncias exigem espaço persistente e política operacional de retenção/backup.
- Uma pessoa com acesso ao usuário do sistema operacional pode executar o aplicativo e usar sua identidade. A proteção local não substitui a segurança do Windows nem impede um sistema já comprometido.
- Os testes desta entrega são locais. O teste entre máquinas da versão 1.0.0 foi confirmado anteriormente pelo responsável; o novo protocolo precisa de nova validação entre máquinas e redes distintas antes da abertura pública.
