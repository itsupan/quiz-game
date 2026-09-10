<script lang="ts">
	import AuthPage from '$lib/components/AuthPage.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<AuthPage mode="signup" {form} />
