---
name: BullMQ Repeat Job Score Encoding
description: Por que delayed repeat jobs mostram timestamps absurdos (ano 233673+) quando lidos via ZRANGEBYSCORE bruto no Redis.
---

## A regra

Nunca interpretar o score bruto de `bull:*:delayed` como timestamp Unix em milissegundos diretamente via Redis CLI ou ioredis ZRANGEBYSCORE. O score parece representar um ano distante (ex: 233673) mas é um encoding interno do BullMQ.

**Por que:** BullMQ armazena o score dos delayed/repeat jobs como `nextRunTs * 2^12 + jobIndex` (aproximadamente — bit-packing para empacotar timestamp + índice interno em um único número). Passar esse valor diretamente para `new Date(score)` produz timestamps no ano 230000+, que parecem overflow mas são apenas a codificação interna sendo mal interpretada.

**Exemplo observado:** job `repeat:sequence-tick:1785118080000` (agendado para Jul 2026, ~01:58 UTC) apareceu com `scheduledAt = +233673-02-06T02:08:00.000Z` na inspeção manual. O ID do job (`1785118080000`) contém o timestamp correto; o score Redis não é um timestamp plano.

**Como aplicar:** Para saber o próximo `scheduledAt` real de um repeat job, usar o sufixo do job ID (que é o `nextRunTs` em ms), não o score do sorted set. Ou usar a API do BullMQ (`queue.getJobSchedulers()`) que decodifica internamente.

## O que NÃO é um bug

O `sequence-scheduler.worker.ts` usa `queue.upsertJobScheduler("sequence-tick", { every: 60_000 }, ...)` — API padrão do BullMQ, sem aritmética de data customizada. Não há overflow no código da aplicação. O job antigo com timestamp "corrompido" na limpeza de Redis era apenas o encoding interno sendo mal lido pelo script de inspeção.
