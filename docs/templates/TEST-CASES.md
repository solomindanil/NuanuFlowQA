# <Product> — test cases & scenarios (v1, <date>)

Product: <landing URL> · App: <app URL>
Statuses: ✅ automated (spec file) · 🖐 manual · ⛔ blocked (needs funds/data/access)
Known bugs: <TICKET-IDs> (Linear). Each has a `test.fail()` regression in the specs.

## 1. Landing (`landing.spec.ts`, `smoke.spec.ts`)

| ID | Case | Status |
|----|------|--------|
| LND-01 | Landing responds 2xx, has title and h1 | ✅ |
| LND-02 | No console errors / failed requests on load | ✅ |
| LND-03 | Favicon served; internal links < 400; external links reachable | ✅ |
| LND-04 | Language switch updates content, `<html lang>`, `<title>`, meta | 🖐 |
| LND-05 | Unknown route → 404 UI and 404 status (soft-404 = bug) | 🖐 |

## 2. Auth (`auth.spec.ts`)

| ID | Case | Status |
|----|------|--------|
| AUTH-01 | Login form renders; native validation blocks malformed email | ✅ |
| AUTH-02 | Wrong credentials → localized error (raw backend message = bug) | ✅ |
| AUTH-03 | Password reset UI; signup; logout | 🖐 |

## 3. Core flows

| ID | Case | Status |
|----|------|--------|
| CORE-01 | <main section renders / empty states correct> | — |

## 4. Payments

| ID | Case | Status |
|----|------|--------|
| PAY-01 | Each payment method up to the external payment step (no real money) | 🖐 |
| PAY-02 | Real crediting + purchase with balance | ⛔ owner only |

## 5. Profile & settings

| ID | Case | Status |
|----|------|--------|
| SET-01 | <settings render, toggles, language> | — |

## 6. General / non-functional

| ID | Case | Status |
|----|------|--------|
| GEN-01 | Unauthenticated /app access redirects to login | 🖐 |
| GEN-02 | Console clean across all authenticated sections | 🖐 |
| GEN-03 | i18n: date/number/currency formats match locale everywhere | 🖐 |

## 7. Responsive (`responsive.spec.ts`)

| ID | Case | Status |
|----|------|--------|
| RSP-01 | 320/375/768/1024/1440: no horizontal overflow | ✅ |
| RSP-02 | Mobile nav replaces desktop nav; forms usable at 320px | 🖐 |

## Update process (when the product changes)

1. Get the changelog from the owner (or diff the UI via recon).
2. Exploratory pass over changed areas; update/add cases here.
3. Update/add Playwright specs; newly failing old tests = regression candidates.
4. File bugs to Linear (see `templates/bug-report.md`), one `test.fail()` regression per bug.
5. Run the full suite; keep known bugs as expected-fails annotated with ticket IDs.
