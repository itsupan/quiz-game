# Development Guidelines

## Local Setup

### Spell Checker (CSpell)

To ensure code quality and prevent typos, we use CSpell. The configuration is located in `cspell.json`.

- **Run locally**: You can run the spell checker using the command:
  ```bash
  pnpm run spellcheck
  ```
- **Custom Vocabulary**: If you need to add new domain-specific words, add them to the `words` array in `cspell.json`.

## CI/CD and Cloud Analysis

### SonarCloud (SonarCloud)

We have integrated SonarCloud for automated code analysis to track code health, integrations, and operational metrics.

- The configuration is defined in `sonar-project.properties`.
- The analysis is automatically triggered in our CI/CD pipeline on new pull requests and commits to the `main` or `development` branch.
- **Viewing Reports**: Developers can view and interpret the cloud reports by visiting the SonarCloud dashboard. Look for the `quiz-game` project to see detailed metrics on code quality, security vulnerabilities, and test coverage. Address any issues flagged in your Pull Request before merging.

# Development

Notes on how parts of the app work, for whoever works on them next.

## Dynamic JLPT level filter (home catalog)

The **FILTER BY LEVEL** bar on `/home` only shows levels that at least one quiz in the catalog actually has. It used to list all of N5–N1 whether or not any quizzes existed at that level.

### Data source

`src/routes/(main)/home/+page.server.ts` pages through `GET /api/v1/quizzes` until there are no more pages. That endpoint only returns quizzes learners can see (published ones). The results are mapped to `DashboardQuiz[]` and passed to `QuizCatalog` as the `quizzes` prop. The level list comes from this data, so there is no extra query or endpoint.

### Extraction — `availableLevels` (`src/lib/features/dashboard/dashboard.ts`)

```ts
export function availableLevels(quizzes: Pick<DashboardQuiz, 'level'>[]): JlptLevel[] {
	const present = new Set(quizzes.map((quiz) => quiz.level));
	return JLPT_LEVELS.filter((level) => present.has(level));
}
```

1. Collect every quiz's `level` into a `Set`, which removes duplicates.
2. Filter the canonical `JLPT_LEVELS` list (`src/lib/domain/enums.ts`) against that set, instead of turning the set into an array. The buttons then always appear in N5 → N1 order, whatever order the API returns quizzes in. Any value that isn't a real level is dropped.

It is a pure function, covered by `tests/unit/dashboard.spec.ts`.

### Rendering — `src/lib/features/dashboard/QuizCatalog.svelte`

- `levels = $derived(availableLevels(quizzes))`: recomputed whenever the dataset changes.
- The bar renders `[ALL_LEVELS, ...levels]`. `ALL_LEVELS` (`'ALL LEVELS'`) is exported from `dashboard.ts` so the component and `filterQuizCards` use the same value.
- **Selection fallback:** `selectedLevel` holds what the user clicked. `activeLevel` is a `$derived` that switches back to `ALL_LEVELS` if that level is no longer in `levels`. Filtering and highlighting both use `activeLevel`, so the UI never gets stuck on a level that has disappeared.
- **No levels:** when `levels` is empty, the `ALL LEVELS` button is rendered `disabled` with muted styling, and a "No levels found" label appears next to it. The catalog below shows its usual empty-results message.

## Quiz attempt: one-tap answering

On `/quiz/attempt/[publicId]`, picking an option saves it and moves to the next question straight away. There are no Prev/Next buttons.

- The answer form listens for `change` on the `selectedOptionNumber` radios. It fills a hidden `nextQuestion` input with the next question's number, or the current number on the last question. After a short pause, so the highlight is visible, it calls `requestSubmit()`. This pause is skipped when the user prefers reduced motion. A newer pick during the pause replaces the pending one.
- The existing `?/answer` action does the work: it saves the answer, then redirects when `nextQuestion` differs from the current `q`.
- To go back, use the numbered question navigator. It is built from `attempt.questions`, and answered questions are filled in. On the last question, **Review & submit** is the only button.

## Practice mode game feel ("Dojo Run")

`JLPT_PRACTICE` sittings reveal each answer, keep a streak, and pay a speed bonus.
`MOCK_TEST` and `FULL_EXAM` behave exactly as they did before any of that existed. That
split is the point: exam fidelity is what makes this credible prep, so the game layer sits
beside the JLPT score and never inside it.

