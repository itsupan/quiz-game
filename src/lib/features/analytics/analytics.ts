import { SECTIONS, type JlptLevel, type Section } from '$lib/domain/enums';

export const EXAM_RESULTS = ['PASSED', 'FAILED', 'INCOMPLETE', 'UNGRADED'] as const;
export type ExamResult = (typeof EXAM_RESULTS)[number];

export type AnalyticsPeriod = {
	start: Date;
	end: Date;
	timezone: string;
};

export const SECTION_LABELS: Record<Section, string> = {
	VOCAB_KANJI: 'Vocabulary & Kanji',
	GRAMMAR_READING: 'Grammar & Reading',
	LISTENING: 'Listening'
};

export type WeeklyPerformance = {
	category: Section;
	label: string;
	correct: number;
	total: number;
	percentage: number | null;
};

export type ExamAttemptSummary = {
	attemptId: string;
	quizId: string;
	title: string;
	level: JlptLevel;
	category: 'COMPREHENSIVE' | Section;
	completedAt: string;
	completionStatus: 'SUBMITTED' | 'EXPIRED';
	score: {
		earned: number;
		maximum: number;
		type: 'RAW' | 'SCALED';
	};
	result: ExamResult;
	resultHref: string;
};

export const RESULT_TONE: Record<ExamResult, 'success' | 'warning' | 'danger' | 'neutral'> = {
	PASSED: 'success',
	FAILED: 'danger',
	INCOMPLETE: 'warning',
	UNGRADED: 'neutral'
};

export const RESULT_LABEL: Record<ExamResult, string> = {
	PASSED: 'Passed',
	FAILED: 'Failed',
	INCOMPLETE: 'Incomplete',
	UNGRADED: 'Ungraded'
};

export function categoryLabel(category: ExamAttemptSummary['category']): string {
	return category === 'COMPREHENSIVE' ? 'Comprehensive' : SECTION_LABELS[category];
}

type DateParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

function partsInTimeZone(date: Date, timezone: string): DateParts {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);

	return {
		year: value('year'),
		month: value('month'),
		day: value('day'),
		hour: value('hour'),
		minute: value('minute'),
		second: value('second')
	};
}

/** Converts a wall-clock time in an IANA timezone to the matching UTC instant. */
function zonedDateTime(parts: DateParts, timezone: string): Date {
	const desired = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second
	);
	let candidate = desired;

	// The second pass accounts for offset changes close to the requested wall-clock time.
	for (let pass = 0; pass < 2; pass += 1) {
		const actual = partsInTimeZone(new Date(candidate), timezone);
		const representedAsUtc = Date.UTC(
			actual.year,
			actual.month - 1,
			actual.day,
			actual.hour,
			actual.minute,
			actual.second
		);
		candidate += desired - representedAsUtc;
	}

	return new Date(candidate);
}

/** Monday 00:00 through the following Monday 00:00 in the learner's timezone. */
export function currentWeek(now: Date, timezone: string): AnalyticsPeriod {
	const local = partsInTimeZone(now, timezone);
	const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
	const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
	localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);

	const startParts: DateParts = {
		year: localDate.getUTCFullYear(),
		month: localDate.getUTCMonth() + 1,
		day: localDate.getUTCDate(),
		hour: 0,
		minute: 0,
		second: 0
	};
	const nextMonday = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day + 7));

	return {
		start: zonedDateTime(startParts, timezone),
		end: zonedDateTime(
			{
				year: nextMonday.getUTCFullYear(),
				month: nextMonday.getUTCMonth() + 1,
				day: nextMonday.getUTCDate(),
				hour: 0,
				minute: 0,
				second: 0
			},
			timezone
		),
		timezone
	};
}

export function completeWeeklyPerformance(
	rows: Partial<Record<Section, { correct: number; total: number }>>
): WeeklyPerformance[] {
	return SECTIONS.map((category) => {
		const values = rows[category] ?? { correct: 0, total: 0 };

		return {
			category,
			label: SECTION_LABELS[category],
			correct: values.correct,
			total: values.total,
			percentage: values.total === 0 ? null : Math.round((values.correct / values.total) * 100)
		};
	});
}
