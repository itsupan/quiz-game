<script lang="ts">
	import type { ContentStatus } from '$lib/domain/enums';
	import Badge from './Badge.svelte';

	let { status }: { status: ContentStatus } = $props();

	// Colour alone never carries the meaning — the word is the label.
	const tone = {
		DRAFT: 'warning',
		PUBLISHED: 'success',
		ARCHIVED: 'neutral'
	} as const;
</script>

<Badge tone={tone[status]}>{status.toLowerCase()}</Badge>
