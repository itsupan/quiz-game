import { browser } from '$app/environment';
import dojoTheme from '$lib/assets/sound/dojo-theme.mp3';
import katanaStrike from '$lib/assets/sound/katana-strike.mp3';
import katanaSwish from '$lib/assets/sound/katana-swish.mp3';
import warDrum from '$lib/assets/sound/war-drum.mp3';

/**
 * App-wide sound preference and the quiz session's samurai sound effects.
 *
 * One `muted` flag covers both the effects and the Our Team page's music, remembered per
 * browser. Storage can be unavailable (private mode, blocked site data), so every access
 * falls back to the in-memory value rather than throwing.
 */
const STORAGE_KEY = 'quizgame:sound-muted';

export const SFX_URLS = {
	swish: katanaSwish,
	strike: katanaStrike,
	drum: warDrum
} as const;

export type SfxName = keyof typeof SFX_URLS;

export const MUSIC_URL = dojoTheme;

function readMuted(): boolean {
	if (!browser) return false;
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

export const soundSettings = $state({ muted: readMuted() });

export function setMuted(muted: boolean) {
	soundSettings.muted = muted;
	try {
		localStorage.setItem(STORAGE_KEY, String(muted));
	} catch {
		// Preference lasts for this page load only.
	}
}

const SFX_VOLUME = 0.5;
const cache: Partial<Record<SfxName, HTMLAudioElement>> = {};

/**
 * Fire-and-forget: a missing file or a browser that refuses playback stays silent. Callers
 * only invoke this from a user gesture or a running timer, never on load.
 */
export function playSfx(name: SfxName) {
	if (!browser || soundSettings.muted) return;

	let audio = cache[name];
	if (!audio) {
		audio = new Audio(SFX_URLS[name]);
		audio.volume = SFX_VOLUME;
		cache[name] = audio;
	}

	audio.currentTime = 0;
	audio.play().catch(() => {});
}
