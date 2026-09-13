<script lang="ts">
	import TeamStory from '$lib/features/team/TeamStory.svelte';
	import { teamMembers } from '$lib/features/team/team';
</script>

<svelte:head>
	<title>Our Team | QuizGame</title>
	<meta
		name="description"
		content="Meet the full-stack developers who design, build and refine QuizGame."
	/>
</svelte:head>

<TeamStory members={teamMembers} />
