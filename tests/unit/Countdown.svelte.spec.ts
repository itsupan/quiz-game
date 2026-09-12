import { render } from 'vitest-browser-svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Countdown from '$lib/features/quiz/Countdown.svelte';

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

const inSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000);

describe('Countdown', () => {
	it('renders nothing for an untimed attempt', () => {
		const screen = render(Countdown, { deadline: null });

		expect(screen.getByRole('timer').elements()).toHaveLength(0);
	});

	it('formats the remaining time as mm:ss', async () => {
		const screen = render(Countdown, { deadline: inSeconds(125) });

		await expect.element(screen.getByRole('timer')).toHaveTextContent('2:05');
	});

	it('fires onexpire exactly once when the clock runs out', async () => {
		const onexpire = vi.fn();

		render(Countdown, { deadline: inSeconds(3), onexpire });

		await vi.advanceTimersByTimeAsync(2000);
		expect(onexpire).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(2000);
		expect(onexpire).toHaveBeenCalledOnce();

		await vi.advanceTimersByTimeAsync(2000);
		expect(onexpire).toHaveBeenCalledOnce();
	});

	it('marks the last minute in text, not only in colour', async () => {
		const screen = render(Countdown, { deadline: inSeconds(45) });

		await expect.element(screen.getByRole('timer')).toHaveTextContent('under a minute');
	});

	it('does not call the last minute out ten minutes early', async () => {
		const screen = render(Countdown, { deadline: inSeconds(600) });

		await expect.element(screen.getByRole('timer')).not.toHaveTextContent('under a minute');
	});
});
