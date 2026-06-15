# MongoDB → Cloudflare D1 Migration Implementation Plan

## Overview

Migracja bazy danych z MongoDB Atlas (native driver, TCP) na Cloudflare D1 (SQLite, HTTP-native) w celu eliminacji cold start na Workers free plan. Każda operacja na MongoDB powoduje 5-6s opóźnienie lub Worker hang z powodu CPU limitu 10ms na free tier. D1 jest natywne dla Workers — zero cold start, zero TCP handshake.

## Current State Analysis

- `server/utils/db.ts` — MongoClient z connection pooling, Promise.race timeout, TLS stubs
- `server/utils/mongo-optional-stubs.ts` — stuby dla opcjonalnych deps MongoDB
- `nuxt.config.ts` — 7 alias stubów dla MongoDB deps, `runtimeConfig.mongodbUri`
- `wrangler.toml` — brak D1 binding
- 5 modeli z `ObjectId` z pakietu `mongodb`: User, Person, Event, Fight, Assignment
- 6 API handlerów używających MongoDB query API: `.findOne()`, `.find()`, `.insertOne()`, `.updateOne()`, `.deleteOne()`
- `server/routes/healthz.get.ts` — pinguje MongoDB przez `db.command({ ping: 1 })`
- Baza na produkcji: **pusta** — brak danych do migracji

## Desired End State

- Cloudflare D1 database `ringabell` z 5 tabelami: `users`, `persons`, `events`, `fights`, `fight_requirements`, `assignments`
- `wrangler.toml` z `[[d1_databases]]` binding `DB`
- `server/utils/db.ts` zastąpiony przez `getD1(event)` helper zwracający `D1Database`
- Wszystkie 6 handlerów używają raw SQL przez D1 API
- `mongodb` usunięty z `package.json`
- `mongo-optional-stubs.ts` usunięty
- `nuxt.config.ts` bez MongoDB alias stubów i `mongodbUri`
- `/healthz` pinguje D1 przez `SELECT 1`
- Login przez Google i credentials działa bez hangu, response < 1s

### Key Discoveries

- `nuxt.config.ts:3-6` — `mongo-optional-stubs.ts` importowany przez `fileURLToPath` — usunąć plik i cały blok `alias` w nitro
- `nuxt.config.ts:26-28` — `runtimeConfig.mongodbUri` — usunąć
- `server/models/event.ts` — model Event nie istnieje jeszcze w API, tylko model — sprawdzić przed fazą 3
- `Fight.requirements: Array<{ role: string; count: number }>` — denormalizacja do tabeli `fight_requirements` z FK na `fights.id`
- `nowUtc()` z `utils/date.ts` — używać do wszystkich dat w INSERT/UPDATE zgodnie z lessons.md
- D1 dostępne w handlerach przez `event.context.cloudflare.env.DB` — owinąć w helper `getD1(event)`
- `server/routes/auth/google.get.ts` używa `nowUtc()` przez `~~/utils/date` — pattern do zachowania

## What We're NOT Doing

- Nie migrujemy danych (baza pusta)
- Nie dodajemy ORM (Drizzle) — raw SQL
- Nie zmieniamy struktury API (endpointy, response shape bez zmian)
- Nie dotykamy auth flow (nuxt-auth-utils, OAuth, sesje)
- Nie dodajemy S-02/S-03 — to osobne slice'y po tej migracji

## Implementation Approach

Cztery fazy w porządku zależności: najpierw infrastruktura (schema + config), potem warstwa DB, potem handlery, na końcu deploy i weryfikacja. Każda faza jest deployowalna niezależnie z wyjątkiem fazy 1 (wymaga fazy 2 do pierwszego działającego requesta).

## Critical Implementation Details

**D1 w local dev**: `event.context.cloudflare.env.DB` jest dostępne tylko gdy serwer startuje przez `wrangler dev`, nie przez `nuxt dev`. Do lokalnego testowania używać `npx wrangler dev` zamiast `npm run dev`.

