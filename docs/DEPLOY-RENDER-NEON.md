# Implantação — Render Free + Neon Free

Café - Sistemas & Softwares

## Situação desta preparação

Servidor e painel já foram implantados na Render com PostgreSQL na Neon. HTTPS, banco, painel e desafio WSS passaram na verificação pública. O responsável confirmou login com TOTP e teste de bloqueio/desbloqueio. O endereço real fica somente na configuração local ignorada e não será incluído neste documento. Nenhum instalador novo será gerado nesta etapa.

## 1. Contas, repositório e região

Crie as contas em https://dashboard.render.com/ e https://console.neon.tech/. Ative MFA e guarde os códigos de recuperação fora do repositório. Autorize a Render no GitHub somente para `sAlly-19/Cofee-Desk`. Use planos gratuitos e não habilite recursos pagos.

O Blueprint usa Render `virginia`. Crie um projeto Neon novo na AWS US East (N. Virginia), sem restaurar perfis ou bancos de teste. Se a região gratuita não estiver disponível em uma das contas, interrompa e escolha regiões próximas em ambos antes de criar dados reais.

O código precisa estar disponível na branch escolhida no GitHub antes de importar o Blueprint. Push comum executa validações, sem empacotar instalador e sem implantação automática. Tags de versão e acionamento manual do fluxo Windows continuam permitindo empacotamento explícito.

## 2. Banco e credenciais locais

Instale dependências e compile:

```powershell
npm.cmd ci
npm.cmd ci --prefix signaling-server
npm.cmd run build:server
```

Na Neon, obtenha a conexão **direta**, desmarcando pooling. Mude somente `sslmode=require` para `sslmode=verify-full`, preservando a senha codificada e os demais parâmetros. A URL deve usar o hostname direto `*.neon.tech`, sem `-pooler`.

Não cole a URL como argumento de linha de comando. No PowerShell:

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$dbSecret = Read-Host 'Conexão direta Neon com sslmode=verify-full' -AsSecureString
$dbPlaintext = [System.Net.NetworkCredential]::new('', $dbSecret).Password
@{ databaseUrl = $dbPlaintext } | ConvertTo-Json -Compress | node scripts/prepare-production.js
Remove-Variable dbPlaintext, dbSecret
```

O comando aplica migrações e cria `coffee_runtime` com uma senha aleatória. A aplicação pode inserir/atualizar dispositivos, denúncias, sessões e decisões; não pode criar tabelas, alterar migrações, inserir administradores ou apagar auditoria. A conta de migração permanece separada.

São gravados somente em `artifacts/hosting`, ignorado pelo Git:

- `.env.operator`: conexão proprietária direta e chave administrativa; uso exclusivo do operador.
- `.env.render`: conexão `coffee_runtime` e a mesma chave administrativa; estes dois valores serão cadastrados nos segredos da Render.
- `setup.json`: resultado sem senhas.

Se houver falha após a criação da pasta, preserve-a: ela contém dados de recuperação. Não apague a pasta nem execute novamente para tentar contornar uma falha. Verifique o estado do papel no banco antes de qualquer rotação. Não publique nem envie esses arquivos. No Windows, restrinja o acesso da pasta à sua conta nas propriedades de segurança; não a coloque em diretório compartilhado.

## 3. Primeiro administrador

Faça o bootstrap local, sem credenciais padrão e sem endpoint público:

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$adminName = Read-Host 'Nome do administrador'
$adminPassword = Read-Host 'Senha forte (mínimo 8 caracteres)' -AsSecureString
$adminPlaintext = [System.Net.NetworkCredential]::new('', $adminPassword).Password
@{ username = $adminName; password = $adminPlaintext } |
    ConvertTo-Json -Compress |
    node --env-file=artifacts/hosting/.env.operator signaling-server/dist/bootstrap-admin.js
Remove-Variable adminPlaintext, adminPassword
```

Cadastre o segredo TOTP que aparece uma única vez em um autenticador. Não grave a saída nem compartilhe o terminal. O comando recusa criar um segundo administrador. O valor temporário `PUBLIC_ORIGIN=https://deployment-pending.invalid` do arquivo local serve apenas à validação de configuração do bootstrap: ele não é um endereço de serviço e não será distribuído ao aplicativo.

## 4. Serviço Render

Importe `render.yaml` como Blueprint, usando o repositório e a branch revisada. A configuração usa um serviço Node Free, uma instância, domínio `onrender.com`, build `npm run build:hosting`, start `npm start --prefix signaling-server` e health check `/health`.

Informe em **Environment**, sem colocar valores no YAML:

- `DATABASE_URL`: somente a conexão `coffee_runtime` de `.env.render`.
- `ADMIN_ENCRYPTION_KEY`: chave de `.env.render`; nunca gere outra a cada deploy.

