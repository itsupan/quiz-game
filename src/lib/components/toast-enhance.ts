import type { SubmitFunction } from '@sveltejs/kit';
import { toast } from './toast-store.svelte';

type ResultData = Record<string, unknown> | undefined;
type MessageOption = string | ((data: ResultData) => string | undefined);

type ToastEnhanceOptions = {
	/**
	 * Shown on a same-page success (a plain `{ ok: true, message }`-shaped action return).
	 * Pass this even when the action redirects on success (e.g. signing in) — it is queued
	 * for the page the redirect lands on, since this callback returns before the browser
	 * navigates there.
	 */
	success?: MessageOption;
	/** Shown on `fail()` or an unexpected error. Defaults to `data.message`, then a generic line. */
	error?: MessageOption;
};

function resolve(option: MessageOption | undefined, data: ResultData): string | undefined {
	return typeof option === 'function' ? option(data) : option;
}

/**
 * A drop-in `use:enhance` submit function that toasts a form action's outcome, so a page
 * does not need its own `Notice` banner and result-tracking state just to say "Saved." —
 * see `AuthPage.svelte` for the pattern this generalizes.
 */
export function toastEnhance(options: ToastEnhanceOptions = {}): SubmitFunction {
	return () => {
		return async ({ result, update }) => {
			if (result.type === 'failure' || result.type === 'error') {
				const data = result.type === 'failure' ? (result.data as ResultData) : undefined;
				const message =
					resolve(options.error, data) ??
					(data?.message as string | undefined) ??
					'Something went wrong. Please try again.';
				toast.error(message);
			} else if (result.type === 'success') {
				const message = resolve(options.success, result.data as ResultData);
				if (message) toast.success(message);
			} else if (result.type === 'redirect') {
				const message = resolve(options.success, undefined);
				if (message) toast.queueSuccess(message);
			}

			await update();
		};
	};
}
