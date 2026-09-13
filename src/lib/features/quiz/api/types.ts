import type {
	GroupFormat,
	JlptLevel,
	QuestionFormat,
	QuizIcon,
	QuizMode,
	ScoringBand,
	Section,
	SelectionMode
} from '$lib/domain/enums';

export type ApiProblem = {
	type: string;
	title: string;
	status: number;
	detail: string;
	instance: string;
	code: string;
	requestId: string;
	errors?: { field: string; message: string }[];
};

export type ApiEnvelope<T> = { data: T };

export type ApiPage<T> = ApiEnvelope<T> & { page: { nextCursor: string | null } };

export type QuizSummary = {
	id: string;
	title: string;
	description: string | null;
	level: JlptLevel;
	mode: QuizMode;
	selectionMode: SelectionMode;
	icon: QuizIcon;
	timeLimitSeconds: number | null;
	sections: Section[];
};

export type QuizOverview = Omit<QuizSummary, 'sections'> & {
	sections: {
		section: Section;
		position: number;
		timeLimitSeconds: number | null;
		questionCount: number;
	}[];
};

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'ABANDONED';

export type AttemptState = {
	id: string;
	status: AttemptStatus;
	serverTime: string;
	startedAt: string;
	attemptExpiresAt: string | null;
	activeSection: Section | null;
	sectionExpiresAt: string | null;
	quiz: Pick<QuizSummary, 'id' | 'title' | 'mode' | 'level'>;
	progress: { answered: number; total: number };
	sections: { name: Section; expiresAt: string | null; open: boolean }[];
	questions: { number: number; section: Section; answered: boolean; href: string }[];
	links: {
		self: string;
		abandonment: string;
		submission: string;
		result: string;
	};
};

export type ImageMedia = {
	id: string;
	url: string;
	mimeType: string | null;
	width: number | null;
	height: number | null;
	altText: string | null;
};

export type AudioMedia = {
	id: string;
	url: string;
	mimeType: string | null;
	durationMs: number | null;
	transcript?: string | null;
};

export type Stimulus = {
	id: string;
	type: GroupFormat;
	title: string | null;
	instruction: string | null;
	body: string | null;
	bodyTranslation: string | null;
	example: {
		text: string;
		transliteration: string | null;
		translation: string | null;
	} | null;
	image: ImageMedia | null;
	audio: AudioMedia | null;
};

type Prompt = { text: string; translation: string | null };

export type QuestionPresentation =
	| { type: 'STANDARD'; prompt: Prompt }
	| {
			type: 'VOCABULARY_MEANING' | 'KANJI_READING';
			prompt: Prompt;
			focus: { text: string | null; reading: string | null };
	  }
	| {
			type: 'GRAMMAR_CLOZE';
			prompt: Prompt;
			context: { text: string | null; transliteration: string | null };
			studyAid: Stimulus | null;
	  }
	| {
			type: 'READING_COMPREHENSION' | 'LISTENING_COMPREHENSION';
			prompt: Prompt;
			stimulus: Stimulus | null;
	  };

export type QuizOption = { number: number; body: string };

export type AttemptQuestion = {
	attemptId: string;
	attemptStatus: AttemptStatus;
	serverTime: string;
	number: number;
	section: Section;
	points: number;
	stem: string;
	presentation: QuestionPresentation;
	image: ImageMedia | null;
	audio: AudioMedia | null;
	options: QuizOption[];
	selectedOptionNumber: number | null;
	progress: { current: number; total: number; answered: number };
	canAnswer: boolean;
	links: {
		attempt: string;
		answer: string;
		previous: string | null;
		next: string | null;
	};
};

export type ResultQuestion = Omit<
	AttemptQuestion,
	'attemptId' | 'attemptStatus' | 'serverTime' | 'progress' | 'canAnswer' | 'links'
> & {
	explanation: string | null;
	correctOptionNumber: number | null;
	isCorrect: boolean;
	pointsEarned: number;
};

export type QuizResult = {
	attempt: {
		id: string;
		status: AttemptStatus;
		startedAt: string;
		submittedAt: string | null;
		durationMs: number | null;
		rawScore: number | null;
		rawMax: number | null;
		correctCount: number | null;
		questionCount: number | null;
		scaledTotal: number | null;
		passed: boolean | null;
	};
	quiz: {
		id: string;
		title: string;
		mode: QuizMode;
		level: JlptLevel;
		scaledTotalMax: number | null;
		passMarkTotal: number | null;
	};
	reward: { xpAwarded: number };
	summary: {
		accuracyPercent: number;
		correctCount: number;
		incorrectCount: number;
		unansweredCount: number;
		durationMs: number | null;
	};
	bandScores: {
		bandCode: ScoringBand;
		label: string;
		scaledScore: number;
		scaledMax: number;
		passMark: number | null;
		passed: boolean | null;
	}[];
	questions: ResultQuestion[];
	links: { attempt: string; quiz: string; retry: string };
};

export function stimulusFor(question: AttemptQuestion | ResultQuestion): Stimulus | null {
	switch (question.presentation.type) {
		case 'GRAMMAR_CLOZE':
			return question.presentation.studyAid;
		case 'READING_COMPREHENSION':
		case 'LISTENING_COMPREHENSION':
			return question.presentation.stimulus;
		default:
			return null;
	}
}

export function questionFormat(question: AttemptQuestion | ResultQuestion): QuestionFormat {
	return question.presentation.type;
}
