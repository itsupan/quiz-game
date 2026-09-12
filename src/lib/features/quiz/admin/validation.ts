import {
	JLPT_LEVELS,
	QUIZ_MODES,
	SECTIONS,
	SELECTION_MODES,
	type JlptLevel,
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
	timeLimitSeconds: number | null;
};

export type QuizSectionInput = {
	section: Section;
	position: number;
	timeLimitSeconds: number | null;
	drawCount: number | null;
};

const TIMED_MODES: readonly QuizMode[] = ['MOCK_TEST', 'FULL_EXAM'];

export function parseQuizForm(data: FormData): ValidationResult<QuizInput> {
	const errors: Record<string, string> = {};
	const title = formText(data, 'title');
	const description = formText(data, 'description');
	const mode = formText(data, 'mode');
	const level = formText(data, 'level');
	const selectionMode = formText(data, 'selectionMode');

	if (title === '') errors.title = 'Enter a title.';
	if (!isOneOf(mode, QUIZ_MODES)) errors.mode = `Choose a mode: ${QUIZ_MODES.join(', ')}.`;
	if (!isOneOf(level, JLPT_LEVELS)) errors.level = `Choose a level: ${JLPT_LEVELS.join(', ')}.`;
	if (!isOneOf(selectionMode, SELECTION_MODES)) {
		errors.selectionMode = `Choose how questions are selected: ${SELECTION_MODES.join(', ')}.`;
	}

	const minutes = optionalPositiveInteger(formText(data, 'timeLimitMinutes'));
	if (minutes === undefined) {
		errors.timeLimitMinutes = 'Enter a whole number of minutes, or leave it blank.';
	} else if (minutes === null && isOneOf(mode, TIMED_MODES)) {
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
			timeLimitSeconds: minutes ? minutes * 60 : null
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
	} else if (selectionMode === 'RANDOM' && drawCount === null) {
		errors.drawCount = 'A random quiz needs to know how many questions this section draws.';
	} else if (selectionMode === 'FIXED' && drawCount !== null) {
		errors.drawCount = 'A fixed quiz takes its questions from its list, so leave this blank.';
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
