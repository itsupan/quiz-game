<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A GET form, so every filter combination is a real URL: shareable, bookmarkable,
	 * and restored by the back button.
	 */
	let { children }: { children: Snippet } = $props();
</script>

<form
	class="mb-4 flex flex-wrap items-end gap-3 border-2 border-line bg-white p-3 [&_label]:flex [&_label]:flex-col [&_label]:gap-1 [&_label]:text-xs [&_label]:font-bold [&_label]:tracking-widest [&_label]:uppercase [&_select]:w-auto"
	method="GET"
>
	{@render children()}
</form>
