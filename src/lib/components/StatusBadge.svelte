<script lang="ts">
	import type { ContentStatus } from '$lib/domain/enums';

	let { status }: { status: ContentStatus } = $props();

	// Colour alone never carries the meaning — the word is the label.
	const tone: Record<ContentStatus, string> = {
		DRAFT: 'draft',
		PUBLISHED: 'published',
		ARCHIVED: 'archived'
	};
</script>

<span class="badge {tone[status]}">{status.toLowerCase()}</span>

<style>
	.badge {
		display: inline-block;
		padding: 0.0625rem 0.5rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	.draft {
		background: var(--warning-soft);
		color: var(--warning);
	}

	.published {
		background: var(--success-soft);
		color: var(--success);
	}

	.archived {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}
</style>
