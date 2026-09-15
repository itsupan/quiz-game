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
