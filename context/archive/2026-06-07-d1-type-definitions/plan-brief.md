# D1 Type Definitions — Plan Brief

> Full plan: `context/changes/d1-type-definitions/plan.md`
> Frame brief: `context/changes/d1-type-definitions/frame.md`

## What & Why

Augmentacja `User` z `nuxt-auth-utils` żyje w `app/types/auth.d.ts`, które jest widoczne tylko dla warstwy app — server layer kompiluje bez pola `role` na typie `User`. Typecheck hook blokuje na 4 błędach TS będących leftoverem po migracji mongodb-to-d1.

## Starting Point

`app/types/auth.d.ts` poprawnie definiuje `User.role` jako union type, ale `tsconfig.server.json` nie include'uje `app/` — widzi tylko `server/` i `shared/`. `shared/` jest skonfigurowany w obu tsconfigs ale nie istnieje fizycznie.

## Desired End State

Jeden plik `shared/types/auth.d.ts` widoczny dla obu warstw. `npx nuxi typecheck` przechodzi bez błędów. Hook PostToolUse przestaje blokować edycje plików auth.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Lokalizacja augmentacji | `shared/types/auth.d.ts` | Nuxt-idiomatic, widoczny w obu tsconfigs, jedno źródło prawdy | Plan |
| Zakres castów | Tylko `role`, nie `email`/`name`/`avatar` | Tylko `role` blokuje typecheck (union vs string) | Frame |
| Warstwa D1 types | Nie tworzyć | Problem w lokalizacji pliku, nie w brakujących D1 typach | Frame |

## Scope

**In scope:**
- Przeniesienie `auth.d.ts` do `shared/types/`
- Naprawa `import type { H3Event }` w `admin-guard.ts`
- Zmiana `doc.role as string` → union type w 2 plikach auth

**Out of scope:**
- Generyczne typy dla D1 query results
- Inne casty `as string` (`email`, `name`, `avatar`)
- Zmiany w `nuxt.config.ts` lub tsconfig

## Architecture / Approach

Prosta reorganizacja pliku + 3 one-liner fixes. Żadnych nowych zależności, żadnych zmian API ani schematu DB.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Fix augmentation + casts | 4 błędy TS znikają, typecheck hook przechodzi | Nuxt musi odczytać `shared/types/` — sprawdzić po `npm run dev` |

**Prerequisites:** Brak — samodzielna zmiana.
**Estimated effort:** ~1 sesja, 1 faza, 5 małych edycji.

## Open Risks & Assumptions

- `shared/` directory jest obsługiwany przez Nuxt 3.9+ natively — zakładamy aktualną wersję Nuxt
- Po usunięciu `app/types/auth.d.ts` app layer musi nadal widzieć augmentację przez `shared/` — potwierdzić przez typecheck

## Success Criteria (Summary)

- `npx nuxi typecheck` — zero błędów TS
- ESLint nie blokuje na zmienionych plikach
- OAuth login poprawnie ustawia `role` w sesji
