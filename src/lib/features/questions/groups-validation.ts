import type { GroupFormat, JlptLevel, Section } from '$lib/domain/enums';

export type GroupInput = {
	level: JlptLevel;
	section: Section;
	format: GroupFormat;
	title: string | null;
	/** Maps to the `passage_text` column; the public API calls it `body`. */
	body: string | null;
	instruction: string | null;
	bodyTranslation: string | null;
	exampleText: string | null;
	exampleTransliteration: string | null;
	exampleTranslation: string | null;
	imageMediaId: number | null;
	audioMediaId: number | null;
};

/**
 * Format-aware publish blockers for a question group, mirroring
 * `questionPublishBlockers` in `./validation`. Image/audio attachment rules are shared
 * with questions: an attached image needs alt text, and attached audio needs a
 * transcript, regardless of the group's own format.
 */
export function groupPublishBlockers(
	group: { format: GroupFormat; body: string | null; exampleText: string | null },
	media: {
		image: { altText: string | null } | null;
		audio: { transcript: string | null } | null;
	}
): string[] {
	const blockers: string[] = [];

	if (media.image && (media.image.altText ?? '').trim() === '') {
		blockers.push('The attached image needs alt text before this group can be published.');
	}
	if (media.audio && (media.audio.transcript ?? '').trim() === '') {
		blockers.push('The attached audio needs a transcript before this group can be published.');
	}

	if (group.format === 'READING_PASSAGE' && (group.body ?? '').trim() === '') {
		blockers.push('A reading passage group needs non-empty body text.');
	}

	if (group.format === 'LISTENING_CLIP' && !media.audio) {
		blockers.push('A listening clip group needs an attached audio asset.');
	}

	if (group.format === 'CONCEPT_REVIEW') {
		if ((group.body ?? '').trim() === '') {
			blockers.push('A concept-review group needs non-empty explanatory body text.');
		}
		if ((group.exampleText ?? '').trim() === '') {
			blockers.push('A concept-review group needs a usable example.');
		}
	}

	return blockers;
}
