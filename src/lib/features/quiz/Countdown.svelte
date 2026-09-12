<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';

	import { isExpired, remainingMs } from './timing';

	/**
	 * A display-only countdown to a server-computed deadline.
	 *
	 * `attempts.expires_at` is the sole authority, per the schema decisions doc — this
	 * only shows what the server already decided, and fires `onexpire` once so a caller
	 * can submit. If that post never lands (the tab closes, the network drops), the
	 * server settles the same clock on the next request, so nothing here has to be
	 * trusted for the timer-expiry acceptance criterion to hold.
	 */
	let {
		deadline,
		onexpire
	}: {
		deadline: Date | null;
		onexpire?: () => void;
	} = $props();

	let now = $state(new Date());
	let firedDeadlineMs: number | null = null;

	$effect(() => {
		if (!deadline) return;

		const id = setInterval(() => {
			now = new Date();
		}, 1000);

		return () => clearInterval(id);
	});

	const remaining = $derived(remainingMs(now, deadline));
	const underAMinute = $derived(remaining !== null && remaining < 60_000);

	$effect(() => {
		if (deadline && firedDeadlineMs !== deadline.getTime() && isExpired(now, deadline)) {
			firedDeadlineMs = deadline.getTime();
			onexpire?.();
		}
	});

	const formatted = $derived.by(() => {
		if (remaining === null) return null;

		const totalSeconds = Math.ceil(remaining / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;

		return `${minutes}:${String(seconds).padStart(2, '0')}`;
	});

	const minutesLeft = $derived(remaining === null ? null : Math.ceil(remaining / 60_000));

	/**
	 * Announced only at 10, 5 and 1 minute, and at zero — never once a second, which is
	 * what wiring the visible countdown itself to `aria-live` would do to a screen reader.
	 */
	let announcement = $state('');
	const announced = new SvelteSet<number>();

	$effect(() => {
		if (minutesLeft === null) return;

		if (remaining === 0 && !announced.has(0)) {
			announced.add(0);
			announcement = 'Time is up.';
		} else if ([10, 5, 1].includes(minutesLeft) && !announced.has(minutesLeft)) {
			announced.add(minutesLeft);
			announcement = `${minutesLeft} minute${minutesLeft === 1 ? '' : 's'} remaining.`;
		}
	});
</script>

{#if formatted !== null}
	<p
		role="timer"
		class="m-0 font-mono text-lg font-bold {underAMinute ? 'text-danger' : 'text-ink'}"
	>
		{formatted}
		{#if underAMinute}
			<span class="ml-1 font-sans text-xs font-bold uppercase">— under a minute</span>
		{/if}
	</p>
	<p class="visually-hidden" aria-live="polite">{announcement}</p>
{/if}
