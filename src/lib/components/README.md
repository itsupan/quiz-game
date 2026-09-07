# components

Shared, presentational Svelte components — the ones used by more than one feature.
Buttons, form fields, layout primitives, modals.

Import them through the `$lib` alias:

```svelte
<script lang="ts">
	import Button from '$lib/components/Button.svelte';
</script>
```

Rules of thumb:

- No data fetching and no database access. Take props, emit events, render markup.
- Nothing imported from `$lib/server/**` — that import fails the build from client code,
  which is the safety net working as intended.
- If a component is only ever used by one feature, it belongs in
  `$lib/features/<feature>/` instead. Move it here once a second feature needs it.

Component tests live next to the component and **must** be named `*.svelte.spec.ts`, so
Vitest runs them in the browser project. A component test named `*.spec.ts` lands in the
node project and fails.
