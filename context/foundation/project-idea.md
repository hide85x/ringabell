# RingAbell — pomysł wstępny

## Pomysł
Aplikacja webowa dla firmy promocji bokserskiej, która organizuje gale bokserskie. Firma zatrudnia i zarządza całym personelem — bokserami, sędziami, lekarzami, ratownikami, konferansjerami — i potrzebuje narzędzia do planowania składu każdej gali oraz poszczególnych walk.

Główny problem, który aplikacja rozwiązuje: ręczne planowanie obsady gali jest podatne na błędy — bokser może być przypadkowo przypisany do dwóch walk, sędzia może dostać rolę do której nie ma kwalifikacji, walka może wyjść na ring bez lekarza. Aplikacja pilnuje tych reguł automatycznie i blokuje zapis jeśli obsada jest niekompletna lub konfliktowa.

Przepływ pracy: Manager tworzy galę (data, miejsce), dodaje walki, a następnie przypisuje personel do każdej walki i do całej gali. System waliduje skład na bieżąco i sygnalizuje braki lub konflikty zanim gala zostanie zatwierdzona.

## Role użytkowników
- **Admin** — zarządza bokserami, trenerami, sędziami, rogowymi, całym personelem
- **Manager** — tworzy gale/walki, przypisuje ludzi do ról
- **Bokser** — widzi swój harmonogram walk

## Role personelu (kategorie przypisywane do osób i walk)
- **Sędzia ringowy** — sędzia główny prowadzący walkę w ringu (1 per walka)
- **Sędziowie punktowi** — oceniają walkę przy stoliku (standardowo 3 per walka)
- **Lekarz ringowy** — lekarz obecny przy ringu, decyduje o przerwaniu walki (1 per walka)
- **Ratownik** — zabezpieczenie medyczne na wypadek wypadku (1+ per gala)
- **Konferansjer** — zapowiada walki i zawodników (1 per gala)
- **Trener/rogowy** — narożnik boksera (każdy bokser ma swój narożnik)

## Kluczowa logika biznesowa
- **Detekcja konfliktów** — bokser nie może walczyć dwa razy tego samego wieczoru / za mało dni przerwy między walkami
- **Walidacja ról** — przypisujesz kogoś tylko w roli którą posiada (np. lekarz nie może być sędzią)
- **Wymagane role per walka** — każda walka wymaga: 2 bokserów + sędzia ringowy + 3 sędziów punktowych + lekarz ringowy
- **Wymagane role per gala** — cała gala wymaga: ratownik + konferansjer

## Stack (wstępny)
- Vue 3 + Vite (frontend)
- Node.js + Express (backend)
- MongoDB + Mongoose
- JWT (auth)

## Następny krok
Uruchomić `/10x-shape` — sesja sokratejska, żeby doprecyzować wymagania i powstało `shape-notes.md`.
Potem `/10x-prd` → `context/foundation/prd.md`.

## Kurs
- Deadline projektu: 5 lipca 2026
- Lekcja 1 (M1L1): Od pomysłu do PRD — metoda sokratejska
- Skille pobrane: `/10x-init`, `/10x-shape`, `/10x-prd`
