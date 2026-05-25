---
project: "RingAbell"
version: 1
status: draft
created: 2026-05-21
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 4
  hard_deadline: null
  after_hours_only: false
---

## Vision & Problem Statement

Organizacja gali bokserskiej to zarządzanie dziesiątkami ludzi w ściśle określonych rolach — bokserzy, sędziowie, lekarze, ratownicy, konferansjer. Przy ręcznym planowaniu błędy wychodzą na jaw za późno: ta sama osoba zostaje przypisana do dwóch miejsc naraz, gala trafia na ring bez lekarza ringowego, a każdy uczestnik działa w silosie informacyjnym nie wiedząc co się dzieje z resztą obsady.

Firma promocji bokserskiej przez lata radziła sobie telefonem i arkuszem — przy małej skali błędy były wybaczalne. Gdy liczba gal i personelu rośnie, koszt każdej pomyłki rośnie razem z nią. RingAbell rozwiązuje ten problem: jedno miejsce gdzie manager planuje obsadę z automatyczną walidacją konfliktów i wymagań, a każdy uczestnik widzi swój harmonogram.

## User & Persona

**Persona główna: Manager / Promotor**
Osoba odpowiedzialna za organizację gali bokserskiej — tworzy galę, dodaje walki, przypisuje personel. Ponosi ryzyko każdego błędu obsady. Traci czas na ręczne sprawdzanie kto jest dostępny, kto ma odpowiednie kwalifikacje i czy każda walka spełnia minimalne wymagania.

**Persona drugorzędna: Personel (bokser, sędzia, lekarz, konferansjer, ratownik)**
Każdy uczestnik może zalogować się i sprawdzić swój harmonogram — kiedy, gdzie i w jakiej roli. Nie planuje, tylko przegląda.

## Success Criteria

### Primary
- Manager stworzył galę z kompletną obsadą (wszystkie wymagane role per walka wypełnione, brak konfliktów dat) → kliknął "STWÓRZ GALĘ" → każda przypisana osoba otrzymała email z datą, miejscem i swoją rolą.

### Secondary
- Widok kalendarza: każdy zalogowany użytkownik widzi swój harmonogram przyszłych gal z datami i rolami.

### Guardrails
- Gala nie może zostać stworzona jeśli którakolwiek walka nie ma wypełnionych wymaganych ról.
- Ta sama osoba nie może być przypisana do dwóch różnych gal w tej samej dacie.

## User Stories

### US-01: Manager tworzy galę i publikuje ją

- **Given** zalogowany Manager z co najmniej jedną walką z kompletną obsadą w zaplanowanej gali
- **When** klika "STWÓRZ GALĘ"
- **Then** gala zmienia status na opublikowaną, a każda przypisana osoba otrzymuje email z datą, miejscem i swoją rolą

#### Acceptance Criteria
- Przycisk "STWÓRZ GALĘ" jest zablokowany jeśli są nierozwiązane ostrzeżenia walidacji
- Email zawiera: nazwa gali, data, miejsce, rola osoby
- Po publikacji gala nie może być usunięta, tylko anulowana

## Functional Requirements

### Zarządzanie systemem (Admin)
- FR-001: Admin może zarządzać kontami użytkowników (dodaj/edytuj/usuń). Priority: must-have
  > Socrates: Jeśli admin usunie osobę przypisaną do przyszłej gali — gala dostaje lukę w obsadzie, manager widzi błąd walidacji przy następnym otwarciu gali. Akceptowane.
- FR-002: Admin może przypisywać role systemowe (Admin/Manager/Personel). Priority: must-have
  > Socrates: Brak kontrargumentu — FR stoi jak jest.
- FR-003: Admin może zarządzać słownikami ról personelu i wymagań per walka. Priority: must-have
  > Socrates: Brak kontrargumentu — FR stoi jak jest.

### Zarządzanie personelem (Manager)
- FR-004: Manager może dodawać/edytować/dezaktywować osoby z bazy personelu — dezaktywacja oznacza że osoba znika z list wyboru, historia jej przypisań do przeszłych gal zostaje. Priority: must-have
  > Socrates: Trwałe usunięcie osoby niszczy historię przypisań do przeszłych gal. Decyzja: dezaktywacja zamiast usunięcia.
- FR-005: Manager może przypisywać kategorie ról do osoby (bokser, sędzia, lekarz itp.). Priority: must-have
  > Socrates: Brak kontrargumentu — FR stoi jak jest.

### Gale i walki (Manager)
- FR-006: Manager może tworzyć galę (data, miejsce). Priority: must-have
  > Socrates: Brak kontrargumentu — FR stoi jak jest.
- FR-007: Manager może edytować galę; opublikowana gala może być tylko anulowana (nie usunięta). Priority: must-have
  > Socrates: Usunięcie opublikowanej gali zostawiłoby personel z emailem bez informacji o odwołaniu. Decyzja: blokada usunięcia po publikacji — zamiast tego akcja "anuluj galę".
