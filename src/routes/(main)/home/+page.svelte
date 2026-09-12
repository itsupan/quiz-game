<script lang="ts">
	import DashboardOverview from '$lib/features/dashboard/DashboardOverview.svelte';
	import QuizCatalog from '$lib/features/dashboard/QuizCatalog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Home | QuizGame</title>
</svelte:head>

<div class="space-y-8">
	<DashboardOverview userName={data.user?.displayName ?? 'Student'} streakDays={data.streakDays} />
	<QuizCatalog quizzes={data.quizzes} />
</div>
