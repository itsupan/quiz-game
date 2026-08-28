# features

One folder per feature slice — everything that belongs to a single piece of the product
lives together, rather than being split across type-based folders.

```
features/
  quiz/
    QuizCard.svelte        components used only by this feature
    scoring.ts             pure logic
    scoring.spec.ts        unit test (node project)
    QuizCard.svelte.spec.ts  component test (browser project)
    types.ts
```

Import through the `$lib` alias: `import { score } from '$lib/features/quiz/scoring';`

Where things go:

- **Feature-only UI** → here, beside the feature's logic.
- **UI shared by two or more features** → `$lib/components/`.
- **Anything touching the database or a secret** → `$lib/server/`. SvelteKit refuses to
  bundle `$lib/server/**` into client code, so that boundary is enforced, not just a
  convention. Query through `locals.db`, never `platform.env.DB` directly.
- **Routing and pages** → `src/routes/`, kept thin. A `+page.server.ts` should call into a
  feature module rather than growing logic of its own.

Pure logic in a feature is the cheapest thing to test — a plain `*.spec.ts` runs in the
node project with no browser and no database.
