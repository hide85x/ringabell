# admin-user-management Implementation Plan

## Overview

Admin zarządza kontami użytkowników i przypisuje role systemowe (Admin/Manager/Personel).

Kluczowy gap obecnego stanu: OAuth callback (`server/routes/auth/google.get.ts`) ustawia sesję z hardkodowaną rolą `'Personel'` bez zapisu do MongoDB — brak miejsca gdzie zmiana roli przez Admina mogłaby się zapisać. Phase 1 naprawia ten fundament: każdy login upsertuje użytkownika w MongoDB, rola ładowana z bazy.

Reszta slice'a: trzy API routes za server-side `requireAdmin` guardem, client middleware blokujący `/admin/*` dla non-Admin, strona `/admin/users` w Persona 5 stylu (tabela + modal).

## Current State Analysis

- `server/routes/auth/google.get.ts:3-9` — `setUserSession` z hardkodowaną `role: 'Personel'`. Brak zapisu do MongoDB. Rola nie jest persistowana między sesjami.
- `server/models/user.ts` — interfejs `User` i `USERS_COLLECTION` gotowe, nigdy nie używane do zapisu.
- `server/utils/db.ts` — `getDb()` auto-importowany w server/. Pattern: `const config = useRuntimeConfig(event); getDb({ mongodbUri: config.mongodbUri })`.
- `app/middleware/auth.global.ts` — sprawdza tylko `loggedIn`, brak sprawdzania roli.
- Brak `server/api/` — żadne API routes nie istnieją.
- Brak `app/pages/` — żadnych stron nie ma poza `app/app.vue`.
- Brak server-side role check helper.

## Desired End State

- Każdy login przez Google upsertuje użytkownika w MongoDB; rola ładowana z bazy do sesji.
- `GET /api/admin/users` — lista wszystkich użytkowników (Admin only, 403 dla innych).
- `PATCH /api/admin/users/:id` — zmiana roli (Admin only).
- `DELETE /api/admin/users/:id` — usunięcie użytkownika (Admin only, hard delete).
- `/admin/users` — strona z tabelą + modalem edycji, niedostępna dla non-Admin.
- Bootstrap pierwszego Admina: ręczna edycja `role: 'Admin'` w MongoDB Atlas console.

### Key Discoveries

- `server/utils/db.ts:getDb` — auto-importowany; wzorzec wywołania przez `useRuntimeConfig(event)`.
- `server/routes/auth/google.get.ts` — jedyne miejsce ustawiania sesji; tu ląduje zmiana Phase 1.
- Nitro auto-imports: `requireUserSession`, `setUserSession`, `defineOAuthGoogleEventHandler` — dostępne bez explicit import w server/ context.
- `server/utils/` są auto-importowane — `requireAdmin` helper wyląduje tam i będzie dostępny globalnie.
- Persona 5 styl: `#221010` tło, `#f20d0d` czerwień, `Space Grotesk`, bold borders, offset drop-shadow `4px 4px 0px #fff`.
- Brak Tailwind w projekcie — UI przez `<style scoped>` w `.vue`.

## What We're NOT Doing

- Brak pre-create kont przez Admina (invite flow) — tylko post-OAuth management.
- Brak search/filter w tym slice'ie.
- Brak soft-delete — hard delete (PRD §FR-001 akceptuje lukę w obsadzie przyszłej gali).
- Brak cascade delete przypisań — osobny slice S-04.
- Brak ADMIN_EMAIL env var bootstrap — manual Atlas console.

## Critical Implementation Details

**OAuth upsert pattern:**
`findOneAndUpdate({ email }, { $setOnInsert: { role: 'Personel', createdAt: new Date(nowUtc()) }, $set: { name, avatar } }, { upsert: true, returnDocument: 'after' })` — `$setOnInsert` gwarantuje że nowy user dostaje `role: 'Personel'`, powracający user zachowuje swoją rolę. Wartość `nowUtc()` opakowana w `new Date()` — `nowUtc()` jest źródłem UTC timestamp, `new Date()` wymagany przez typ `createdAt: Date` w modelu.

**requireAdmin helper** w `server/utils/admin-guard.ts` (auto-importowany):
`requireUserSession(event)` + check `role !== 'Admin'` + `throw createError({ statusCode: 403 })`. Każdy admin API handler wywołuje go jako pierwszą linię.

**PATCH role validation:** whitelist `['Admin', 'Manager', 'Personel']` — 400 jeśli nie jest w zbiorze.

**ObjectId:** `import { ObjectId } from 'mongodb'` — wymagany do `_id` lookup w PATCH/DELETE.

**Client admin middleware** (`app/middleware/admin.ts`) — nie jest global; deklarowany przez `definePageMeta({ middleware: 'admin' })` na stronie `/admin/users.vue`.

**UI — delete confirmation:** `window.confirm()` w modalu przed DELETE — minimalne, w zakresie slice'a.

---

## Phase 1: OAuth → MongoDB upsert + role persistence

### Overview

Zmiana chirurgiczna w `server/routes/auth/google.get.ts`: upsert user w MongoDB przy każdym logowaniu, załaduj rolę z bazy do sesji.

