# Fight Corner Assignment — Plan Brief

> Full plan: `context/changes/fight-corner-assignment/plan.md`

## What & Why

Dziś Bokser/Trener/Cutman w walce to luźne, niepowiązane sloty — nic nie mówi które "miejsce" należy do którego boksera. Dzielimy walkę na czerwony i niebieski narożnik: Admin oznacza w Słownikach które role są narożnikowe, a Manager widzi dwie osobne, stylizowane sekcje do obsadzenia.

## Starting Point

`fight_requirement_defaults`/`fight_requirements` mają tylko `role`+`count`. `assignments` nie ma pojęcia narożnika — sloty identyfikowane pozycją w tablicy (niestabilną po edycji). Manager UI renderuje jedną listę wymagań per walka.

## Desired End State

Admin: checkbox "NAROŻNIK" per rola (z walidacją parzystej liczby). Manager: czerwona i niebieska sekcja (ramka+label) dla ról narożnikowych, sekcja "INNE" dla resty. System blokuje tę samą osobę w obu narożnikach tej samej roli. Publikacja wymaga wypełnienia OBU narożników osobno, nie tylko sumy. Personel widzi prefiks "CZERWONY:"/"NIEBIESKI:".

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Które role mają narożnik | Konfigurowalne przez Admina (checkbox) | Elastyczność bez zmian w kodzie przy nowej roli narożnikowej |
| Semantyka `count` dla ról narożnikowych | Suma na całą walkę, dzielona /2 | Zero zmiany mentalnego modelu "MIN. NA WALKĘ" dla Admina |
| Nieparzysta liczba | Zablokuj w formularzu Admina | Brak niejednoznaczności co do podziału |
| Duplikat osoby w obu narożnikach (ta sama rola) | Blokuj (409) | Chroni przed oczywistym błędem Managera |
| Walidacja publikacji | Per-narożnik (count/2 w KAŻDYM) | Chroni przed dziurą "oba miejsca w czerwonym, niebieski pusty" |
| Layout ról bez narożnika | Sekcja "INNE" pod dwoma narożnikami | Czytelne, zgodne z pierwotną prośbą |
| Widok Personelu | Prefiks tekstowy "CZERWONY:"/"NIEBIESKI:" | Minimalna zmiana istniejącego, działającego widoku |

## Scope

**In scope:** migracja (3 nowe kolumny), Admin API+UI (checkbox+walidacja), Manager backend (walidacja corner, blokada duplikatu, auto-copy, publish per-narożnik), Manager UI (sekcje), Personel API+UI (prefiks), 3 nowe testy + regresja.

**Out of scope:** migracja historycznych przypisań na narożnik, blokada różnych ról w obu narożnikach, automatyczne zaokrąglanie nieparzystych liczb, zmiana layoutu Personelu poza prefiksem.

## Architecture / Approach

Denormalizacja `has_corner` powtarza istniejący wzorzec `role`/`count` (słownik → kopia per-walka przy tworzeniu). `corner` na `assignments` to nowa nullable kolumna, walidowana po stronie API (nie CHECK constraint), zgodnie z konwencją repo.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Baza + Admin | migracja, checkbox, walidacja parzystości | PATCH musi znać finalny stan obu pól przed walidacją |
| 2. Backend Manager | walidacja corner, blokada duplikatu, publish per-narożnik | publish.post.ts musi liczyć każdy narożnik osobno |
| 3. Frontend | sekcje Managera + prefiks Personelu | stabilny `:key` w Personelu (dziś kolizyjny) |
| 4. Testy | 3 nowe scenariusze + regresja | test publikacji wymaga tymczasowej roli testowej z hasCorner=true |

**Prerequisites:** żadne — czysto lokalne do momentu deployu.
**Estimated effort:** ~1 sesja, 4 fazy.

## Open Risks & Assumptions

- Zakładamy, że blokada duplikatu dotyczy tylko TEJ SAMEJ roli w obu narożnikach (nie różnych ról) — zgodnie z tym jak user sformułował pytanie ("tenże trener").

## Success Criteria (Summary)

- Admin może oznaczyć rolę jako narożnikową, z ochroną przed nieparzystą liczbą.
- Manager widzi czytelny podział czerwony/niebieski/inne, nie może pomylić osoby między narożnikami.
- Publikacja poprawnie wykrywa niewypełniony narożnik nawet gdy suma się zgadza.
