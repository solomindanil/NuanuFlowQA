# Bug report template (Linear issue description)

Title: `[BUG] <specific symptom, not a guess at the cause>`
Labels: `Bug` + one product-area label · Priority = severity · State: triage/backlog

```markdown
**Product:** <name> (<area — e.g. Auth, Payments>)

**How found:** <exploratory via browser agent / Playwright spec <file> / user report>

**Steps to reproduce:**
1. <step — exact URL, exact input values>
2. <step>

**Expected:** <one sentence, the correct observable behavior>

**Actual:** <what actually happens — exact strings in quotes, status codes, endpoints>

**Evidence:** <curl output / console text / network request + response code / storage state>

**Environment:** <browser + version, OS, prod/staging URL, locale, date>

**Severity:** <urgent|high|medium|low> — <one-line justification>

**Screenshots:** attached — <what each shows>
```

Severity rubric: **Urgent** = money/data loss, blocker · **High** = main flow broken ·
**Medium** = misleading/contradictory UX, a11y mismatch · **Low** = cosmetics, formatting, SEO.

Rules: one bug per ticket (cluster later, in bugfix mode, not here) · screenshot mandatory ·
quote exact strings so the fix can be located by grep · never include credentials.