### Changes Required

#### 1. OAuth callback — upsert + load role

**File**: `server/routes/auth/google.get.ts`

**Intent**: Zastąpić hardkodowaną `role: 'Personel'` logiką: upsert dokumentu w MongoDB, załadować aktualną rolę do sesji.

**Contract**:
- Import explicit: `import { nowUtc } from '~~/utils/date'`
- Import explicit: `import type { User } from '~~/server/models/user'` oraz `import { USERS_COLLECTION } from '~~/server/models/user'`
- `getDb` i `useRuntimeConfig` auto-importowane (brak explicit import)
- Wewnątrz `onSuccess`: `const config = useRuntimeConfig(event)`, `const db = await getDb({ mongodbUri: config.mongodbUri })`
- `findOneAndUpdate` z opcjami `{ upsert: true, returnDocument: 'after' }`
- `$setOnInsert: { role: 'Personel' as const, createdAt: new Date(nowUtc()) }` — tylko dla nowych dokumentów
- `$set: { name: user.name, avatar: user.picture }` — aktualizowane przy każdym logowaniu
- `setUserSession(event, { user: { email: doc!.email, name: doc!.name, avatar: doc!.avatar, role: doc!.role } })`
- Sygnatura `onSuccess` i redirect do `/` bez zmian

---

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów TypeScript

#### Manual Verification

- Zaloguj się przez Google → sprawdź MongoDB Atlas → dokument z email, `role: 'Personel'`, `createdAt` pojawia się w kolekcji `users`
- Ponowny login → dokument istnieje, nie zduplikowany
- Ustaw ręcznie `role: 'Admin'` w Atlas → wyloguj → zaloguj → sesja zawiera `role: 'Admin'`

---

## Phase 2: Server API routes for admin

### Overview

Cztery pliki: guard helper + 3 API routes (list, patch, delete). Każda route wywołuje `requireAdmin` jako pierwszą linię.

### Changes Required

#### 1. requireAdmin guard helper

**File**: `server/utils/admin-guard.ts` (nowy plik)

**Intent**: Centralny guard dla wszystkich admin API routes — throw 403 jeśli sesja nie istnieje lub rola nie jest Admin.

**Contract**:
- `export async function requireAdmin(event: H3Event)` (`H3Event` z h3, Nitro global type)
- `const session = await requireUserSession(event)` (auto-import, nuxt-auth-utils)
- `if (session.user.role !== 'Admin') throw createError({ statusCode: 403, statusMessage: 'Forbidden' })`
- Zwraca `session` (caller może użyć danych sesji)
- Brak explicit imports (wszystko auto-importowane w server/utils/)

---

#### 2. GET /api/admin/users — lista użytkowników

**File**: `server/api/admin/users/index.get.ts` (nowy plik)

**Contract**:
- Pierwsza linia: `await requireAdmin(event)` (auto-import z server/utils/admin-guard.ts)
- `const config = useRuntimeConfig(event)`
- `const db = await getDb({ mongodbUri: config.mongodbUri })`
- `db.collection<User>(USERS_COLLECTION).find({}).toArray()`
- Zwraca tablicę dokumentów `User`
- Import explicit: `import type { User } from '~~/server/models/user'` i `import { USERS_COLLECTION } from '~~/server/models/user'`

---

#### 3. PATCH /api/admin/users/:id — zmiana roli

**File**: `server/api/admin/users/[id].patch.ts` (nowy plik)

**Contract**:
- Pierwsza linia: `await requireAdmin(event)`
- `const id = getRouterParam(event, 'id')`
- `const { role } = await readBody<{ role: string }>(event)`
- Whitelist validation: `const VALID_ROLES = ['Admin', 'Manager', 'Personel'] as const` — jeśli `role` nie jest w zbiorze → `throw createError({ statusCode: 400, statusMessage: 'Invalid role' })`
- `db.collection(USERS_COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: { role } })`
- Zwraca `{ ok: true }`
- Import explicit: `import { ObjectId } from 'mongodb'` i `USERS_COLLECTION` z `~~/server/models/user`

---

#### 4. DELETE /api/admin/users/:id

**File**: `server/api/admin/users/[id].delete.ts` (nowy plik)

**Contract**:
- Pierwsza linia: `await requireAdmin(event)`
- `db.collection(USERS_COLLECTION).deleteOne({ _id: new ObjectId(id) })`
- Zwraca `{ ok: true }`
- Import explicit: `import { ObjectId } from 'mongodb'` i `USERS_COLLECTION` z `~~/server/models/user`

---

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów TypeScript

#### Manual Verification

- `GET /api/admin/users` dla Admina → 200 z tablicą użytkowników
- `GET /api/admin/users` bez sesji / z rolą Personel → 401/403
- `PATCH /api/admin/users/:id` z `{ role: 'Manager' }` → 200 `{ ok: true }`, MongoDB zaktualizowane
- `PATCH /api/admin/users/:id` z `{ role: 'Nieznana' }` → 400
- `DELETE /api/admin/users/:id` → 200 `{ ok: true }`, dokument usunięty z kolekcji

