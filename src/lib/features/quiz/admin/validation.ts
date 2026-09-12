import {
	JLPT_LEVELS,
	QUIZ_ICONS,
	QUIZ_MODES,
	SECTIONS,
	SELECTION_MODES,
	type JlptLevel,
	type QuizIcon,
	type QuizMode,
	type Section,
	type SelectionMode
} from '$lib/domain/enums';
import {
	echoValues,
	formText,
	isOneOf,
	optionalPositiveInteger,
	type ValidationResult
} from '$lib/features/admin/form-data';

export type QuizInput = {
	title: string;
	description: string | null;
	mode: QuizMode;
	level: JlptLevel;
	selectionMode: SelectionMode;
	icon: QuizIcon;
	timeLimitSeconds: number | null;
	/** Lets a practice quiz expose passage translations/transliterations/concept review during the attempt. */
	showStudyAidsDuringAttempt: boolean;
	/** Non-negative; frozen onto the attempt and awarded once on successful submission. */
	xpReward: number;
};

export type QuizSectionInput = {
	section: Section;
	position: number;
	timeLimitSeconds: number | null;
	drawCount: number | null;
};

const TIMED_MODES: readonly QuizMode[] = ['MOCK_TEST', 'FULL_EXAM'];

/** A mock test or full exam is defined by being timed; an untimed one is a misconfiguration. */
export function quizModeRequiresTimeLimit(mode: QuizMode): boolean {
	return TIMED_MODES.includes(mode);
}

/**
 * The one rule connecting a section's draw count to its quiz's selection mode: a `RANDOM`
 * quiz needs to know how many questions to draw, and a `FIXED` quiz — which serves its
 * questions from an ordered list instead — has nowhere to use one.
 */
export function drawCountRule(
	selectionMode: SelectionMode,
	drawCount: number | null
): string | null {
	if (selectionMode === 'RANDOM' && drawCount === null) {
		return 'A random quiz needs to know how many questions this section draws.';
	}
	if (selectionMode === 'FIXED' && drawCount !== null) {
		return 'A fixed quiz takes its questions from its list, so leave this blank.';
	}

	return null;
}

/**
 * `current` carries the two fields the admin dashboard form does not yet expose
 * (`showStudyAidsDuringAttempt`, `xpReward`) through unchanged on an edit, rather than
 * resetting them to their create-time defaults — those are authored through the JSON
 * API (`parseQuizCreateBody`/`parseQuizPatchBody`) instead.
 */
export function parseQuizForm(
	data: FormData,
	current: Pick<QuizInput, 'showStudyAidsDuringAttempt' | 'xpReward'> = {
		showStudyAidsDuringAttempt: false,
		xpReward: 0
	}
): ValidationResult<QuizInput> {
	const errors: Record<string, string> = {};
	const title = formText(data, 'title');
	const description = formText(data, 'description');
	const mode = formText(data, 'mode');
	const level = formText(data, 'level');
	const selectionMode = formText(data, 'selectionMode');
	const icon = formText(data, 'icon');

	if (title === '') errors.title = 'Enter a title.';
	if (!isOneOf(mode, QUIZ_MODES)) errors.mode = `Choose a mode: ${QUIZ_MODES.join(', ')}.`;
	if (!isOneOf(level, JLPT_LEVELS)) errors.level = `Choose a level: ${JLPT_LEVELS.join(', ')}.`;
	if (!isOneOf(selectionMode, SELECTION_MODES)) {
		errors.selectionMode = `Choose how questions are selected: ${SELECTION_MODES.join(', ')}.`;
	}
	if (!isOneOf(icon, QUIZ_ICONS)) errors.icon = `Choose an icon: ${QUIZ_ICONS.join(', ')}.`;

	const minutes = optionalPositiveInteger(formText(data, 'timeLimitMinutes'));
	if (minutes === undefined) {
		errors.timeLimitMinutes = 'Enter a whole number of minutes, or leave it blank.';
	} else if (minutes === null && quizModeRequiresTimeLimit(mode as QuizMode)) {
		errors.timeLimitMinutes = `A ${mode.replace('_', ' ').toLowerCase()} needs a time limit.`;
	}

	if (Object.keys(errors).length > 0) {
		return { ok: false, errors, values: echoValues(data) };
	}

	return {
		ok: true,
		value: {
			title,
			description: description === '' ? null : description,
			mode: mode as QuizMode,
			level: level as JlptLevel,
			selectionMode: selectionMode as SelectionMode,
			icon: icon as QuizIcon,
			timeLimitSeconds: minutes ? minutes * 60 : null,
			showStudyAidsDuringAttempt: current.showStudyAidsDuringAttempt,
			xpReward: current.xpReward
		}
	};
}

export function parseQuizSectionForm(
	data: FormData,
	selectionMode: SelectionMode
): ValidationResult<QuizSectionInput> {
	const errors: Record<string, string> = {};
	const section = formText(data, 'section');
	const position = optionalPositiveInteger(formText(data, 'position'));

	if (!isOneOf(section, SECTIONS)) errors.section = `Choose a section: ${SECTIONS.join(', ')}.`;
	if (position === undefined || position === null) {
		errors.position = 'Position must be a whole number of 1 or more.';
	}

	const minutes = optionalPositiveInteger(formText(data, 'timeLimitMinutes'));
	if (minutes === undefined) {
		errors.timeLimitMinutes = 'Enter a whole number of minutes, or leave it blank.';
	}

	const drawCount = optionalPositiveInteger(formText(data, 'drawCount'));
	if (drawCount === undefined) {
		errors.drawCount = 'Enter a whole number of questions to draw.';
	} else {
		const drawCountError = drawCountRule(selectionMode, drawCount);
		if (drawCountError) errors.drawCount = drawCountError;
	}

	if (Object.keys(errors).length > 0) {
		return { ok: false, errors, values: echoValues(data) };
	}

	return {
		ok: true,
		value: {
			section: section as Section,
			position: position as number,
			timeLimitSeconds: minutes ? minutes * 60 : null,
			drawCount: drawCount ?? null
		}
	};
}
