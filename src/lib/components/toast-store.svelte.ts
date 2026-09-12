/**
 * A small global toast queue for the result of an action someone just took — a login,
 * a save, a publish. Two tones only, deliberately: `success` and `danger`. There is no
 * `info` or `loading` tone because a toast here always reports how an action that just
 * finished turned out, never a standing state.
 */

export type ToastTone = 'success' | 'danger';

export type ToastItem = {
	id: number;
	tone: ToastTone;
	message: string;
	/** How long this toast stays up before it auto-dismisses, in ms. */
	duration: number;
};

const DEFAULT_DURATION_MS = 4500;

/**
 * Where a toast queued across a redirect waits.
 *
 * `use:enhance`'s callback runs and returns before the browser navigates, so a toast
 * shown there would be gone before the new page even paints. Stashing it in
 * `sessionStorage` lets the page the redirect lands on show it once, on mount.
 */
const QUEUE_KEY = 'quizgame:queued-toast';

let items = $state<ToastItem[]>([]);
let nextId = 0;

/**
 * Auto-dismiss timers, keyed by toast id, tracked outside `$state` — a countdown is not
 * something a template reads, and re-rendering on every tick would be wasted work.
 * `remaining`/`startedAt` are what let `pause` stop the clock mid-flight and `resume`
 * pick back up with whatever was left, instead of restarting the full duration.
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- deliberately not reactive; nothing ever reads it from a template.
const timers = new Map<
	number,
	{ timeout?: ReturnType<typeof setTimeout>; remaining: number; startedAt: number }
>();

function scheduleDismiss(id: number): void {
	const timer = timers.get(id);
	if (!timer) return;

	timer.startedAt = Date.now();
	timer.timeout = setTimeout(() => dismiss(id), timer.remaining);
}

function show(tone: ToastTone, message: string, duration = DEFAULT_DURATION_MS): void {
	const id = (nextId += 1);
	items = [...items, { id, tone, message, duration }];
	timers.set(id, { remaining: duration, startedAt: 0 });
	scheduleDismiss(id);
}

function dismiss(id: number): void {
	const timer = timers.get(id);
	if (timer?.timeout) clearTimeout(timer.timeout);
	timers.delete(id);
	items = items.filter((item) => item.id !== id);
}

/** Stops a toast's countdown — called while the pointer is over it. */
function pause(id: number): void {
	const timer = timers.get(id);
	if (!timer?.timeout) return;

	clearTimeout(timer.timeout);
	timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
	timer.timeout = undefined;
}

/** Picks the countdown back up with whatever time `pause` left on it. */
function resume(id: number): void {
	const timer = timers.get(id);
	if (!timer || timer.timeout) return;

	scheduleDismiss(id);
}

function queue(tone: ToastTone, message: string): void {
	try {
		sessionStorage.setItem(QUEUE_KEY, JSON.stringify({ tone, message }));
	} catch {
		// Storage can be unavailable (private browsing, disabled site data). Losing a
		// toast is harmless, so there is nothing to recover here.
	}
}

/** Called once, from the root layout, so a toast queued before the last navigation shows. */
function flushQueued(): void {
	try {
		const raw = sessionStorage.getItem(QUEUE_KEY);
		if (!raw) return;
		sessionStorage.removeItem(QUEUE_KEY);

		const parsed = JSON.parse(raw) as Partial<ToastItem>;
		if (
			(parsed.tone === 'success' || parsed.tone === 'danger') &&
			typeof parsed.message === 'string'
		) {
			show(parsed.tone, parsed.message);
		}
	} catch {
		// Malformed or unavailable storage: nothing worth showing.
	}
}

export const toast = {
	get items(): ToastItem[] {
		return items;
	},
	success: (message: string) => show('success', message),
	error: (message: string) => show('danger', message),
	dismiss,
	pause,
	resume,
	/** Queue a toast to appear on whatever page a redirect (e.g. a successful login) lands on. */
	queueSuccess: (message: string) => queue('success', message),
	queueError: (message: string) => queue('danger', message),
	flushQueued
};
