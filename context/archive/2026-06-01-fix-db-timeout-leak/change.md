---
change_id: fix-db-timeout-leak
title: Fix db timeout leak
status: archived
created: 2026-06-01
updated: 2026-06-15
archived_at: 2026-06-15T19:34:19Z
---

## Notes

Zmiana zdezaktualizowana — migracja MongoDB → Cloudflare D1 (mongodb-to-d1) usunęła źródło problemu. `db.ts` nie używa już `setTimeout` ani MongoDB clienta, więc `clearTimeout` i `EventEmitter memory leak` nie dotyczą obecnej implementacji. Brak `onError` w `google.get.ts` to osobna kwestia — otworzyć jako nową zmianę jeśli potrzebna.
