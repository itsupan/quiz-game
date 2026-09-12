# features

Feature folders are the application's domain layer. Keep UI, pure rules, and server-only
workflows together by business area instead of creating parallel type-based trees.

```text
features/
  dashboard/
    dashboard.ts
    dashboard.server.ts
    DashboardOverview.svelte
    QuizCatalog.svelte
  quiz/
    attempts/
    admin/
    scoring.ts
    timing.ts
  questions/
    QuestionForm.svelte
    questions.server.ts
    validation.ts
  media/
    media.ts
    media.server.ts
  admin/
    audit.server.ts
    overview.server.ts
    shared admin UI
```

Ownership rules:

- Feature-only UI and pure business rules live in their feature folder.
- UI used by multiple features lives in `$lib/components/`.
- Database, auth, and platform infrastructure lives in `$lib/server/`.
- Feature workflows and queries that need infrastructure stay beside their feature and use the
  `.server.ts` suffix. SvelteKit enforces that suffix as a server-only boundary.
- Browser-safe contracts and enum values must not import from `$lib/server/**`.
- Shared domain primitives that are not owned by one feature live in `$lib/domain/`.
- Routes parse HTTP input, call a feature API, translate results to `fail`, `error`, `redirect`, or
  response data, and avoid direct database queries.

Do not create empty `stores`, `utils`, or domain folders to mirror a template. Add a folder only
when a concrete responsibility needs it. Prefer direct `$lib` imports over additional aliases.

Tests live in `tests/unit/` and `tests/e2e/`. The exception is a route component test that needs
that route's generated `./$types`.