**Fight requirements**: `Fight` ma `requirements` jako array — w D1 to osobna tabela `fight_requirements`. Przy INSERT walki: najpierw INSERT do `fights`, potem INSERT do `fight_requirements` dla każdego wymagania. Przy SELECT: JOIN `fights` z `fight_requirements`, serialize do `{role, count}[]` w response.

**Typ D1Database**: `event.context.cloudflare.env.DB` jest typowany jako `D1Database` z `@cloudflare/workers-types`. Dodać ten pakiet lub użyć `as any` tymczasowo — sprawdzić czy jest już w devDependencies.

---

## Phase 1: D1 Infrastructure — schema, config, wrangler

### Overview

Tworzy bazę D1 lokalnie i na produkcji, definiuje schemat SQL, konfiguruje wrangler.toml. Usuwa MongoDB z projektu (package.json, nuxt.config.ts, stubs).

### Changes Required

#### 1. migrations/0001_init.sql (nowy plik)

**File**: `migrations/0001_init.sql`

**Intent**: Definicja schematu dla wszystkich 5 encji domenowych + fight_requirements jako osobna tabela dla denormalizacji requirements array.

**Contract**:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK(role IN ('Admin', 'Manager', 'Personel')),
  password_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE persons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'cancelled')),
  created_at TEXT NOT NULL
);

