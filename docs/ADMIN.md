# Administração local — Coffee Desk 1.0.1

Implantação na Render + Neon: consulte [o guia de implantação](DEPLOY-RENDER-NEON.md). Não é necessário gerar instalador para publicar o servidor e o painel.

**Café - Sistemas & Softwares**

O painel administra identidades de dispositivos, denúncias e sanções. Ele não cria contas para os usuários do aplicativo. Nesta entrega, nenhum serviço foi publicado.

## Iniciar com PostgreSQL local

Requisitos: Windows x64 e Node.js 22.12 ou superior. O PostgreSQL incorporado é uma ferramenta de desenvolvimento e teste, não uma configuração de hospedagem.

```powershell
npm.cmd ci
npm.cmd ci --prefix signaling-server
npm.cmd run dev:secure
```

O comando compila o servidor e o painel, inicia PostgreSQL real vinculado a `127.0.0.1` e disponibiliza:

- Painel: `http://localhost:8080/admin/`
- Sinalização: `ws://localhost:8080/ws`
- Saúde do serviço: `http://localhost:8080/health`

Os dados e os segredos locais são gerados em `artifacts/development-server`, fora do Git. Preserve essa pasta para manter o banco e o mesmo segredo de criptografia entre reinícios. Não a envie ao GitHub. Encerre com Ctrl+C para fechar o serviço e o PostgreSQL.

## Criar o primeiro administrador

Não existe usuário ou senha padrão. Com o serviço local iniciado, abra outro terminal PowerShell e execute:

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$adminName = Read-Host 'Nome do administrador (3 a 80 caracteres ASCII)'
$adminPassword = Read-Host 'Senha forte (mínimo 8 caracteres)' -AsSecureString
$adminPlaintext = [System.Net.NetworkCredential]::new('', $adminPassword).Password
@{ username = $adminName; password = $adminPlaintext } |
    ConvertTo-Json -Compress |
    node scripts/create-local-admin.js
Remove-Variable adminPlaintext, adminPassword
```

O comando mostra uma única vez o segredo de cadastro TOTP. Cadastre-o em um autenticador, com códigos de seis dígitos a cada 30 segundos. Faça isso em um terminal privado, sem gravação ou redirecionamento de saída. Guarde sua recuperação e o segredo de criptografia do servidor em local seguro. O bootstrap recusa uma segunda criação: não há cadastro administrativo público nem recuperação de senha por uma rota web.

No painel, entre com usuário, senha e código do autenticador. Um código utilizado não pode ser reutilizado. Um novo login revoga as sessões anteriores do mesmo administrador. As sessões expiram em oito horas por padrão, e o painel permite encerrar a atual ou revogar todas.

## Operações

- **Dispositivos:** pesquise pelo ID, veja presença, último acesso, denúncias, situação e detalhes. As listas são paginadas em até 50 registros.
- **Bloquear:** informe um motivo e a duração. O padrão é 24 horas; o intervalo permitido é de 1 a 8760 horas.
- **Desbloquear / reverter:** remova um bloqueio ou banimento com justificativa. A ação anterior permanece registrada.
- **Banir:** informe o motivo e digite o ID completo para confirmar. Não há vencimento automático.
- **Denúncias:** leia o relato e marque em análise, procedente ou improcedente com justificativa. A análise não aplica sanções automaticamente.
- **Auditoria:** consulte autor, alvo, data e motivo. As sanções também guardam o estado anterior e posterior. Não há operação de exclusão desses registros no painel.

As ações entram em vigor no servidor. Ao suspender um dispositivo conectado, o serviço encerra a chamada dos dois participantes e fecha a sinalização do dispositivo suspenso. Os clientes oficiais interrompem a sessão e pausam a entrada nativa. Após desbloqueio ou vencimento, o usuário pode clicar em **Reconectar** ou reiniciar o aplicativo.

## Cliente 1.0.1

Configure o servidor em **Configurações → Servidor de sinalização**. Fora de loopback, o endereço precisa usar `wss://`. O histórico fica separado pelo endereço do servidor; os registros da versão anterior são preservados, mas não são reutilizados automaticamente.

As denúncias podem ser enviadas nas opções de um dispositivo recente ou na sessão ativa. Elas incluem o remetente autenticado, o alvo, a categoria, a descrição e a referência da sessão ativa quando houver. O limite é de 2.000 caracteres; anexos, gravações e capturas não são enviados.

A primeira conexão ao serviço protegido cria uma nova identidade. A chave privada fica protegida pelo armazenamento do sistema operacional e não é entregue ao renderer. Redefinir preferências não troca essa chave nem remove sanções.

Senhas antigas de acesso não supervisionado são migradas para verificadores `scrypt`. O texto antigo só é removido após o processo principal confirmar a migração. Senhas migradas com menos de 12 caracteres ficam desativadas para acesso automático até serem substituídas. Novas senhas precisam ter pelo menos 12 caracteres.

## PostgreSQL externo ou Docker

Como alternativa ao comando local, `compose.yml` inicia PostgreSQL 17 em loopback. Defina `POSTGRES_PASSWORD` no ambiente antes de executar `docker compose up -d`. Copie `signaling-server/.env.example` para `.env` nessa pasta, preencha os segredos e execute:

```powershell
npm.cmd run build:server
npm.cmd run build:admin
npm.cmd run db:migrate --prefix signaling-server
npm.cmd run admin:create --prefix signaling-server
npm.cmd start --prefix signaling-server
```

O comando `admin:create` também recebe o JSON de usuário e senha pela entrada padrão, como no exemplo anterior. Gere `ADMIN_ENCRYPTION_KEY` com 32 bytes aleatórios, por exemplo `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Nunca use um valor padrão nem registre o segredo em um terminal compartilhado.

Em produção, execute migrações com uma credencial administrativa e rode a aplicação com uma credencial de menor privilégio. O servidor de produção verifica a versão do esquema e não executa DDL na inicialização. Faça backup do banco e do segredo de criptografia; perder o segredo impede a leitura dos cadastros TOTP existentes.

## Antes da hospedagem

A escolha do provedor permanece pendente. Uma publicação futura precisa de TLS, banco persistente, configuração de origem, segredos privados, backup e monitoramento de cotas. Não exponha `dev:secure` à internet.

Em produção, configure `NODE_ENV=production`, `PUBLIC_ORIGIN=https://...` e o cliente com `wss://.../ws`. O serviço HTTP deve ficar atrás de um terminador TLS controlado. Se usar proxy, habilite `TRUST_PROXY` e configure `TRUSTED_PROXY_IPS` com os IPs reais desse proxy; cabeçalhos encaminhados por outras origens são ignorados. PostgreSQL externo exige `sslmode=verify-full`.

`ALLOWED_ORIGINS` é uma lista explícita. Para o aplicativo Electron, inclua `file://`; não use a origem como substituta da autenticação de dispositivo. O painel e a API administrativa devem compartilhar a mesma origem pública. Cookies administrativos de produção usam `Secure`, `HttpOnly`, `SameSite=Strict` e prefixo `__Host-`.

## Verificações

```powershell
npm.cmd run typecheck
npm.cmd run build:server
npm.cmd run build:admin
npm.cmd run build
npm.cmd run audit:security
npm.cmd run test:security
npm.cmd run test:admin
npm.cmd run verify:startup
npm.cmd run verify:redesign
```

Os testes criam bases isoladas em `artifacts` e não usam o banco de desenvolvimento. Consulte `SECURITY-1.0.1.md` para o relatório de segurança e os riscos residuais.
