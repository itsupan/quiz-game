<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<div class="flex flex-col items-center justify-center p-8 text-center">
	<div class="mb-4 flex h-16 w-16 items-center justify-center border-2 border-ink bg-stone-100">
		<i class="fi fi-rs-pencil text-2xl text-muted" aria-hidden="true"></i>
	</div>
	<h2 class="m-0 mb-2 text-xl font-black tracking-tight text-ink">No Question Selected</h2>
	<p class="m-0 mb-6 text-sm text-muted">
		Choose a question from the repository to edit it, or create a new one.
	</p>
	<a
		href={resolve('/admin/questions/new')}
		class="flex items-center gap-2 border border-ink bg-brand-red px-6 py-3 text-xs font-bold tracking-widest text-white uppercase no-underline transition-colors hover:bg-brand-red-dark"
	>
		<i class="fi fi-rs-plus-circle" aria-hidden="true"></i> Create New Question
	</a>
</div>
