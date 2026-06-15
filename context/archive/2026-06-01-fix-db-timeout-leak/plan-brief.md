# Fix DB Timeout Leak — Plan Brief

> Full plan: `context/changes/fix-db-timeout-leak/plan.md`

## What & Why

Dwa bugi powodują intermittent Error 1101 na produkcji. `setTimeout` w `db.ts` nie jest czyszczony po udanym połączeniu — listenery kumulują się w V8 isolate. Brak `onError` w OAuth handlerze powoduje że Worker wisi zamiast obsłużyć błąd.

## Starting Point

`server/utils/db.ts` ma `Promise.race` z `setTimeout` bez `clearTimeout`. `server/routes/auth/google.get.ts` nie ma `onError` callbacku.

## Desired End State

Logowanie przez Google działa stabilnie. `wrangler tail` nie pokazuje `EventEmitter memory leak`. Gdy DB jest niedostępne, user widzi czerwony banner zamiast Cloudflare error page.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Scope | Oba pliki (db.ts + google.get.ts) | Oba są źródłem błędu — fix tylko jednego nie eliminuje problemu | Plan |
| Error UX | Redirect `/?error=server_error` | User widzi czytelny komunikat zamiast Cloudflare 1101 | Plan |
| Logging | `console.error` przed redirectem | Błąd widoczny w `wrangler tail` | Plan |

## Scope

**In scope:** `clearTimeout` w db.ts, `onError` w google.get.ts, nowy komunikat w index.vue

**Out of scope:** zmiana timeoutów, retry logic, credentials flow (login.post.ts działa)

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. clearTimeout | Eliminuje kumulowanie listenerów | Brak |
| 2. onError handler | Worker nie wisi przy błędzie DB | Brak |

**Prerequisites:** brak
**Estimated effort:** ~1 sesja, 3 pliki

## Success Criteria

- `wrangler tail` nie pokazuje `EventEmitter memory leak` po kilku loginach
- Błędny MONGODB_URI → login przez Google → red banner zamiast 1101
- `npm run build` przechodzi po każdej fazie
