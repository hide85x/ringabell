# Fix DB Timeout Leak Implementation Plan

## Overview

Dwa bugi w warstwie połączenia z MongoDB powodują intermittent Worker hangi i błąd 1101 na produkcji: brak `clearTimeout` po udanym połączeniu kumuluje listenery w izolowanym środowisku V8, a brak `onError` w OAuth handlerze powoduje że Worker wisi zamiast zwrócić redirect na błąd.

## Current State Analysis

- `server/utils/db.ts:37` — `setTimeout` tworzony przy każdym `getDb()`, nigdy nie czyszczony gdy `connect()` się uda → listenery rosną, po 11 warning EventEmitter, Worker niestabilny
- `server/routes/auth/google.get.ts` — brak `onError` w `defineOAuthGoogleEventHandler` → gdy `getDb()` rzuca (timeout/brak połączenia), Nitro nie ma gdzie przekierować błędu → Worker wisi → Cloudflare 1101
- `app/pages/index.vue:8` — `?error=unauthorized` już obsługiwane przez `error-banner`, `?error=server_error` nie ma wariantu tekstowego

## Desired End State

- Logowanie przez Google działa stabilnie bez intermittent 1101
- `wrangler tail` nie pokazuje `EventEmitter memory leak detected`
- Gdy DB jest niedostępne podczas OAuth, user widzi czerwony banner "Błąd serwera" zamiast strony Cloudflare

### Key Discoveries

- `defineOAuthGoogleEventHandler` przyjmuje opcjonalny `onError(event, error)` callback — dokładnie do tego użycia
- `index.vue` ma już `error-banner` CSS i logikę `v-if="error === 'unauthorized'"` — wystarczy dodać `server_error` case
- `clearTimeout` jest standardowym API dostępnym na CF Workers (tak samo jak `setTimeout`)

## What We're NOT Doing

- Nie zmieniamy timeoutów ani ich wartości
- Nie dotykamy `login.post.ts` — credentials flow działa poprawnie przez Nitro error handling
- Nie dodajemy retry logic

## Implementation Approach

Trzy minimalne zmiany: `clearTimeout` w db.ts, `onError` handler w google.get.ts, nowy komunikat w index.vue.

## Phase 1: Fix db.ts — clearTimeout po udanym connect

### Overview

Dodanie `clearTimeout` eliminuje kumulowanie listenerów w tym samym izolowanym V8.

### Changes Required

#### 1. server/utils/db.ts

**File**: `server/utils/db.ts`

**Intent**: Przypisać `timeoutId` do zmiennej i wywołać `clearTimeout(timeoutId)` zarówno po udanym `connect()` jak i w catch bloku — tak żeby żaden `setTimeout` nie pozostawał aktywny po zakończeniu operacji.

**Contract**:
```ts
let timeoutId: ReturnType<typeof setTimeout> | null = null
const connectTimeout = new Promise<never>((_, reject) => {
  timeoutId = setTimeout(() => reject(new Error('MongoDB connect timed out after 4000ms')), 4000)
})
try {
  await Promise.race([_client.connect(), connectTimeout])
  if (timeoutId !== null) clearTimeout(timeoutId)
} catch (e) {
  if (timeoutId !== null) clearTimeout(timeoutId)
  await _client.close().catch(() => {})
  _client = null
  throw e
}
```

### Success Criteria

#### Automated Verification

- TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification

- Po deployu: uruchom `wrangler tail`, zaloguj się kilka razy przez Google, sprawdź że warning `EventEmitter memory leak detected` nie pojawia się w logach

---

## Phase 2: Fix google.get.ts — onError handler

### Overview

Dodanie `onError` zapobiega wiseniu Workera gdy `getDb()` rzuca podczas OAuth callback.

### Changes Required

#### 1. server/routes/auth/google.get.ts

**File**: `server/routes/auth/google.get.ts`

**Intent**: Dodać `onError(event, error)` callback do `defineOAuthGoogleEventHandler` który loguje błąd przez `console.error` i przekierowuje na `/?error=server_error`.

**Contract**:
```ts
export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) { /* bez zmian */ },
  async onError(event, error) {
    console.error('[auth/google] OAuth error:', error)
    return sendRedirect(event, '/?error=server_error')
  },
})
```

#### 2. app/pages/index.vue

**File**: `app/pages/index.vue`

**Intent**: Dodać wariant komunikatu dla `error === 'server_error'` w istniejącym `error-banner` — user widzi "Błąd serwera. Spróbuj ponownie." zamiast pustego banneru.

**Contract**: Rozszerzyć `v-if` na `error-banner` o drugi warunek i dodać odpowiedni tekst dla `server_error`.

### Success Criteria

#### Automated Verification

- TypeScript kompiluje się bez błędów: `npm run build`

#### Manual Verification

- Symulacja: tymczasowo zmień MONGODB_URI na błędny w Cloudflare secrets → zaloguj przez Google → powinieneś zobaczyć red banner "Błąd serwera" zamiast Cloudflare 1101
- Przywróć poprawny MONGODB_URI

---

## References

- Related change: `context/changes/mongo-connection-timeout/plan.md`
- `server/utils/db.ts` — plik z bugiem
- `server/routes/auth/google.get.ts` — plik z brakującym onError

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Fix db.ts — clearTimeout

#### Automated

- [x] 1.1 `npm run build` przechodzi bez błędów TypeScript

#### Manual

- [ ] 1.2 `wrangler tail` nie pokazuje `EventEmitter memory leak` po kilku loginach

### Phase 2: Fix google.get.ts — onError handler

#### Automated

- [ ] 2.1 `npm run build` przechodzi bez błędów TypeScript

#### Manual

- [ ] 2.2 Błędny MONGODB_URI → login przez Google → red banner zamiast 1101
