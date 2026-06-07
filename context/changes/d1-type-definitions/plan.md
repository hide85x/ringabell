# D1 Type Definitions — Implementation Plan

## Overview

Przenieść augmentację `User` z `nuxt-auth-utils` do `shared/types/auth.d.ts` (widocznej dla obu tsconfigs), naprawić brakujący `import type` w `admin-guard.ts` i zmienić cast `doc.role as string` na właściwy union type w plikach auth.

## Current State Analysis

- `app/types/auth.d.ts` — augmentacja `#auth-utils` z `role: 'Admin' | 'Manager' | 'Personel'`; widoczna TYLKO dla `tsconfig.app.json`
- `server/utils/admin-guard.ts:1` — używa `H3Event` bez `import type`; `db.ts:1` pokazuje poprawny wzorzec
- `server/api/auth/login.post.ts:27` i `server/routes/auth/google.get.ts:22` — `doc.role as string` zamiast union type
- `shared/` — katalog nieistniejący fizycznie, ale skonfigurowany w `.nuxt/tsconfig.server.json:118` i `tsconfig.app.json` jako `../shared/**/*.d.ts`

### Key Discoveries:

- `.nuxt/tsconfig.server.json:118`: `"../shared/**/*.d.ts"` — shared widoczne dla server
- `.nuxt/tsconfig.app.json`: `"../app/**/*"` + `"../shared/**/*.d.ts"` — shared widoczne też dla app
- `server/utils/db.ts:1`: `import type { H3Event } from 'h3'` — wzorzec do naśladowania
- Problem jest leftoverem po `mongodb-to-d1` (zarchiwizowane)

## Desired End State

`npx nuxi typecheck` przechodzi bez błędów. Augmentacja `User.role` widoczna w obu warstwach — app i server. Jeden plik `shared/types/auth.d.ts` jako jedyne źródło prawdy dla typów sesji.

## What We're NOT Doing

- Nie tworzymy osobnej warstwy typów dla D1 query results (D1UserRow itp.) — scope minimal
- Nie zmieniamy innych castów `as string` dla `email`, `name`, `avatar` — tylko `role` blokuje typecheck
- Nie modyfikujemy `.nuxt/tsconfig.*.json` — generowane przez Nuxt, nie edytujemy ręcznie

## Implementation Approach

Jedna faza: stwórz `shared/types/auth.d.ts`, usuń `app/types/auth.d.ts`, napraw `admin-guard.ts`, popraw dwa casty `role`.

---

## Phase 1: Fix type augmentation visibility and auth casts

### Overview

Przeniesienie `auth.d.ts` do `shared/types/`, naprawa `H3Event` import i casty `role` — wszystkie 4 błędy TS znikają.

### Changes Required:

#### 1. Nowy plik `shared/types/auth.d.ts`

**File**: `shared/types/auth.d.ts`

**Intent**: Przenieść augmentację `User` do warstwy shared żeby tsconfig.server.json ją widział. Treść identyczna jak `app/types/auth.d.ts`.

**Contract**: `declare module '#auth-utils'` z `interface User` zawierającą `email`, `name`, `avatar`, `role: 'Admin' | 'Manager' | 'Personel'`.

#### 2. Usuń `app/types/auth.d.ts`

**File**: `app/types/auth.d.ts`

**Intent**: Usunięcie starego pliku eliminuje duplikację. App layer nadal widzi augmentację przez `shared/`.

**Contract**: Plik usunięty (pusty katalog `app/types/` może zostać lub też być usunięty jeśli jest pusty).

#### 3. Dodaj `import type { H3Event }` do `admin-guard.ts`

**File**: `server/utils/admin-guard.ts`

**Intent**: Naprawić błąd TS2749 — `H3Event` jest auto-importowane przez Nuxt jako wartość (klasa), nie jako typ. Należy zaimportować jawnie jako typ, identycznie jak `server/utils/db.ts:1`.

**Contract**: `import type { H3Event } from 'h3'` jako pierwsza linia pliku.

#### 4. Zmień cast `role` w plikach auth

**File**: `server/api/auth/login.post.ts` (linia 27) i `server/routes/auth/google.get.ts` (linia 22)

**Intent**: `doc.role as string` jest niezgodne z `User.role: 'Admin' | 'Manager' | 'Personel'` — zmienić cast na właściwy union type.

**Contract**: `doc.role as 'Admin' | 'Manager' | 'Personel'` w obu plikach.

### Success Criteria:

#### Automated Verification:

- Typecheck przechodzi: `npx nuxi typecheck` — zero błędów `error TS`
- ESLint przechodzi na zmienionych plikach
- Hook PostToolUse nie blokuje po edycjach

#### Manual Verification:

- Logowanie przez Google OAuth działa — sesja zawiera `role` poprawnie
- `requireAdmin()` nie rzuca błędu dla użytkownika Admin

---

## Testing Strategy

### Automated:

- `npx nuxi typecheck` — główny success criteria

### Manual Testing Steps:

1. Uruchom `npm run dev`
2. Zaloguj się przez Google OAuth jako użytkownik z rolą Admin
3. Sprawdź endpoint `/api/admin/` — powinien zwrócić 200 (nie 403)
4. Sprawdź jako użytkownik bez roli Admin — powinien zwrócić 403

## References

- Frame brief: `context/changes/d1-type-definitions/frame.md`
- Pattern: `server/utils/db.ts:1` (poprawny `import type { H3Event }`)
- tsconfig: `.nuxt/tsconfig.server.json:113-120`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Fix type augmentation visibility and auth casts

#### Automated

- [x] 1.1 Typecheck passes — `npx nuxi typecheck` zero errors TS — 86ac490
- [x] 1.2 ESLint passes on changed files — 86ac490

#### Manual

- [ ] 1.3 Google OAuth login sets role correctly in session
- [ ] 1.4 Admin endpoint returns 200 for Admin, 403 for others