### The gate

One predicate, `isPracticeMode()` in `src/lib/features/quiz/modes.ts`. `mode` used to be
display-only — a `<Badge>` and nothing more — so this is the first behaviour in the codebase
that branches on it. Read that function to know what practice changes, rather than grepping
for the string.

`saveAnswer` branches early and literally: exam mode falls through to the original
two-statement batch. Sharing one path behind a flag would make an exam regression a one-line
accident.

### Instant verdict

`?/answer` returns `{ verdict, next }` instead of redirecting, and the client drives the
advance. The branch is on the server-produced verdict, never on a form field, so a crafted
post cannot talk an exam sitting out of its redirect.

`OptionList` needed no changes. Its `.is-correct`/`.is-wrong`/`review-mode` CSS already
existed for the result page, and `QuestionBody` already forwarded `correctOptionNumber` — the
attempt page simply starts passing a prop it used to leave undefined.

The answer key is never on a load-path type. `AttemptQuestion` still omits it;
`frozenOptionsQuery` still selects no `is_correct`. A verdict is produced only by the action,
only in practice, only after a successful write.

**Practice questions lock once answered** (`saveAnswer`, and `canAnswer` in `dto.ts`). Without
this, a learner could answer wrong, read the revealed key, walk back through the navigator and
fix it — inflating `raw_score` and the `xp_awarded` that feeds the public leaderboard. "Run it
back" on the result screen is the retry.

### Combo

`attempts.current_combo` / `best_combo`, advanced by a self-referencing `UPDATE` so the
read-modify-write happens inside SQLite rather than across two round trips. Because a practice
question locks, every write that reaches it is a first answer — no anti-farm guard needed.

### Speed bonus

`attempt_answers.elapsed_ms` is **client-reported and server-clamped** (`clampElapsedMs` in
`game-feel.ts`). The browser is the only place that knows when a question became answerable —
when it painted, or when a listening clip's gate opened. A server-side `served_at` would mean
a mutating GET plus a round trip on every question view, and would be wrong on revisit.

The clamp caps a claim at wall-clock time actually elapsed, so a slow answer cannot be passed
off as fast. The middle stays spoofable, deliberately: the worst case is inflated bonus XP on
a friendly leaderboard, and no value from `game-feel.ts` ever reaches `scoreAttempt`.

Bonus is computed at finalize from stored per-answer times, not accumulated during play —
`finalizeAttempt` retries itself when it loses the revision race, and a running counter would
double where a recomputation lands on the same number.

### The firewall

`src/lib/features/quiz/game-feel.ts` holds every game rule. `scoring.ts` imports nothing from
it. `raw_score`, `scaled_total`, `passed` and the band tables are identical in every mode; the
bonus touches `xp_awarded` (and its `bonus_xp_awarded` audit column) and nothing else. If a
term from `game-feel.ts` ever needs to appear in `scoring.ts`, that is the moment the product
stops being able to claim its scores approximate a real sitting.

### Sound

`SFX_URLS` is resolved by `import.meta.glob`, not static imports. A static import makes a
missing file a **build failure**; the glob makes it `undefined`, and `playSfx` returns early.
`correct`, `incorrect`, `combo` and `levelup` have no files yet and are silent until
licence-checked audio is added to `src/lib/assets/sound/`.

### Migrations 0009 / 0010

Generated normally. The two files numbered `0008` are harmless: `meta/0008_snapshot.json`
already contains both `users.jlpt_level` and `quizzes.icon`, so drizzle-kit's diff base is
correct. **Do not** rename `0008_sturdy_mandroid.sql` or "repair" `_journal.json` — Wrangler
tracks applied migrations in `d1_migrations` by exact filename and never reads the journal, so
a rename re-runs an applied `ALTER TABLE` and fails the deploy.

One hand-edit was needed in each: drizzle-kit emitted the `desc` index expressions as quoted
identifiers (`` `"raw_score" desc` ``), which SQLite reads as a column name and rejects. The
originals in `0001_schema.sql` are unquoted. Check this after any future `db:generate` that
rebuilds `attempts`.
