# features

One folder per feature slice — everything that belongs to a single piece of the product
lives together, rather than being split across type-based folders.

```
features/
  admin/
    audit.server.ts       shared by every admin sub-slice below
    validation.ts         shared form validation (quiz + question forms)
    PageHeader.svelte      shared admin-wide components
    quizzes/
      quizzes.server.ts
      QuizForm.svelte
    questions/
      questions.server.ts
      QuestionForm.svelte
```

A file used by only one sub-slice lives in that sub-slice's folder; a file two or more
sub-slices need (like `audit.server.ts` or `validation.ts` above) stays at the feature's
root instead of picking one sub-slice to own it.

Import through the `$lib` alias: `import { score } from '$lib/features/quiz/scoring';`

Where things go:

- **Feature-only UI** → here, beside the feature's logic.
- **UI shared by two or more features** → `$lib/components/`.
- **Anything touching the database or a secret** → `$lib/server/`. SvelteKit refuses to
  bundle `$lib/server/**` into client code, so that boundary is enforced, not just a
  convention. Query through `locals.db`, never `platform.env.DB` directly.
- **Routing and pages** → `src/routes/`, kept thin. A `+page.server.ts` should call into a
  feature module rather than growing logic of its own.

Pure logic in a feature is the cheapest thing to test — a plain `*.spec.ts` in
`tests/unit/` runs in the node project with no browser and no database.

Tests live in the top-level `tests/unit/` (flat, filename picks the Vitest project) and
`tests/e2e/`, not beside the feature — except a route's own `+page.svelte.spec.ts`, which
stays in `src/routes/` because SvelteKit's generated `$types` only resolves relative to
that route folder.
