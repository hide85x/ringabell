# mongo-connection-timeout Implementation Plan

## Overview

`serverSelectionTimeoutMS` w opcjach MongoClient nie przerywa wiszącej operacji sieciowej na V8 isolates — Worker dostaje error 1101 ("hung and would never generate a response") zamiast rzucić normalny timeout error. Fix: opakować `_client.connect()` oraz `db.command({ ping: 1 })` w `Promise.race` z manualnym 4000ms timeoutem opartym na `setTimeout` (natywne Workers API, niezawodne na V8).

## Current State Analysis

- `server/utils/db.ts:23` — `await _client.connect()` wisi jeśli Atlas nie odpowiada; `serverSelectionTimeoutMS: 5000` nie przerywa tej operacji na V8 isolates.
- `server/routes/healthz.get.ts:8` — `await db.command({ ping: 1 })` też może wisieć jeśli Atlas stanie się niedostępny po nawiązaniu połączenia; `socketTimeoutMS` może nie działać niezawodnie na V8.
- Singleton pattern (`_client`, `_db`) — gdy `connect()` rzuci wyjątek, `_db` zostaje null, `_client` dostaje nową wartość przy następnym wywołaniu. ALE: gdy ping failuje na warm isolate (stale connection), `_db` i `_client` są non-null — early return `if (_db && _client) return _db` zwraca martwą konekcję na każde kolejne wywołanie. Reset cache jest wymagany po ping failure.
- Race condition w `getDb()` — gdy `clearDbCache()` zeruje `_db`/`_client`, a wiele requestów trafia równocześnie, każdy widzi `_db === null` i startuje własnego `MongoClient`. Efekt: wiele instancji klienta, EventEmitter memory leak ("11 timeout listeners"), intermittent 503. Fix: `_connecting: Promise<Db> | null` guard — kolejne wywołania czekają na ten sam in-flight connect zamiast startować nowy.

## Desired End State

- `GET /healthz` zawsze odpowiada w maksymalnie ~4.1s — albo `{status: ok, db: connected}`, albo `{status: error, db: disconnected, error: "...timed out..."}` ze status 503.
- Worker nigdy nie dostaje error 1101 z powodu MongoDB.
- Po ping failure na warm isolate — następny request tworzy świeże połączenie zamiast zwracać stale cached db.

### Key Discoveries

- `server/utils/db.ts:16-22` — MongoClient options — tu dodajemy `connectTimeoutMS` i `socketTimeoutMS`
- `server/utils/db.ts:23` — `await _client.connect()` — tu dodajemy Promise.race
- `server/routes/healthz.get.ts:8` — `await db.command({ ping: 1 })` — tu dodajemy Promise.race
- `setTimeout` jest natywnym Workers API (nie Node.js polyfill) — niezawodnie działa na V8 isolates

## What We're NOT Doing

- Nie dotykamy modeli (`server/models/`) — nie mają własnych wywołań connect
- Nie dodajemy retry logic — timeout rzuca, `catch` w healthz zwraca 503; retry to przyszły slice
- Nie zmieniamy innych route handlers — tylko healthz używa `db.command` bezpośrednio
- Nie zmieniamy wartości `serverSelectionTimeoutMS` ani `maxPoolSize` — zostają jako belt-and-suspenders

## Critical Implementation Details

`Promise.race` z `setTimeout` jest wzorcem Workers-safe: `setTimeout` jest natywnym globalem dostępnym w V8 isolates bez polegania na `nodejs_compat`. Callback setTimeout musi odrzucać (reject) — nie rozwiązywać — żeby `Promise.race` propagował wyjątek do bloku catch.

---

## Phase 1: Add Promise.race timeout to connect and ping

### Overview

Dwie chirurgiczne zmiany: MongoClient dostaje `connectTimeoutMS` + `socketTimeoutMS` jako belt-and-suspenders, `connect()` i `db.command({ ping: 1 })` są opakowane w `Promise.race` z 4000ms timeoutem.