`PUBLIC_ORIGIN` é obtido automaticamente de `RENDER_EXTERNAL_URL`, fornecido pela plataforma. Não configure uma URL provisória nem adivinhe um hostname. `PORT` é fornecida pela Render. `HOST=0.0.0.0`, `NODE_ENV=production`, `TRUST_PROXY=true`, `PROXY_PROVIDER=render` e `ALLOWED_ORIGINS=file://,null` estão no Blueprint. O painel usa a API na mesma origem; não há CORS público.

A política de proxy exige ambiente Render e URL pública correspondente, Host correto, cabeçalho HTTPS único e cadeia de IPs válida. Remove da direita apenas proxies conhecidos (redes internas e faixas Cloudflare versionadas), sem aceitar `*` ou `0.0.0.0/0`. As faixas são uma lista operacional que precisa ser revisada se a infraestrutura mudar. `/health` é uma exceção de leitura que permite a checagem HTTP interna da plataforma; não informa dispositivos, segredos ou diagnóstico de rede.

Não aumente para várias instâncias: presença, chamadas e limites são coordenados na memória de uma instância. Reinício/deploy desconecta clientes e encerra chamadas; o cliente reconecta e conserva a identidade no PostgreSQL. Isso não fornece continuidade de uma chamada entre deploys.

## 5. Verificação do serviço hospedado

Depois do primeiro deploy, copie a URL **real** exibida pela Render e execute:

```powershell
npm.cmd run hosting:probe -- https://ENDERECO-REAL.onrender.com
```

O probe verifica HTTPS, banco, painel, CSP/HSTS, API restrita e desafio WSS com audiência correta. Não registra identidades, denúncias ou sanções fictícias. O resultado fica em `artifacts/hosting/public-probe.json`. Um primeiro acesso após suspensão pode levar cerca de um minuto; não use pings periódicos para evitar suspensão.

Validação manual antes da divulgação:

1. Login com senha/TOTP; cookie `__Host-coffee_admin`, HttpOnly, Secure e SameSite=Strict; falha de CSRF em POST sem token; logout e revogação.
2. Após login, consultar `/api/admin/network` pela mesma origem. Comparar o IP efetivo com o IP público conhecido da rede. Repetir com requisições que incluam X-Forwarded-For/X-Forwarded-Proto forjados: o proxy não pode permitir escolher IP ou contornar HTTPS. Essa rota exige sessão e não revela credenciais.
3. Conectar duas máquinas por WSS e testar vídeo, mouse/teclado, clipboard, arquivo, chamada cancelada/recusada/aceita e encerramento por sanção. Confirmar que outro dispositivo permanece conectado.
4. Reiniciar e implantar novamente; confirmar identidade, denúncias, decisões e sanções persistidas. Aguardar suspensão natural sem clientes e testar o despertar/reconexão.
5. Revisar logs e métricas sem registrar tokens, senhas, SDP, conteúdo de denúncias ou chaves. Guardar somente evidências sanitizadas.

Falha nesses testes mantém a entrega como **não liberada**. Acesso P2P entre redes pode exigir TURN; esse serviço e seus custos não estão incluídos.

## 6. Serviço oficial no aplicativo, sem URL manual

Somente depois de validar o endereço:

```powershell
npm.cmd run hosting:configure-client -- https://ENDERECO-REAL.onrender.com
```

O comando repete o probe e grava o endereço somente em `.env.client.local`, ignorado pelo Git. Não altera arquivos rastreados, a versão ou o instalador. O build injeta o endereço apenas em `dist-electron/shared/publicService.js`, também ignorado, para que uma instalação nova conecte automaticamente.

Preferências novas registram se a seleção foi automática ou explícita. Endpoints explicitamente configurados são preservados. Arquivos 1.0.1 antigos não registravam essa informação: conservamos seu endereço e oferecemos **Usar serviço oficial do Coffee Desk** nas configurações, sem digitação. Identidades e histórico continuam separados por servidor. Redefinir preferências não apaga chaves nem sanções. Mudar a URL encerra a sessão atual.

## 7. Operação, recuperação e custos

