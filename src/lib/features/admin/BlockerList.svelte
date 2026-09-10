<script lang="ts">
	/**
	 * The reasons a draft cannot be published yet.
	 *
	 * Shown on the detail pages so the whole list is visible at once, rather than
	 * discovered one rejected save at a time.
	 */
	let { blockers, label }: { blockers: string[]; label: string } = $props();
</script>

{#if blockers.length > 0}
	<ul
		class="mb-4 border-2 border-warning bg-warning-soft py-3 pr-3 pl-8 text-sm text-warning"
		aria-label={label}
	>
		{#each blockers as blocker (blocker)}
			<li>{blocker}</li>
		{/each}
	</ul>
{/if}