---

## Phase 3: Client-side Admin UI

### Overview

Admin middleware (client) + strona `/admin/users` w Persona 5 stylu: dark background, tabela użytkowników, modal edycji roli i usunięcia.

### Changes Required

#### 1. Admin route middleware

**File**: `app/middleware/admin.ts` (nowy plik)

**Contract**:
- Sprawdza `user?.role === 'Admin'` przez `useUserSession()`
- Jeśli nie Admin: `return navigateTo('/')`
- Nie jest `.global` — deklarowany per-page przez `definePageMeta`

---

#### 2. Admin users page

**File**: `app/pages/admin/users.vue` (nowy plik)

**Contract**:
- `definePageMeta({ middleware: 'admin' })` — na górze script setup
- `useHead` ładuje Space Grotesk z Google Fonts
- Dane: `const { data: users, refresh } = await useFetch<User[]>('/api/admin/users')`
- Tabela: kolumny `name`, `email`, role badge (kolorowany), przycisk [EDIT]
- Klik [EDIT] → otwiera modal; `selectedUser` = kliknięty user
- Modal zawiera: name (tekst read-only), `<select>` z opcjami Admin/Manager/Personel (pre-selected), [SAVE] i [DELETE USER]
- `[SAVE]`: `$fetch('/api/admin/users/${selectedUser._id}', { method: 'PATCH', body: { role: selectedRole } })` → `refresh()` → zamknij modal
- `[DELETE USER]`: `window.confirm('Usuń użytkownika?')` → jeśli tak: `$fetch('/api/admin/users/${selectedUser._id}', { method: 'DELETE' })` → `refresh()` → zamknij modal
- `<style scoped>` z CSS:
  - tło body/page: `background: #221010`, `color: white`, `font-family: 'Space Grotesk', sans-serif`
  - tabela: `border: 2px solid #f20d0d`, `border-collapse: collapse`
  - wiersze: `border-bottom: 1px solid rgba(242,13,13,0.3)`, hover `background: rgba(242,13,13,0.1)`
  - role badge: `background: #f20d0d`, `color: white`, `font-weight: 800`, `text-transform: uppercase`
  - modal: `position: fixed`, `background: #1a0808`, `border: 3px solid white`, `box-shadow: 4px 4px 0px white`
  - przyciski: `background: #f20d0d`, `color: white`, `border: none`, `font-weight: 700`, `text-transform: uppercase`
  - DELETE button: `background: transparent`, `border: 2px solid #f20d0d`, `color: #f20d0d`

---

### Success Criteria

#### Automated Verification

- `npm run build` bez błędów TypeScript

#### Manual Verification

- `/admin/users` ładuje się dla Admina — tabela z listą użytkowników z MongoDB
- Klik [EDIT] → modal z aktualną rolą użytkownika
- Zmiana roli → [SAVE] → tabela odświeżona, nowa rola widoczna
- Wyloguj Admin → zaloguj Admin ponownie → rola Admin zachowana (z bazy)
- [DELETE USER] + potwierdzenie → użytkownik znika z tabeli
- Zaloguj jako non-Admin (Personel) → wejdź na `/admin/users` → redirect do `/`

---

## References

- PRD: `context/foundation/prd.md` — FR-001, FR-002, Access Control
- Roadmap: `context/foundation/roadmap.md` — S-01
- OAuth handler: `server/routes/auth/google.get.ts`
- User model: `server/models/user.ts`
- DB utils: `server/utils/db.ts`
- Auth middleware: `app/middleware/auth.global.ts`
- Persona 5 style: `context/ui-mockups/stitch_p5_stylized_dashboard_v2/p5_stylized_dashboard_v2/code.html`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: OAuth → MongoDB upsert + role persistence

#### Automated

- [x] 1.1 npm run build przechodzi bez błędów TypeScript — b2a5af3

#### Manual

- [x] 1.2 Login przez Google → dokument w MongoDB z role: 'Personel', createdAt — b2a5af3
- [x] 1.3 Role ustawiona na 'Admin' w Atlas → kolejny login → sesja z role: 'Admin' — b2a5af3

### Phase 2: Server API routes for admin

#### Automated

- [x] 2.1 npm run build przechodzi bez błędów TypeScript

#### Manual

- [x] 2.2 GET /api/admin/users → 200 dla Admina, 403 dla non-Admin
- [x] 2.3 PATCH /api/admin/users/:id z poprawną rolą → 200, MongoDB zaktualizowane
- [x] 2.4 PATCH z nieprawidłową rolą → 400
- [x] 2.5 DELETE /api/admin/users/:id → 200, dokument usunięty

### Phase 3: Client-side Admin UI

#### Automated

- [ ] 3.1 npm run build bez błędów TypeScript

#### Manual

- [ ] 3.2 /admin/users ładuje tabelę użytkowników dla Admina
- [ ] 3.3 Modal edycji zapisuje rolę, tabela odświeżona
- [ ] 3.4 Delete z potwierdzeniem usuwa użytkownika z listy
- [ ] 3.5 Non-Admin przekierowany z /admin/users do /