### Changes Required

#### 1. MongoClient options + connect timeout

**File**: `server/utils/db.ts`

**Intent**: Dodać `connectTimeoutMS: 4000, socketTimeoutMS: 4000` do opcji MongoClient, oraz opakować `await _client.connect()` w `Promise.race` z manualnym timeoutem 4000ms. Zapewnia że cold start który wisi jest przerywany niezawodnie przez natywny `setTimeout`.

**Contract**: Opcje MongoClient rozszerzone o `connectTimeoutMS: 4000, socketTimeoutMS: 4000`. Linia `await _client.connect()` zastąpiona przez `Promise.race([_client.connect(), timeoutPromise])` gdzie `timeoutPromise` to `new Promise<never>((_, reject) => setTimeout(() => reject(new Error('MongoDB connect timed out after 4000ms')), 4000))`. Sygnatura `getDb()` i zwracany typ `Promise<Db>` bez zmian.

---

#### 2. Ping timeout w healthz

**File**: `server/routes/healthz.get.ts`

**Intent**: Opakować `await db.command({ ping: 1 })` w `Promise.race` z 4000ms timeoutem — chroni przed hangiem gdy Atlas staje się niedostępny po nawiązaniu połączenia.

**Contract**: Linia `await db.command({ ping: 1 })` zastąpiona przez `Promise.race([db.command({ ping: 1 }), timeoutPromise])` — ten sam wzorzec co w db.ts (lokalny `const timeoutPromise`). Odpowiedź route handlera bez zmian: `{status, db, timestamp}` lub `{status, error}` ze statusem 503.

---

#### 3. Cache invalidation + pending promise guard

**File**: `server/utils/db.ts` + `server/routes/healthz.get.ts`

**Intent**: Wyeksportować `clearDbCache()` z db.ts która zeruje `_client`, `_db` i `_connecting`. Dodać `_connecting: Promise<Db> | null` guard do `getDb()` — jeśli connect już trwa, kolejne wywołania czekają na ten sam promise zamiast startować nowego MongoClient. Wywołać `clearDbCache()` w catch bloku healthz przed zwróceniem 503.

**Contract**:
- Nowa zmienna modułowa: `let _connecting: Promise<Db> | null = null`
- `clearDbCache()` zeruje `_client = null; _db = null; _connecting = null`
- `getDb()`: po early return `if (_db && _client) return _db` — dodać `if (_connecting) return _connecting`; właściwy connect owinąć w IIFE przypisane do `_connecting`, w `finally` wyzerować `_connecting = null`
- W healthz.get.ts: wywołanie `clearDbCache()` w bloku catch przed `return` (bez zmian w logice healthz)

---

### Success Criteria

#### Automated Verification

- TypeScript kompiluje bez błędów: `npm run build`

#### Manual Verification

- `wrangler tail --format pretty` aktywny — odśwież `/healthz` kilkakrotnie — żaden request nie rzuca error 1101
- Odłącz lub zablokuj MongoDB (zmień tymczasowo MONGODB_URI na nieprawidłowy) — `GET /healthz` zwraca `{status: error, db: disconnected}` ze statusem 503 w maks ~4.1s zamiast wisieć
- Po powrocie prawidłowego MONGODB_URI — kolejny request do `/healthz` zwraca 200 (cache był wyczyszczony, świeże połączenie)

---

## References

- Upstream: `context/changes/cloudflare-migration/plan.md`
- Dotknięte pliki: `server/utils/db.ts`, `server/routes/healthz.get.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Add Promise.race timeout to connect and ping

#### Automated

- [x] 1.1 npm run build przechodzi bez błędów TypeScript — 9d40032

#### Manual

- [x] 1.2 /healthz nie rzuca error 1101 przy kilkukrotnym odświeżeniu — 9d40032
- [x] 1.3 /healthz zwraca 503 w maks ~4.1s gdy MongoDB URI jest nieprawidłowy — 9d40032
