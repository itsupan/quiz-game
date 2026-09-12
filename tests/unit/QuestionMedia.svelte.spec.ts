import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';

import QuestionMedia from '$lib/features/quiz/QuestionMedia.svelte';

describe('QuestionMedia', () => {
	it('renders an image with its own alt text', async () => {
		const screen = render(QuestionMedia, {
			image: { publicId: 'abc', altText: '赤い正方形' },
			audio: null
		});

		await expect.element(screen.getByRole('img', { name: '赤い正方形' })).toBeInTheDocument();
	});

	it('has no image-only question waiting on a readiness callback that will never fire', () => {
		const onaudioready = vi.fn();

		render(QuestionMedia, { image: null, audio: null, onaudioready });

		expect(onaudioready).toHaveBeenCalledOnce();
	});

	it('does not signal ready until the audio actually can play', async () => {
		const onaudioready = vi.fn();

		const screen = render(QuestionMedia, {
			image: null,
			audio: { publicId: 'clip', transcript: 'これは音声です。' },
			onaudioready
		});

		expect(onaudioready).not.toHaveBeenCalled();

		const audioEl = screen.container.querySelector('audio');
		audioEl?.dispatchEvent(new Event('canplay'));

		expect(onaudioready).toHaveBeenCalledOnce();
	});

	it('keeps a broken listening file locked and offers a retry', async () => {
		const onaudioready = vi.fn();

		const screen = render(QuestionMedia, {
			image: null,
			audio: { publicId: 'clip', transcript: null },
			onaudioready
		});

		const audioEl = screen.container.querySelector('audio');
		audioEl?.dispatchEvent(new Event('error'));

		expect(onaudioready).not.toHaveBeenCalled();
		await expect.element(screen.getByRole('alert')).toHaveTextContent('could not be loaded');
		await expect.element(screen.getByRole('button', { name: 'Retry audio' })).toBeInTheDocument();
	});

	it('provides a custom play button', async () => {
		const screen = render(QuestionMedia, {
			image: null,
			audio: { publicId: 'clip', transcript: null }
		});

		const audioEl = screen.container.querySelector('audio') as HTMLAudioElement;
		let played = false;
		audioEl.play = vi.fn().mockImplementation(() => {
			played = true;
			return Promise.resolve();
		});

		// exact: 'Replay from the start' also matches "Play" as a substring otherwise.
		await screen.getByRole('button', { name: 'Play', exact: true }).click();

		expect(played).toBe(true);
	});

	describe('the transcript', () => {
		it('is withheld during an attempt, because it is the answer to a listening question', async () => {
			const screen = render(QuestionMedia, {
				image: null,
				audio: { publicId: 'clip', transcript: 'これはテストの文字起こしです。' },
				revealTranscript: false
			});

			expect(screen.getByText('これはテストの文字起こしです。').elements()).toHaveLength(0);
		});

		it('is shown once the caller reveals it, on the result page', async () => {
			const screen = render(QuestionMedia, {
				image: null,
				audio: { publicId: 'clip', transcript: 'これはテストの文字起こしです。' },
				revealTranscript: true
			});

			await expect.element(screen.getByText('これはテストの文字起こしです。')).toBeInTheDocument();
		});
	});
});
