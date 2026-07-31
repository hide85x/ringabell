---
date: 2026-07-28T07:49:55Z
researcher: Claude Sonnet 5
git_commit: fd7ef2a
branch: master
repository: boxing-promoter
topic: "Stale session revalidation — guards trust session role without re-checking DB"
tags: [research, codebase, auth, sessions, rbac, security, nuxt-auth-utils]
status: complete
last_updated: 2026-07-28
last_updated_by: Claude Sonnet 5
---

# Research: Stale session revalidation — guards trust session role without re-checking DB

**Date**: 2026-07-28T07:49:55Z
**Researcher**: Claude Sonnet 5
**Git Commit**: fd7ef2a
**Branch**: master
**Repository**: boxing-promoter

## Research Question

Guardy `requireAdmin`/`requireManager`/`requirePersonel` ufają wyłącznie roli zapisanej w sesji przy logowaniu i nigdy nie sprawdzają ponownie tabeli `users` w D1. Efekt zgłoszony przez użytkownika: będąc zalogowanym jako Admin, można usunąć samego siebie (lub zmienić sobie/innym rolę) i nadal edytować treści w aplikacji dopóki nie kliknie się "wyloguj". Zanim zaplanujemy naprawę: jak dokładnie działa dziś sesja, czy `nuxt-auth-utils` (biblioteka użyta w projekcie) daje jakiś wbudowany mechanizm rewalidacji/unieważniania, i czy to był świadomy trade-off czy przeoczenie.

## Summary