- Monitore cotas de computação, armazenamento e transferência nos painéis Render/Neon. A modalidade Free é beta e não promete disponibilidade contínua. A Render pode suspender a instância ociosa; a Neon também possui limites e suspensão de computação.
- Preserve a chave administrativa em backup criptografado, separado do banco e do repositório. Perdê-la impede recuperar os segredos TOTP existentes. Guarde também a recuperação do autenticador.
- Antes de migrações futuras, exporte o banco por `pg_dump` compatível com a versão do PostgreSQL do projeto Neon, usando conexão direta e `sslmode=verify-full`; forneça senha por prompt/arquivo pgpass restrito, nunca por argumento ou histórico. Use formato custom (`-Fc`), guarde o arquivo criptografado e teste `pg_restore` em um banco isolado. Nunca teste restauração sobre produção.
- Para atualizar esquema, execute o comando de migração com `.env.operator`; nunca adicione a credencial proprietária aos segredos da Render.
- Para rotacionar senha de `coffee_runtime`, use uma sessão administrativa privada/gerenciador de segredos, altere a senha e o segredo da Render e faça deploy coordenado. Não rode novamente o provisionamento inicial para rotação.
- Rollback do serviço usa o commit anterior compatível com o esquema atual. Não execute downgrade automático de banco. A chave administrativa precisa permanecer igual.
- Para interromper abuso, aplique sanções pelo painel ou suspenda o serviço na Render. Banimento controla a identidade, não uma pessoa ou hardware permanente. Clientes adulterados podem manter P2P independentemente da sinalização.

Referências oficiais: [Render Blueprint](https://render.com/docs/blueprint-spec), [Render Free](https://render.com/docs/free), [Render e IP do cliente](https://render.com/articles/how-render-handles-ddos-attacks), [Neon](https://neon.com/pricing), [faixas Cloudflare IPv4](https://www.cloudflare.com/ips-v4) e [IPv6](https://www.cloudflare.com/ips-v6).
## Resultado da preparação local — 12/11/2026

- TypeScript e builds do cliente, servidor e painel: aprovados.
- Integração de hospedagem com PostgreSQL real: 31 verificações aprovadas.
- Segurança: 70 verificações aprovadas.
- Painel no navegador real: 21 verificações aprovadas, mais confirmação de persistência pelo driver.
- Cliente com WebRTC real entre instâncias locais: 57 verificações aprovadas, sem mensagens de erro do renderer.
- Inicialização pelo entrypoint principal, IPC e helper nativo: aprovada.
- Build limpo isolado em Windows: servidor e painel compilados com scripts de instalação desativados; Electron não foi baixado. Inclui CSS e fontes compartilhadas.
- Sintaxe do Blueprint, tipos dos valores de ambiente e sintaxe dos workflows: aprovados.
- Validação Linux: workflow Ubuntu preparado, ainda não executado neste ambiente Windows; Docker/WSL não estão disponíveis.

A regressão revelou uma corrida no fallback de exibição da janela, que podia reabrir uma janela recém-minimizada. O fallback agora respeita a minimização; a regressão e a inicialização passaram após a correção. O lint continua sem configuração, conforme limitação anterior; o build Vite mantém aviso de compatibilidade futura das configurações CommonJS.

Evidências locais ficam em `artifacts/hosting-tests/validation.json`, `artifacts/hosting-build-check/build-result.json`, `artifacts/security-live/validation.json`, `artifacts/admin-browser/browser.json` e `artifacts/redesign/validation.json`. Esses diretórios não entram no Git.

**Atualização após implantação:** contas, banco, serviço e administrador já estão configurados. O responsável confirmou conexão do cliente e bloqueio/desbloqueio. Permanecem pendentes a validação completa entre redes distintas e os cenários de reinício/suspensão no provedor. Nenhum instalador novo foi gerado.

## Endereço do cliente fora do GitHub

A configuração de distribuição fica em `.env.client.local`, fora do controle de versão. O campo `COFFEE_OFFICIAL_SIGNALING_URL` também pode ser fornecido como segredo do GitHub Actions com o mesmo nome. A variável de ambiente tem precedência sobre o arquivo local. Não coloque valores reais em exemplos, YAML ou arquivos TypeScript.

`npm run build:electron` incorpora a configuração somente no JavaScript compilado do processo principal. Os comandos de empacotamento recusam gerar uma distribuição sem serviço oficial configurado. O endereço não é impresso pelos scripts de build. Builds de desenvolvimento sem configuração usam sinalização local; os testes Electron forçam o ambiente local para não cadastrar dispositivos fictícios em produção.

A URL pode ser descoberta no aplicativo distribuído e no tráfego de rede. Mantê-la fora do repositório evita exposição no código publicado, mas não é um controle de autenticação. Chaves Ed25519, chamadas autorizadas, limites e moderação continuam necessários. Não reescrevemos o histórico Git: o endereço real não foi inserido no código rastreado. Binários distribuídos por releases podem conter o endereço incorporado.


### Verificações da conexão automática

Foram aprovadas 11 verificações de configuração privada (precedência, validação, logs, exclusão pelo Git e bloqueio de pacote sem configuração) e 6 verificações do IPC nativo em um perfil Electron novo, sem conexão ao serviço público. A regressão funcional usa servidor local explicitamente e não depende da configuração de distribuição. Para desenvolvimento nesta máquina, `npm run electron:dev` recompila o main e aplica o arquivo local automaticamente.