- FR-008: Manager może dodawać walki do gali. Priority: must-have
  > Socrates: Brak kontrargumentu — FR stoi jak jest.
- FR-009: Manager może przypisywać personel do walk — system ostrzega przy konflikcie dat lub błędnej roli, ale pozwala zapisać. Priority: must-have
  > Socrates: Decyzja: ostrzeżenie bez blokady — manager ma elastyczność (np. tymczasowy placeholder), ale widzi problem wyraźnie.
- FR-010: Manager może przypisywać personel do całej gali (ratownik, konferansjer). Priority: must-have
  > Socrates: Brak kontrargumentu — FR stoi jak jest.
- FR-011: Manager może opublikować galę ("STWÓRZ GALĘ") — wysyła emaile do przypisanego personelu. Priority: must-have
  > Socrates: Zmiany po publikacji nie wysyłają kolejnych emaili — to v2. Potwierdzono.
- FR-012: Manager widzi ostrzeżenia walidacji na bieżąco podczas planowania — na dwóch poziomach: per walka (brak sędziego, konflikt dat) i per gala (brak ratownika, konferansjera). Priority: must-have
  > Socrates: Oba poziomy walidacji są kluczowe dla domeny. FR rozszerzony o poziom per gala.

### Podgląd (Personel)
- FR-013: Personel może zobaczyć swój kalendarz nadchodzących gal z datami i rolami. Priority: must-have
  > Socrates: Brak kontrargumentu — FR stoi jak jest.
- FR-014: Personel może zobaczyć szczegóły gali do której jest przypisany. Priority: must-have
  > Socrates: Brak kontrargumentu — FR stoi jak jest.
- FR-015: Personel może zgłosić niedyspozycję do gali (choroba, wypadek losowy). Priority: nice-to-have
  > Socrates: Świadoma decyzja — ten workflow (zgłoszenie → powiadomienie managera → zastępstwo) to niemal tyle roboty co cały MVP. Odkładamy do v2.

## Non-Functional Requirements

- Wynik walidacji po przypisaniu osoby widoczny poniżej 1 sekundy.
- Aplikacja jest użyteczna na ekranach desktopowych i mobilnych — manager planuje na dużym ekranie, personel sprawdza harmonogram na telefonie.
- Dane osobowe personelu nie opuszczają systemu i nie są udostępniane stronom trzecim. Baseline RODO bez formalnej certyfikacji.
- Żadne dane systemu nie są dostępne użytkownikowi niezalogowanemu.

## Business Logic

RingAbell sprawdza każde przypisanie personelu pod kątem konfliktów terminów i kwalifikacji ról, oraz blokuje publikację gali jeśli obsada nie spełnia wymagań minimalnych per walka i per gala.

Reguła działa na dwóch poziomach. Per walka: każda walka wymaga dokładnie 2 bokserów, 1 sędziego ringowego, 3 sędziów punktowych i 1 lekarza ringowego — brak któregokolwiek to ostrzeżenie widoczne dla managera podczas planowania. Per gala: cała gala wymaga co najmniej 1 ratownika i 1 konferansjera — bez nich publikacja jest zablokowana.

Konflikt dat: ta sama osoba nie może być przypisana do dwóch gal w tym samym dniu. System wykrywa to w momencie przypisania i wyświetla ostrzeżenie — manager może je zignorować (elastyczność), ale nie może opublikować gali z aktywnym konfliktem.

## Access Control

Logowanie przez social login (OAuth) — brak haseł przechowywanych w systemie.

Trzy role:

| Rola | Uprawnienia |
|------|-------------|
| **Admin** | Zarządza kontami użytkowników, przypisuje role personelu, zarządza słownikami (typy ról, wymagania per walka). |
| **Manager** | Tworzy i edytuje gale, tworzy walki, przypisuje personel do walk i gal, widzi walidacje konfliktów. |
| **Personel** | Tylko podgląd własnego harmonogramu — kiedy, gdzie, w jakiej roli. Brak możliwości edycji. |

Żadne dane systemu nie są dostępne użytkownikowi niezalogowanemu.

## Non-Goals

- **Brak powiadomień przy zmianach** — personel dostaje email tylko raz, przy publikacji gali. Zmiany w obsadzie nie wysyłają kolejnych powiadomień (v2).
- **Brak raportowania i statystyk** — brak historii gal, statystyk bokserów, eksportu danych w MVP.
- **Brak integracji z zewnętrznymi kalendarzami** — brak synchronizacji z zewnętrznymi systemami kalendarzy. Kalendarz w aplikacji jest wewnętrzny.

## Open Questions

Brak otwartych pytań w chwili generowania PRD — wszystkie sygnały jakości z sesji kształtowania zostały zaadresowane (quality_check_status: accepted).