- **Potwierdzone i odtworzone**: żaden z trzech guardów nie odpytuje D1 — sesja to w pełni "zamrożony" stan z momentu logowania, ważny efektywnie bezterminowo (brak `maxAge` w konfiguracji).
- **31 endpointów API** korzysta z tych guardów (12× `requireAdmin`, 17× `requireManager`, 2× `requirePersonel`), plus 4 client-side middleware — wszystkie polegają wyłącznie na `useUserSession()`/`requireUserSession()`.
- **`nuxt-auth-utils` nie ma wbudowanego server-side store** (sealed cookie only) — nie da się "zdalnie" unieważnić już wydanej sesji innego użytkownika bez dobudowania własnego mechanizmu.
- Istnieje hook `sessionHooks.hook('fetch', ...)`, ale jest wołany **tylko** przez `/api/_auth/session` (endpoint UI), **nie** przez `requireUserSession()` — czyli nie zabezpieczyłby guardów API nawet gdyby był zarejestrowany.
- **To był świadomy, wielokrotnie potwierdzony trade-off, nie przeoczenie** — udokumentowany od `auth-scaffold` ("acceptable until F-02"), przetestowany i zaakceptowany jako oczekiwane zachowanie w `admin-user-management`, i opisany explicite jako "by design (no per-request DB lookup)" w `rbac-api-validation`. Nikt jednak nigdy formalnie nie rozważył i nie odrzucił *rewalidacji* — po prostu wybrano najprostszy model i nie wrócono do tematu, mimo że ryzyko było zidentyfikowane w `test-plan.md` (Risk #3).
- Realna naprawa (opisana niżej) to jedna wspólna funkcja rewalidująca wołana przez wszystkie trzy guardy, z tanim `SELECT` do D1 (SQLite, brak TCP handshake — prawdopodobnie mieści się bezpiecznie w limicie CPU 30ms/10ms Workers, choć to nigdy nie było mierzone w tym repo).

## Detailed Findings

### 1. Guardy i ich użycie (`server/utils/*-guard.ts`, `server/api/**`)

Wszystkie trzy guardy mają identyczny, 4-liniowy wzorzec — `requireUserSession(event)` + porównanie stringów, zero zapytań do D1:

- `server/utils/admin-guard.ts:3-9` — `session.user.role !== 'Admin'` → 403
- `server/utils/manager-guard.ts:3-9` — `!['Admin', 'Manager'].includes(session.user.role)` → 403
- `server/utils/personel-guard.ts:3-9` — `session.user.role !== 'Personel'` → 403

Użycie w `server/api/**` (zweryfikowane grepem, nie tylko raportem subagenta):

**`requireAdmin` — 12 plików**: `admin/dictionaries/requirements/{[id].delete,[id].patch,index.get,index.post}.ts`, `admin/dictionaries/roles/{[id].delete,[id].patch,index.get,index.post}.ts`, `admin/users/{[id].delete,[id].patch,index.get,index.post}.ts`.

**`requireManager` — 17 plików**: `manager/assignments/{[id].delete,index.post}.ts`, `manager/dictionaries/roles/index.get.ts`, `manager/events/{[id].delete,[id].get,[id].patch,index.get,index.post}.ts`, `manager/events/[id]/{cancel.post,publish.post,restore.post}.ts`, `manager/events/[id]/fights/{[fightId].delete,index.post}.ts`, `manager/personnel/{[id].delete,[id].patch,index.get,index.post}.ts`.

**`requirePersonel` — 2 pliki**: `personel/events/{[id].get,index.get}.ts`.

Razem: **31 endpointów** API opierających autoryzację wyłącznie o rolę zamrożoną w sesji.

### 2. Cykl życia sesji — gdzie i jak jest tworzona

Trzy miejsca wołające `setUserSession`, wszystkie zapisują `role` **jednorazowo**, w momencie logowania:

- `server/routes/auth/google.get.ts:17-24` (Google OAuth) — `role` pobrane z D1 (`SELECT ... FROM users WHERE email = ?`) w chwili logowania, potem zamrożone w cookie.
- `server/api/auth/login.post.ts:22-29` (logowanie hasłem) — analogicznie, `role` z D1 w chwili logowania.
- `server/routes/test-session.post.ts:17-24` (endpoint testowy, aktywny tylko gdy `NUXT_TEST_MODE=1`) — `role` przyjęta wprost z body requestu, bez D1 w ogóle (to celowe uproszczenie dla testów integracyjnych).

Po zalogowaniu `role` nigdy nie jest odświeżana — ani po stronie serwera (guardy), ani po stronie klienta (`useUserSession()` w middleware).

### 3. Konfiguracja sesji — brak `maxAge`

`nuxt.config.ts:9-15` konfiguruje wyłącznie hashowanie haseł (`scrypt`), nie ma żadnej sekcji `session:`/`runtimeConfig.session`. Domyślna konfiguracja modułu (`node_modules/nuxt-auth-utils/dist/module.mjs:78-84`) też nie ustawia `maxAge`:

```js
runtimeConfig.session = defu(runtimeConfig.session, {
  name: "nuxt-session",
  password: "",
  cookie: { sameSite: "lax" },
});
```

Skutek w `h3` (`node_modules/h3/dist/index.mjs:1429,1444,1461-1466`): gdy `config.maxAge` nie jest ustawiony, `ttl` w zapieczętowanym payloadzie to `0` (brak wygaśnięcia), a `unsealSession` w ogóle pomija sprawdzanie wieku tokenu. **Sesja w tym repo jest dziś efektywnie bezterminowa** — jedyny sposób jej zakończenia to ręczne wylogowanie (`clearUserSession`).

### 4. Możliwości `nuxt-auth-utils@0.5.29` / `h3@1.15.11`

Zweryfikowane bezpośrednio w kodzie źródłowym pakietów (nie z dokumentacji/pamięci):

- **Brak server-side store** — `SessionConfig` (`node_modules/h3/dist/index.d.mts:126-141`) nie ma pola `store`/adaptera. Cała sesja jest zserializowana i zaszyfrowana (`iron-webcrypto`) w samym cookie.
- **`sessionHooks.hook('fetch', ...)` istnieje**, z komentarzem w typach wprost sugerującym ten use-case ("Throw an error if the session could not be verified (with a database for example)") — ale jest wołany **tylko** przez wbudowany endpoint `GET /api/_auth/session` (`runtime/server/api/session.get.js`), używany przez klienta przy SSR page-loadzie. **`requireUserSession()` (to, czego używają nasze guardy) nigdy nie woła tego hooka.** Zarejestrowanie hooka dziś (nikt tego nie zrobił — sprawdzone grepem w całym repo) nie zabezpieczyłoby więc API.
- **`replaceUserSession()`** istnieje — nadpisuje dane sesji bieżącego requestu, przydatne do odświeżenia własnych danych "w locie", ale nie do zdalnego unieważnienia cudzej sesji.
- **Fizycznie nie da się zdalnie unieważnić** już wydanej sesji innego użytkownika bez dobudowania własnego server-side rejestru — sealed cookie jest samowystarczalny.
- **Skrócenie `maxAge`** (np. do 15 min, przez `runtimeConfig.session.maxAge` w sekundach) to trywialna, częściowa łagodząca zmiana — zawęża okno ekspozycji, ale nie eliminuje problemu (usunięty user nadal ma pełny dostęp aż do wygaśnięcia).

### 5. Możliwy kształt naprawy (z badania biblioteki, nie decyzja — do `/10x-plan`)

1. Jedna wspólna funkcja (np. `requireValidSession(event)`), wołana przez wszystkie trzy istniejące guardy zamiast bezpośredniego `requireUserSession()` — robi `requireUserSession()` + tani `SELECT role FROM users WHERE id = ?` (albo `email = ?`) do D1, porównuje z rolą w cookie. Rozjazd lub brak rekordu → `clearUserSession` + 401.
2. D1 (już używane w projekcie) wystarczy — nie ma powodu dokładać KV tylko dla tego.
3. Opcjonalnie: zarejestrować też `sessionHooks.hook('fetch', ...)` z tą samą logiką, żeby spójnie zachowywał się stan UI (`useUserSession()`) po SSR/odświeżeniu — to dodatek, nie substytut punktu 1 (client middleware i tak nie chronią API same w sobie).
4. Koszt: dodatkowy `SELECT` per guardowany request (31 endpointów). Migracja Mongo→D1 (`context/archive/2026-06-01-mongodb-to-d1/plan.md:5`) była motywowana properties limitu CPU 10ms/30ms na Workers — ale to dotyczyło TCP handshake do MongoDB Atlas, nie zapytań SQLite. Zapytanie D1 (SQLite, brak sieci) prawdopodobnie mieści się bezpiecznie w budżecie, ale to nigdy nie było w tym repo mierzone — warto zmierzyć przy planowaniu, nie zakładać.

## Code References

- `server/utils/admin-guard.ts:3-9` — guard bez DB lookup
- `server/utils/manager-guard.ts:3-9` — guard bez DB lookup
- `server/utils/personel-guard.ts:3-9` — guard bez DB lookup
- `server/routes/auth/google.get.ts:17-24` — `setUserSession` przy OAuth login
- `server/api/auth/login.post.ts:22-29` — `setUserSession` przy logowaniu hasłem
- `server/routes/test-session.post.ts:17-24` — `setUserSession` testowy (bez D1)
- `server/api/admin/users/[id].delete.ts:1-27` — usuwa usera z D1, nie unieważnia jego sesji
- `server/api/admin/users/[id].patch.ts:1-30` — zmienia rolę w D1, nie unieważnia jego sesji
- `app/middleware/admin.ts`, `manager.ts`, `personel.ts`, `auth.global.ts` — client-side guardy, wyłącznie `useUserSession()`, brak rewalidacji
- `nuxt.config.ts:9-15` — brak konfiguracji `session.maxAge`
- `node_modules/nuxt-auth-utils/dist/runtime/server/utils/session.js` — implementacja `setUserSession`/`requireUserSession`/`replaceUserSession`/`clearUserSession`, hook `fetch` wołany tylko przez `session.get.js`
- `node_modules/h3/dist/index.mjs:1321-1479` — `useSession`/`unsealSession`, brak sprawdzania wieku gdy `maxAge` niezdefiniowany

## Architecture Insights

- Wzorzec guardów jest celowo prosty i identyczny we wszystkich trzech rolach — łatwy do rozszerzenia o wspólną rewalidację przez zmianę jednego miejsca (albo trzech identycznych miejsc, jeśli zdecydujemy się nie robić wspólnej funkcji).
- Projekt konsekwentnie unika dodatkowych magazynów (brak KV mimo dostępności na Cloudflare) — D1 jest jedynym źródłem prawdy dla wszystkiego, w tym powinno pozostać dla ewentualnej rewalidacji sesji.
- CPU-limit Workers (10ms free / 30ms paid) to realny, już raz namacalny constraint w tym projekcie (migracja Mongo→D1), ale dotyczył sieciowego TCP handshake — SQLite-in-process (D1) ma inny profil kosztowy, nie należy automatycznie zakładać że "jeszcze jeden SELECT" jest problemem bez pomiaru.

## Historical Context (from prior changes)

- `context/archive/2026-05-29-auth-scaffold/plan-brief.md:46` — pierwotna, jawna zgoda na ten trade-off: *"No persistent role storage — role lives only in the session cookie... Acceptable until F-02."*
- `context/archive/2026-05-29-admin-user-management/plan.md:502-503` — test manualny potwierdzający i akceptujący: zmiana roli propaguje się dopiero po ponownym zalogowaniu.
- `context/archive/2026-06-02-rbac-api-validation/research.md:54,169` — najbardziej wprost: *"Session is frozen at auth time... This is by design (no per-request DB lookup)."*
- `context/archive/2026-06-02-rbac-api-validation/plan.md:16,31` — to samo w planie testów.
- `context/foundation/test-plan.md:57` — ryzyko było zidentyfikowane wprost (Risk #3: *"sprawdź czy middleware weryfikuje rolę z bazy per request czy z sesji cache"*), ale zakres testu ograniczono do 401/403 przy logowaniu, nie do rewalidacji w trakcie aktywnej sesji.
- `context/archive/2026-06-18-personnel-management/plan.md:14-18,44,48` — `requireManager` skopiował ten sam wzorzec (brak DB lookup) bez ponownego rozważenia tematu; guard "last-Admin" z tej samej zmiany chroni tylko przed DELETE ostatniego admina, nie przed nieważnością sesji usuniętego/zdegradowanego usera.
- `context/archive/2026-06-01-mongodb-to-d1/plan.md:5` — kontekst dla limitu CPU Workers (10/30ms), motywacja migracji Mongo→D1; istotny przy szacowaniu kosztu dodatkowego D1 lookup w guardach.

## Related Research

- `context/archive/2026-06-02-rbac-api-validation/research.md` — poprzednie, bezpośrednio powiązane badanie tego samego mechanizmu (guardy + sesja), z tego samego wniosku "by design" wywodzi się dzisiejsze zgłoszenie jako bug do naprawienia.

## Open Questions

- Czy dodatkowy `SELECT` do D1 per guardowany request rzeczywiście mieści się bezpiecznie w budżecie CPU Workers (10ms free / 30ms paid) — nigdy nie zmierzone w tym repo, warto zweryfikować przy planowaniu (np. lokalnie przez `wrangler dev` + pomiar, albo `wrangler tail` na produkcji po wdrożeniu).
- Czy rewalidacja powinna być po `id` (stabilne, ale wymaga że `session.user` ma pole `id` — dziś sesja trzyma `email`, nie `id`, patrz `google.get.ts:19` i `login.post.ts:23`) czy po `email` (spójne z tym co sesja już ma, ale wrażliwe na case-sensitivity — patrz świeżo naprawiony `fix(personel-events)` w tej samej sesji roboczej, commit `fd7ef2a`). To realna decyzja projektowa do `/10x-plan`.
- Czy chcemy też ustawić `maxAge` jako dodatkową warstwę obrony (defense in depth), niezależnie od rewalidacji per-request.
