import type { JlptLevel, QuizMode, Section } from '$lib/domain/enums';

export type DashboardQuiz = {
	publicId: string;
	title: string;
	description: string | null;
	level: JlptLevel;
	mode: QuizMode;
	timeLimitSeconds: number | null;
	sections: Section[];
	createdAt: string;
};

export type QuizCardItem = {
	id: string;
	title: string;
	description: string;
	level: string;
	mode: string;
	timeLimitSeconds: number | null;
	category: string;
	categoryStyle: 'underlined' | 'boxed';
	icon: 'book' | 'flask' | 'math';
	cornerTriangle: boolean;
};

export function toQuizCards(quizzes: DashboardQuiz[]): QuizCardItem[] {
	return quizzes.map((quiz, index) => {
		const isListening = quiz.sections.includes('LISTENING');
		const isExam = quiz.mode === 'FULL_EXAM' || quiz.mode === 'MOCK_TEST';

		return {
			id: quiz.publicId,
			title: quiz.title,
			description: quiz.description ?? 'Comprehensive JLPT evaluation and structural review.',
			level: quiz.level,
			mode: quiz.mode,
			timeLimitSeconds: quiz.timeLimitSeconds,
			category: isListening ? 'SCIENCES' : isExam ? 'MATHEMATICS' : 'LANGUAGE ARTS',
			categoryStyle: isExam && !isListening ? 'boxed' : 'underlined',
			icon: isListening ? 'flask' : isExam ? 'math' : 'book',
			cornerTriangle: index % 3 === 2
		};
	});
}

export function filterQuizCards(cards: QuizCardItem[], level: string, search: string) {
	const query = search.trim().toLowerCase();

	return cards.filter((card) => {
		const matchesLevel = level === 'ALL LEVELS' || card.level === level;
		const matchesSearch =
			query === '' ||
			[card.title, card.description, card.category, card.level].some((value) =>
				value.toLowerCase().includes(query)
			);

		return matchesLevel && matchesSearch;
	});
}

const utcDay = (date: Date) =>
	Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000;

/** Counts consecutive UTC study days, allowing the active run to end today or yesterday. */
export function calculateStreakDays(completions: Date[], now: Date): number {
	const days = [...new Set(completions.map(utcDay))].sort((a, b) => b - a);

	if (days.length === 0) return 0;

	const today = utcDay(now);
	if (days[0] < today - 1) return 0;

	let streak = 1;
	for (let index = 1; index < days.length; index += 1) {
		if (days[index] !== days[index - 1] - 1) break;
		streak += 1;
	}

	return streak;
}
