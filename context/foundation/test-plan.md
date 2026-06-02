# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-02 (Phase 1 → change opened)

---

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic diff that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase signal (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is produced
   by `/10x-research` during each rollout phase. If the plan and research
   disagree about where the failure lives, research is the ground truth.

Hot-spot scope used for likelihood weighting: `app/`, `server/`, `utils/`
(excluding `node_modules/`, `dist/`, `.nuxt/`, `context/`).

---

## 2. Risk Map

Failure scenarios ordered by impact × likelihood. Source column cites
evidence that surfaced the risk — never a specific file as "where the
failure lives" (that is research's job, §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — nie anchor) |
|---|---|---|---|---|
| 1 | Manager publikuje galę mimo brakujących wymaganych ról (np. brak lekarza ringowego w walce) — guardrail nie blokuje, gala trafia na ring z niekompletną obsadą | High | High | PRD §Business Logic, PRD §Guardrails, roadmap S-04/S-05 |
| 2 | Ta sama osoba przypisana do dwóch gal w tym samym dniu — system wyświetla ostrzeżenie, ale nie blokuje publikacji mimo aktywnego konfliktu dat | High | High | PRD §Business Logic ("nie może być przypisana do dwóch gal"), PRD §Guardrails |
| 3 | Manager lub Personel wywołuje endpoint admina (`/api/admin/`), albo Personel edytuje dane — middleware autoryzacji ma regresję trudną do wychwycenia ręcznie; nieprzetestowane endpointy PATCH/DELETE | High | Medium | PRD §Access Control, interview Q3 (middleware = globalny), hot-spot `server/utils` (10 commitów/30d), change `admin-user-management` §Nieprzetestowane |
| 4 | API endpoint przyjmuje nieprawidłowe dane i zwraca 200 zamiast 4xx, albo zapisuje błędny stan do D1 — serwer nie waliduje wejść po stronie backendu | High | Medium | Interview Q2 (ciche 200), change `admin-user-management` §Nieprzetestowane (PATCH z złą rolą), hot-spot `server/api/admin/users` (8 commitów/30d) |
| 5 | Po migracji MongoDB→D1, modele Assignment/Fight/Person nie mają pokrycia testowego — błędne mapowanie schematu powoduje że walidacja S-04 operuje na złych danych, guardrail jest ale liczy źle | High | Medium | Hot-spot `server/models` (13 commitów/30d), roadmap F-02 §Risk, change `mongodb-to-d1` |
| 6 | Publikacja gali dla 60+ personelu przekracza 30ms CPU limit Workers → błąd 1102 → personel nie dostaje emaili, gala w niespójnym stanie (opublikowana bez wysyłki) | High | Medium | Infrastructure.md §Risk Register, roadmap S-05 §Unknowns, PRD §US-01 |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | Próba opublikowania gali z brakującą wymaganą rolą per walka lub per gala zwraca błąd walidacji i blokuje publikację — zarówno na poziomie per walka (brakujący sędzia/lekarz) jak i per gala (brak ratownika, konferansjera) | Nie zakładaj że "ostrzeżenie = blokada" — PRD rozróżnia ostrzeżenie (pozwala zapisać) od blokady (blokuje publikację) | Kształt guardrail: gdzie jest sprawdzany (server-side czy client-side?), jakie reguły per walka, jakie per gala, czy weryfikacja jest atomowa | Integration (server route) | Happy-path only — test tylko kompletnej obsady i nie weryfikuje że brakująca rola blokuje |
| #2 | Próba opublikowania gali gdy ta sama osoba ma przypisanie w tym samym dniu do innej gali zwraca błąd i blokuje publikację | Nie zakładaj że wyświetlenie ostrzeżenia == blokada publikacji — PRD mówi wprost że system OSTRZEGA podczas planowania (nie blokuje zapisu), ale BLOKUJE przy publikacji | Kiedy dokładnie jest weryfikowany konflikt dat (przy przypisaniu? przy publikacji?), granularność (data = cały dzień?) | Integration (server route) | Testowanie tylko ostrzeżenia przy przypisaniu bez testu blokady przy publikacji |
| #3 | Wywołanie endpointu admina z tokenem sesji Managera lub Personelu zwraca 401/403, nie 200; Personel nie może modyfikować danych żadnego endpointu | Nie zakładaj że "zalogowany = właściwa rola" — sprawdź czy middleware weryfikuje rolę z bazy per request czy z sesji cache | Jak middleware sprawdza rolę: skąd pobiera (sesja, DB?), kiedy jest odświeżana, czy admin-guard jest stosowany do wszystkich admin routów | Integration (HTTP-level) | Testowanie tylko że niezalogowany dostaje 401 — bez testu że zalogowany z złą rolą też dostaje 403 |
| #4 | PATCH/POST z nieprawidłowymi danymi (nieistniejąca rola, ujemna liczba, brak wymaganych pól) zwraca 400/422 i nie modyfikuje stanu bazy | Nie zakładaj że walidacja Zod/schema na froncie = walidacja server-side — serwer musi walidować niezależnie | Czy i gdzie jest walidacja server-side dla każdego endpointu (schema, Zod, ręczna?); które pola są walidowane a które nie | Integration (HTTP-level) | Wysyłanie requestów tylko przez UI — omija bezpośredni test API |
| #5 | Zapis i odczyt Assignment z wymaganymi polami (rola, osoba, walka/gala) round-tripuje poprawnie przez D1; query walidacyjne zwraca oczekiwaną liczbę wymaganych ról per walka | Nie zakładaj że schemat D1 odpowiada modelowi TypeScript — migracja mogła wprowadzić rozbieżności | Schemat D1 (plik migracji vs model TS), jak Assignment przechowuje wymagane role, czy jest FK constraint czy walidacja aplikacyjna | Integration (D1 local) | Testowanie tylko happy path insert bez testowania query walidacyjnego |
| #6 | Wywołanie route publikacji gali z 60+ personelem kończy się bez błędu 1102 na Workers staging; emaile są wysłane lub błąd jest zgłaszany explicite zamiast cicho porzucany | Nie zakładaj że brak błędu lokalnie = brak problemu na Workers — `wrangler dev` nie egzekwuje CPU limitu | Ile zapytań do D1 i ile HTTP calls (email) generuje jedna publikacja, czy jest batching, czy jest Queue Worker | Smoke test (staging Workers) | Testowanie tylko lokalnie przez `wrangler dev` bez deployu na staging |

---

## 3. Phased Rollout

Każdy wiersz to osobna faza rollout z własnym folderem change via `/10x-new`.
Status zmienia się przez: `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

| # | Nazwa fazy | Cel (jedna linia) | Risks | Typy testów | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Bootstrap + guardrail walidacji | Bootstrap test runner (Vitest) i pierwsze integration testy weryfikujące blokadę publikacji gali | #1, #2 | unit, integration | implementing | context/changes/testing-bootstrap-guardrail/ |
| 2 | RBAC i walidacja wejść API | Integration testy middleware autoryzacji i server-side walidacji wejść | #3, #4 | integration | not started | — |
| 3 | Integracja D1 i modele danych | Integration testy schema integrity Assignment/Fight/Person przez lokalny D1 | #5 | integration | not started | — |
| 4 | Email dispatch i quality gates | Smoke test CPU budget na Workers staging + wiring lint/typecheck/testy do CI | #6 | integration, smoke (staging) | not started | — |

---

## 4. Stack

Brak test runnera w projekcie — Phase 1 bootstrapuje.

| Warstwa | Narzędzie | Wersja | Uwagi |
|---|---|---|---|
| unit + integration | Vitest + `@nuxt/test-utils` | none yet | Naturalny fit Nuxt 4 / Vite; `@cloudflare/vitest-pool-workers` dla testów w Workers runtime — Phase 1 |
| Workers runtime tests | `@cloudflare/vitest-pool-workers` | none yet | Testy integracyjne uruchamiane w V8 isolate identycznym z produkcją — Phase 1 |
| API / HTTP testing | `nitro-test-utils` lub fetch do `unstable_dev` | none yet | Server route tests bez deployu — Phase 1 |
| e2e | Playwright | none yet | Tylko gdy failure mode wymaga pełnego deployed shape (auth + cookie + handler) — Phase 2+ |
| smoke (staging) | `wrangler tail` + skrypt fetch | — | Weryfikacja CPU budget na Workers staging — Phase 4 |

**Stack grounding tools (current session):**
- Docs: brak (Context7 ani framework docs MCP niedostępne w tej sesji) — stack ustalony z manifest + infrastructure.md; checked: 2026-06-02
- Search: WebSearch dostępny — niezużyty (stack jest zdefiniowany przez istniejące zależności projektu); checked: 2026-06-02
- Runtime/browser: brak Playwright MCP w sesji — Playwright jako tool notowany w §4, nie użyty do research; checked: 2026-06-02
- Provider/platform: brak Cloudflare MCP w sesji — `wrangler tail` jako CLI jest nadal opcją quality-gate; checked: 2026-06-02

---

## 5. Quality Gates

| Gate | Gdzie | Wymagany? | Co łapie |
|---|---|---|---|
| lint + typecheck | local + CI | wymagany | błędy typów, dryf syntaktyczny |
| unit + integration | local + CI | wymagany po §3 Phase 1 | regresy logiki walidacji, RBAC, schema |
| smoke na staging | między merge a prod | wymagany po §3 Phase 4 | błędy specyficzne dla Workers runtime (1102, auth Web Crypto) |
| e2e na critical flows | CI na PR | opcjonalny po §3 Phase 2 | pełny przepływ publikacji end-to-end |
| post-edit hook | local (agent loop) | rekomendowany po §3 Phase 2 | regresje w momencie edycji |

---

## 6. Cookbook Patterns

Jak dodawać nowe testy w tym projekcie. Każda sekcja wypełnia się gdy dana faza rollout zostaje wdrożona.

### 6.1 Dodawanie unit testu (logika walidacji)

Utwórz plik `*.test.ts` co-located z testowanym modułem (np. `utils/foo.test.ts` obok `utils/foo.ts`). Importuj funkcje bezpośrednio i używaj `describe` / `it` / `expect` z `vitest`. Uruchom: `npm run test`. Runner (`@cloudflare/vitest-pool-workers` via `cloudflarePool` w `vitest.config.ts`) wykonuje testy w Workers V8 isolate identycznym z produkcją — nie w Node.js. Wzorzec referencyjny: `utils/date.test.ts`.

### 6.2 Dodawanie integration testu server route (D1)

TBD — see §3 Phase 1 (pattern: Vitest + `@cloudflare/vitest-pool-workers` lub `unstable_dev`, assert request → response + side effects w D1 local).

### 6.3 Dodawanie integration testu middleware autoryzacji (rola check)

TBD — see §3 Phase 2 (pattern: HTTP request z sesją roli Manager/Personel do endpointu admina, assert 403).

### 6.4 Dodawanie testu dla nowego endpointu API

TBD — see §3 Phase 2 (pattern: integration preferred; e2e tylko gdy failure mode wymaga pełnego deployed shape).

### 6.5 Dodawanie smoke testu na Workers staging (CPU budget)

TBD — see §3 Phase 4 (pattern: fetch do deployed stagingu, `wrangler tail` weryfikacja braku 1102).

---

## 7. What We Deliberately Don't Test

- **Admin UI (widoki `/admin/`)** — małe grono zaufanych użytkowników, niski blast radius błędu. Testujemy endpointy API admina (RBAC, walidacja), nie sam interfejs. Re-evaluate jeśli grono adminów wzrośnie powyżej ~10 osób lub UI będzie dostępne dla zewnętrznych użytkowników. (Source: interview Q5.)
- **Widok kalendarza Personelu (S-06)** — secondary success criterion, wdrażany ostatni po S-05. Testowalność zależy od kompletnego przepływu publikacji. Dodać do rollout gdy S-06 zostanie wdrożone. (Source: roadmap S-06 §Risk.)
- **Snapshot testy komponentów Vue** — brak wartości przy tej skali projektu; łamią się przy rebrandzie i nie łapią prawdziwych regresów logiki biznesowej. (Source: wywiad, pattern z podobnych projektów.)
- **Load testing / performance benchmarki** — poza zakresem MVP. CPU budget R6 jest testem smokey, nie load testem. Re-evaluate przed pierwszą dużą galą produkcyjną.

---

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-02
- Stack versions last verified: 2026-06-02
- AI-native tool references last verified: 2026-06-02 (brak AI-native narzędzi w obecnym rollout)

Refresh (`/10x-test-plan --refresh`) when:

- nowy top-3 risk wyłoni się z roadmap lub archive (np. S-03 wdroży wzorzec autoryzacji odmienny od istniejącego),
- `checked:` date w §4 jest starsza niż 3 miesiące,
- zmiana stosu technicznego (nowy runtime, nowy test runner),
- §7 negative-space nie odpowiada temu, w co teraz wierzy zespół.