CREATE TABLE fights (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  order_number INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE fight_requirements (
  id TEXT PRIMARY KEY,
  fight_id TEXT NOT NULL REFERENCES fights(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id),
  type TEXT NOT NULL CHECK(type IN ('fight', 'event')),
  fight_id TEXT REFERENCES fights(id),
  event_id TEXT REFERENCES events(id),
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_fights_event_id ON fights(event_id);
CREATE INDEX idx_assignments_person_id ON assignments(person_id);
CREATE INDEX idx_assignments_event_id ON assignments(event_id);
```

#### 2. wrangler.toml

**File**: `wrangler.toml`

**Intent**: Dodać D1 database binding (`DB`) i migration tag (`v1`) wymagany przez Cloudflare do deploymentu Durable Objects/D1.

**Contract**: Dodać na końcu pliku:
```toml
[[d1_databases]]
binding = "DB"
database_name = "ringabell"
database_id = "PLACEHOLDER"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["DB"]
```

`database_id` zostanie uzupełnione w fazie 4 po `wrangler d1 create`.

#### 3. package.json

**File**: `package.json`

**Intent**: Usunąć pakiet `mongodb` z dependencies — po migracji na D1 nie jest potrzebny.

**Contract**: Usunąć wpis `"mongodb": "..."` z `dependencies`. Uruchomić `npm install` po zmianie.

#### 4. nuxt.config.ts

**File**: `nuxt.config.ts`

**Intent**: Usunąć wszystkie MongoDB-related alias stuby z bloku `nitro.alias` oraz `runtimeConfig.mongodbUri`. Usunąć import `fileURLToPath` i `mongoOptionalStub` jeśli nie są używane nigdzie indziej.

**Contract**: Usunąć linie 1-6 (import fileURLToPath + mongoOptionalStub), blok `alias` w nitro, i `runtimeConfig.mongodbUri`. Blok `nitro` zostaje z samym `preset: 'cloudflare-module'`.

#### 5. server/utils/mongo-optional-stubs.ts

**File**: `server/utils/mongo-optional-stubs.ts`

**Intent**: Usunąć plik — był potrzebny tylko jako stub dla opcjonalnych deps MongoDB.

**Contract**: Plik do usunięcia (`git rm` lub delete).

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów po usunięciu `mongodb` i stubów
- Plik `migrations/0001_init.sql` istnieje
- `wrangler.toml` zawiera `[[d1_databases]]`

#### Manual Verification

- `npx wrangler d1 execute ringabell --local --command "SELECT name FROM sqlite_master WHERE type='table'"` zwraca 6 tabel (users, persons, events, fights, fight_requirements, assignments)

---

## Phase 2: DB Layer — getD1 helper, model types

### Overview

Zastępuje MongoClient-based `db.ts` prostym helperem `getD1(event)` zwracającym `D1Database`. Aktualizuje typy modeli — usuwa `ObjectId`, dodaje `id: string`.

### Changes Required

#### 1. server/utils/db.ts

**File**: `server/utils/db.ts`

**Intent**: Zastąpić cały plik prostym helperem `getD1(event)` który wyciąga D1Database z `event.context.cloudflare.env.DB` i rzuca błąd gdy binding nie jest dostępny.

**Contract**:
```ts
import type { H3Event } from 'h3'

export function getD1(event: H3Event) {
  const db = (event.context.cloudflare?.env as any)?.DB
  if (!db) throw createError({ statusCode: 500, statusMessage: 'D1 binding not available' })
  return db as D1Database
}
```

Usunąć `clearDbCache()` — nie jest potrzebna.

#### 2. server/models/user.ts

**File**: `server/models/user.ts`

**Intent**: Zastąpić `ObjectId` przez `string` dla pola `_id`, przemianować na `id`. Usunąć import z `mongodb`. Dodać `passwordHash` jako opcjonalne pole.

**Contract**: Interface `User` z polami: `id?: string`, `email: string`, `name: string`, `avatar: string`, `role: 'Admin' | 'Manager' | 'Personel'`, `passwordHash?: string`, `createdAt: string`. Usunąć `USERS_COLLECTION` constant — zastąpić string `'users'` inline w handlerach.

#### 3. server/models/person.ts

**File**: `server/models/person.ts`

**Intent**: Zastąpić `ObjectId` przez `string`, usunąć import `mongodb`.

**Contract**: Interface `Person` z polami: `id?: string`, `name: string`, `email?: string`, `phone?: string`, `role: string`, `isActive: boolean`, `createdAt: string`. Usunąć `PERSONS_COLLECTION`.

#### 4. server/models/event.ts

**File**: `server/models/event.ts`

**Intent**: Zastąpić `ObjectId` przez `string`, usunąć import `mongodb`.

**Contract**: Interface `Event` z polami: `id?: string`, `name: string`, `date: string`, `venue: string`, `status: 'draft' | 'published' | 'cancelled'`, `createdAt: string`. Usunąć `EVENTS_COLLECTION`.

#### 5. server/models/fight.ts

**File**: `server/models/fight.ts`

**Intent**: Zastąpić `ObjectId` przez `string`, usunąć import `mongodb`. `requirements` pozostaje jako pole na interfejsie (denormalizowane przy zapisie, składane przy odczycie przez JOIN).

**Contract**: Interface `Fight` z polami: `id?: string`, `eventId: string`, `orderNumber: number`, `requirements: Array<{ role: string; count: number }>`, `createdAt: string`. Usunąć `FIGHTS_COLLECTION`.

#### 6. server/models/assignment.ts

**File**: `server/models/assignment.ts`

**Intent**: Zastąpić `ObjectId` przez `string`, usunąć import `mongodb`.

**Contract**: Interface `Assignment` z polami: `id?: string`, `personId: string`, `type: 'fight' | 'event'`, `fightId?: string`, `eventId?: string`, `role: string`, `createdAt: string`. Usunąć `ASSIGNMENTS_COLLECTION`.

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów TypeScript

#### Manual Verification

- Brak importów z `mongodb` w żadnym pliku po `grep -r "from 'mongodb'" server/`

---

## Phase 3: API Routes — przepisanie handlerów na D1 SQL

### Overview

Przepisuje wszystkie 6 handlerów na D1 raw SQL API. Każdy handler używa `getD1(event)` i `db.prepare().bind().run()` / `.first()` / `.all()`.

### Changes Required

#### 1. server/api/admin/users/index.get.ts

**File**: `server/api/admin/users/index.get.ts`

**Intent**: Zastąpić `db.collection().find().toArray()` przez `db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()`.

**Contract**: `getD1(event)` → `SELECT id, email, name, avatar, role, created_at FROM users ORDER BY created_at DESC` → zwróć `results`.

#### 2. server/api/admin/users/index.post.ts

**File**: `server/api/admin/users/index.post.ts`

**Intent**: Zastąpić `insertOne` przez `INSERT INTO users`. Generować `id` przez `crypto.randomUUID()`. Hashować hasło przez `hashPassword()` jeśli podane (logika już istnieje — zachować).

**Contract**: `crypto.randomUUID()` dla id, `nowUtc()` dla created_at, `INSERT INTO users (id, email, name, avatar, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`.

#### 3. server/api/admin/users/[id].patch.ts

**File**: `server/api/admin/users/[id].patch.ts`

**Intent**: Zastąpić `updateOne` przez `UPDATE users SET role = ? WHERE id = ?`.

**Contract**: Walidacja roli jak dotychczas → `UPDATE users SET role = ? WHERE id = ?` → sprawdzić `meta.changes === 0` → 404 jeśli brak.

#### 4. server/api/admin/users/[id].delete.ts

**File**: `server/api/admin/users/[id].delete.ts`

**Intent**: Zastąpić `deleteOne` przez `DELETE FROM users WHERE id = ?`.

**Contract**: `DELETE FROM users WHERE id = ?` → sprawdzić `meta.changes === 0` → 404 jeśli brak.

#### 5. server/api/auth/login.post.ts

**File**: `server/api/auth/login.post.ts`

**Intent**: Zastąpić `findOne({ email })` przez `SELECT * FROM users WHERE email = ? LIMIT 1`.

**Contract**: `db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').bind(email).first()` → reszta logiki bez zmian (verifyPassword, setUserSession).

#### 6. server/routes/auth/google.get.ts

**File**: `server/routes/auth/google.get.ts`

**Intent**: Zastąpić `findOne` i `updateOne` przez D1 SELECT i UPDATE.

**Contract**: 
- `SELECT * FROM users WHERE email = ? LIMIT 1` → redirect `/?error=unauthorized` jeśli brak
- `UPDATE users SET name = ?, avatar = ? WHERE email = ?`
- `setUserSession` bez zmian

#### 7. server/routes/healthz.get.ts

#### 8. app/pages/admin/users.vue

**File**: `app/pages/admin/users.vue`

**Intent**: Zaktualizować interfejs `UserDoc` i odwołania do pola id — MongoDB używało `_id`, D1 zwraca `id`.

**Contract**: Zmienić `_id` → `id` w: interfejsie `UserDoc`, `:key="user._id"`, `selectedUser.value._id` (2x).

**File**: `server/routes/healthz.get.ts`

**Intent**: Zastąpić MongoDB ping przez D1 SELECT 1.

**Contract**: `getD1(event)` → `db.prepare('SELECT 1').first()` → zwróć `{ status: 'ok', db: 'connected', timestamp: nowUtc() }` lub `{ status: 'error', db: 'disconnected' }` przy błędzie.

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów TypeScript
- Brak importów z `mongodb` po `grep -r "from 'mongodb'" server/`

#### Manual Verification

- `npx wrangler dev` startuje bez błędów
- `GET /healthz` lokalnie zwraca `{status: 'ok', db: 'connected'}`
- Login przez credentials działa lokalnie (wymaga usera w lokalnej D1)
- `GET /admin/users` zwraca pustą tablicę po zalogowaniu

---

## Phase 4: Deploy & Verify

### Overview

Tworzy D1 database na Cloudflare, aplikuje schema, deployuje Worker, weryfikuje na produkcji.

### Changes Required

#### 1. wrangler.toml — uzupełnienie database_id

**File**: `wrangler.toml`

**Intent**: Po `wrangler d1 create ringabell` zastąpić `PLACEHOLDER` prawdziwym `database_id` z outputu komendy.

**Contract**: `database_id` to UUID zwrócony przez `wrangler d1 create ringabell`.

### Success Criteria

#### Automated Verification

- `npx wrangler d1 migrations apply ringabell --remote` kończy się bez błędów
- `npx wrangler deploy` kończy się bez błędów
- `curl https://ringabell.lukasz-pelc.workers.dev/healthz` zwraca `{status: 'ok', db: 'connected'}`

#### Manual Verification

- Login przez Google na produkcji działa w < 2s (bez cold start hang)
- `GET /admin/users` po zalogowaniu zwraca pustą tablicę bez błędu
- `wrangler tail` nie pokazuje żadnych Exception Thrown przy logowaniu

---

## Testing Strategy

### Manual Testing Steps

1. Lokalnie: `npx wrangler d1 create ringabell --local` + `npx wrangler d1 migrations apply ringabell --local`
2. Lokalnie: `npx wrangler dev` → `curl localhost:8787/healthz`
3. Lokalnie: dodaj testowego usera przez `wrangler d1 execute ringabell --local --command "INSERT INTO users..."` → zaloguj przez credentials
4. Produkcja: `wrangler d1 create ringabell` (prawdziwa baza) → uzupełnij database_id w wrangler.toml → `wrangler deploy`
5. Produkcja: zaloguj przez Google → sprawdź `wrangler tail` czy brak hangu

## Migration Notes

Baza na produkcji jest pusta — brak danych do migracji. MongoDB Atlas cluster można zostawić lub usunąć po pomyślnej weryfikacji na D1.

## References

- `context/changes/data-scaffold/plan.md` — oryginalna implementacja MongoDB
- `context/changes/cloudflare-migration/plan.md` — migracja Pages → Workers
- `server/utils/db.ts` — plik do zastąpienia
- `migrations/` — nowy katalog

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: D1 Infrastructure

#### Automated

- [x] 1.1 `npm run build` przechodzi po usunięciu `mongodb` i stubów — f0466eb
- [x] 1.2 Plik `migrations/0001_init.sql` istnieje z 6 tabelami — 4dec8f8
- [x] 1.3 `wrangler.toml` zawiera `[[d1_databases]]` — 4dec8f8

#### Manual

- [x] 1.4 `wrangler d1 execute ringabell --local --command "SELECT name FROM sqlite_master WHERE type='table'"` zwraca 6 tabel — 4dec8f8

### Phase 2: DB Layer

#### Automated

- [x] 2.1 `npm run build` przechodzi bez błędów TypeScript — b66d67a
- [x] 2.2 Brak importów `from 'mongodb'` w `server/` po grep — b66d67a

### Phase 3: API Routes

#### Automated

- [x] 3.1 `npm run build` przechodzi bez błędów TypeScript — f0466eb
- [x] 3.2 Brak importów `from 'mongodb'` w całym projekcie — f0466eb

#### Manual

- [x] 3.3 `npx wrangler dev` startuje, `/healthz` zwraca `{status: 'ok', db: 'connected'}` — f0466eb
- [x] 3.4 Login przez credentials działa lokalnie — f0466eb
- [x] 3.5 `GET /admin/users` zwraca pustą tablicę lokalnie — f0466eb

### Phase 4: Deploy & Verify

#### Automated

- [x] 4.1 `wrangler d1 migrations apply ringabell --remote` bez błędów — 1122094
- [x] 4.2 `wrangler deploy` bez błędów — 1122094
- [x] 4.3 `curl /healthz` na produkcji zwraca `{status: 'ok', db: 'connected'}` — 1122094

#### Manual

- [x] 4.4 Login przez Google < 2s, brak Exception Thrown w `wrangler tail` — 1122094
- [x] 4.5 `GET /admin/users` na produkcji zwraca pustą tablicę — 1122094
