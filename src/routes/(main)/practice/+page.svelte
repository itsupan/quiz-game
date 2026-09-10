<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Practice | QuizGame</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<span class="h-8 w-1.5 bg-[#B6251F]"></span>
		<h1 class="text-2xl font-black tracking-tight text-[#202121] uppercase">Practice Mode</h1>
	</div>
	<div class="border-2 border-[#202121] bg-white p-8">
		<p class="font-medium text-stone-600">
			Practice sets and drills are available directly from the Dashboard.
		</p>
		<a
			href={resolve('/home')}
			class="mt-4 inline-block bg-[#B6251F] px-4 py-2 text-xs font-bold text-white uppercase"
		>
			Back to Dashboard
		</a>
	</div>
</div>
