import { browser } from '$app/environment';

/**
 * Resolved by glob rather than by four static imports.
 *
 * A static `import … from '$lib/assets/sound/x.mp3'` makes an absent file a BUILD failure,
 * not silence — the opposite of what the note in `features/team/README.md` promises, which
 * only ever described the runtime `play().catch()` below. Since the effects are licensed and
 * added one at a time, the build must not depend on a file that has not arrived yet.
 *
 * Vite still hashes and tree-shakes these exactly as it did the static imports; the only
 * difference is that a missing entry is `undefined` at runtime, which `playSfx` skips.
 */
const soundFiles = import.meta.glob('$lib/assets/sound/*.mp3', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string | undefined>;

function soundUrl(name: string): string | undefined {
	return soundFiles[`/src/lib/assets/sound/${name}.mp3`];
}

/**
 * App-wide sound preference and the quiz session's samurai sound effects.
 *
 * One `muted` flag covers both the effects and the Our Team page's music, remembered per
 * browser. Storage can be unavailable (private mode, blocked site data), so every access
 * falls back to the in-memory value rather than throwing.
 */
const STORAGE_KEY = 'quizgame:sound-muted';

export const SFX_URLS = {
	swish: soundUrl('katana-swish'),
	strike: soundUrl('katana-strike'),
	drum: soundUrl('war-drum'),
	/*
	 * Practice-mode game feel. These four are not in the repo yet — each stays silent until
	 * its file is added and its licence confirmed, per `features/team/README.md`.
	 */
	correct: soundUrl('bell-strike'),
	incorrect: soundUrl('wood-knock'),
	combo: soundUrl('drum-roll'),
	levelup: soundUrl('gong')
} as const;

export type SfxName = keyof typeof SFX_URLS;

export const MUSIC_URL = soundUrl('dojo-theme');

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

	// An effect whose file has not been added yet resolves to `undefined` — stay silent.
	const src = SFX_URLS[name];
	if (!src) return;

	let audio = cache[name];
	if (!audio) {
		audio = new Audio(src);
		audio.volume = SFX_VOLUME;
		cache[name] = audio;
	}

	audio.currentTime = 0;
	audio.play().catch(() => {});
}
