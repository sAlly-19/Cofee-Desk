Auditoria local — 17/11/2026, commit 26cfb1b, versão 1.0.2, Windows x64. Sem alterações funcionais; não é certificação.

# Desempenho e capacidade

## Configuração não é benchmark

Servidor: defaults 250 conexões, 20/IP, 10 chamadas/min/dispositivo, registros 20/h/IP, denúncias 10/h/dispositivo, mensagens 300/min/dispositivo, payload 64 KiB. Fila: 32 mensagens por conexão, quatro payloads de bytes por conexão, 8 MiB global; saída bufferedAmount 256 KiB. Autenticação 10 s, aceite 30 s. Pool PostgreSQL max 10, conexão/statement timeout 10 s. Limiter tem limpeza e teto 25.000 buckets. Ver config.ts, server.ts e security.ts; não são capacidade comprovada.

Cliente: movimento coalescido por frame no cliente oficial, canal de ponteiro não ordenado sem retransmissão, teclado e arquivos ordenados; captura ideal 1080p/30 FPS e máximo 60. getStats a cada 2 s. Main enumera fontes a cada 2 s e UI/inventário a cada 5 s; medir custo com muitas janelas. Não prometer 60 FPS constante.

## Recursos e estabilidade

CD-06/CD-09/CD-17: recebimento guarda chunks em Map, apesar de comentário streaming. Quatro arquivos máximos somam 128 MiB de payload antes de cópias/strings; RSS real não foi medido. saveToDownloads escreve sincronamente no main. Incompletos não têm TTL. Backup lógico junta tabelas em memória. Fila nativa ignora backpressure; dados recebidos ficam no allowlist até destruir WebContents. Há limites efetivos, mas orçamento final e degradação precisam ser demonstrados.

scrypt limita duas derivações simultâneas no main/servidor; medir custo N=32768,r=8,p=1 no hardware mínimo. Lock consultivo global de registro garante consistência, mas serializa registros inclusive identidades conhecidas: medir reconnect storm. Consultas de sanção por mensagem aumentam pressão no pool. Busca por ID com LIKE e relatório correlacionado deve ser medida com volume, não declarada lenta sem benchmark.

## Ensaio isolado proposto

1. Fixar hardware/runtime/banco de teste e limites; jamais usar endpoint/banco público.
2. Degraus 10/25/50/100 conexões e aumento apenas com margem. Default 250 não comprova suporte.
3. Modelar pares distintos, aceita/recusa/prazo, reconexões e abuso; garantir não misturar sessões/permissões.
4. Consumidor lento, pool lento, entradas inválidas em orçamento, encerramento abrupto e reinício. Parar por RSS/CPU/latência definidos.
5. Registrar p50/p95/p99 de auth/aceite/DB, RSS/heap/GC, event-loop lag, filas WS/stdio, bufferedAmount, pool wait, erros e recuperação após 30/60/300 s.
6. Cliente: quatro arquivos máximos, clipboard 64 MiB, canal pausado, captura 1080p/troca; dados sintéticos.
7. Hibernação e suspensão da hospedagem somente em janela autorizada. Definir SLO beta, RPO/RTO medidos.

Não executados carga sustentada, profiling, teste público, TURN ou múltiplos monitores físicos. Build/funcional não comprovam escala.
