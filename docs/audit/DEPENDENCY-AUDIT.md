Auditoria local — 17/11/2026, commit 26cfb1b, versão 1.0.2, Windows x64. Sem alterações funcionais; não é certificação.

# Dependências e supply chain

npm audit executado em 17/11/2026 sem install/update/fix.

| Escopo | Resultado |
|---|---|
| Raiz completa | 16 pacotes high, ligados a um advisory de picomatch |
| Raiz --omit=dev | Zero reportados |
| Servidor completo | Zero reportados |
| Servidor --omit=dev | Zero reportados |

Instalado picomatch 4.0.7. [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) descreve ReDoS por extglob repetido; consulta oficial mostrava <=4.0.7 afetado e nenhum patch naquele instante. Propagação por fdir/tinyglobby, Vite/plugin React, TypeScript ESLint e node-gyp/rebuild/electron-builder. Não são 16 CVEs distintos ou prova de execução remota no app. CD-11 é médio contextual; upstream alto. Sugestões npm incluíam downgrade de ferramentas: não aplicar automaticamente.

Electron 45.2.3/electron-builder 26.18.0. Audit zero não cobre todas as vulnerabilidades nativas Chromium/Electron nem comportamento malicioso de pacote. React/React DOM/Lucide são devDependencies mas entram no bundle renderer; omit=dev não avalia sozinho todo código incorporado no aplicativo.

Locks fixam versões/integridades; CI usa npm ci. Hosting instala com ignore-scripts e evita baixar Electron. Desenvolvimento executa scripts de instalação usuais: revisar origem/código/scripts antes de dependência nova. PostgreSQL incorporado é ferramenta de testes, não banco instalado no cliente.

Inventário não encontrou SBOM, Dependabot ou CodeQL versionados. Actions por tags v6 e contents:read; configuração privada GitHub não consultada. Gitleaks/Trivy não disponíveis no PATH e não instalados. Scanner limitado de padrões não substitui essas ferramentas. Recomendar SBOM SPDX/CycloneDX por release, licenças, audit contextual/gates com exceções temporárias, SHA revisado para Actions e proteção de conta/branch/release. Nenhuma atualização automática nesta fase.
