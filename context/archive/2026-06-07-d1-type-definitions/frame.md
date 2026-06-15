# Frame Brief: Auth type augmentation invisible to server layer

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

TypeScript typecheck hook blokuje na 4 błędach w plikach auth:
- `server/api/auth/login.post.ts:27` — `string` not assignable to `'Admin' | 'Manager' | 'Personel'`
- `server/routes/auth/google.get.ts:22` — jw.
- `server/utils/admin-guard.ts:1` — `H3Event` refers to a value, not a type
- `server/utils/admin-guard.ts:3` — `Property 'role' does not exist on type 'User'`

## Initial Framing (preserved)

- **User's stated cause or approach**: Brakuje typów dla D1 query results — stąd wymuszony cast `as string`
- **User's proposed direction**: Dodać TypeScript types dla D1 query results
- **Pre-dispatch narrowing**: Typecheck hook blokuje (nie realny runtime bug); mongodb-to-d1 jest zarchiwizowane (leftover)

## Dimension Map

1. **Brakujące typy D1 wyników** — `doc.role as string` zamiast union type ← initial framing
2. **Server tsconfig nie widzi `app/types/auth.d.ts`** — root cause błędu `role not on User` w server layer
3. **H3Event: wartość zamiast typu** — `admin-guard.ts` używa auto-importowanej klasy jako type annotation
4. **Scope leftover po mongodb-to-d1** — czy problem jest szerszy niż 2 pliki auth?

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Brakujące D1 typy (`as string`) | Tylko 2 pliki: `login.post.ts:27`, `google.get.ts:22`. D1 `.first()` zwraca `unknown`. | STRONG (lecz wąski scope) |
| Server tsconfig nie widzi `app/types/auth.d.ts` | `.nuxt/tsconfig.server.json:118` include ma `../shared/**/*.d.ts` i `../server/**/*` — brak `../app/**/*`. `tsconfig.app.json` MA `../app/**/*`. | STRONG (root cause błędu role not on User) |
| H3Event: brakujący `import type` | `admin-guard.ts:1` — brak importu. `server/utils/db.ts:1` — `import type { H3Event } from 'h3'` (poprawny wzorzec). Nuxt auto-importuje H3Event jako VALUE (`nitro-imports.d.ts:3`). | STRONG |
| Problem jest project-wide | Grep po `as string` w server/: tylko 2 auth pliki. Inne server pliki nie castują D1 results na string. | NONE (problem jest lokalny) |

## Narrowing Signals

- Trigger to hook blokujący typecheck — nie runtime bug. Priorytet: fix TS errors.
- mongodb-to-d1 zamknięty — te błędy to przeoczone leftovers z migracji.
- `shared/` katalog nie istnieje fizycznie, ale jest skonfigurowany w obu tsconfigs — bezpieczne miejsce dla type augmentacji widocznej po obu stronach.

## Cross-System Convention

Nuxt 3 + nuxt-auth-utils: type augmentation `declare module '#auth-utils'` powinno być w miejscu widocznym zarówno dla app jak i server. Prawidłowe miejsce: `shared/types/` (lub `types/` w root). `app/types/` działa tylko dla warstwy app. To znany pattern w Nuxt — dokumentacja `nuxt-auth-utils` pokazuje przykłady w `server/types/` lub root `types/`.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Augmentacja `User` z `nuxt-auth-utils` żyje w `app/types/auth.d.ts` widocznym tylko dla app layer — server layer kompiluje bez `role` na `User`, co powoduje zarówno błąd w `admin-guard.ts` jak i konieczność rzutowania roli w plikach auth.

Pierwotne framing ("dodać D1 type definitions") było poprawne dla błędów `as string`, ale nie diagnozowało root cause błędu `role not on User`. Prawdziwy fix to: (1) przenieść `auth.d.ts` do `shared/types/` żeby było widoczne w obu tsconfigs, (2) dodać `import type { H3Event }` do `admin-guard.ts`, (3) zmienić cast `as string` na właściwy union type.

## Confidence

- **HIGH** — strong evidence z dwóch niezależnych sub-agentów, potwierdzone przez tsconfig file:line, wzorzec z db.ts jako counterexample.

## What Changes for /10x-plan

Plan powinien obejmować 3 zmiany: przeniesienie `auth.d.ts` → `shared/types/auth.d.ts`, dodanie `import type { H3Event }` w `admin-guard.ts`, oraz zmianę castów `doc.role as string` → `doc.role as 'Admin' | 'Manager' | 'Personel'` w obu plikach auth. Nie potrzeba "D1 type definitions" jako osobnej warstwy — problem jest w lokalizacji istniejącej augmentacji.

## References

- Source files: `app/types/auth.d.ts:1-8`, `server/utils/admin-guard.ts:1,3`, `server/api/auth/login.post.ts:27`, `server/routes/auth/google.get.ts:22`, `server/utils/db.ts:1`
- tsconfig: `.nuxt/tsconfig.server.json:113-120`, `.nuxt/tsconfig.app.json:148-161`
