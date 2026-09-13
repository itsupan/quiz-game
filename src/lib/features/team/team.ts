export type TeamLink = {
	label: 'GitHub' | 'LinkedIn' | 'Portfolio';
	href: string;
};

export type TeamMember = {
	id: string;
	name: string;
	role: string;
	discipline: string;
	owns: string;
	contributions: readonly string[];
	imageUrl: string;
	mark: string;
	motif: string;
	motifDescription: string;
	principle: string;
	links: readonly TeamLink[];
	portraitApproval: 'pending' | 'approved';
};

/**
 * Public role titles remain deliberately conservative until each member approves
 * their exact title. Discipline and ownership communicate distinct responsibilities
 * without inventing organizational rank.
 */
export const teamMembers: readonly TeamMember[] = [
	{
		id: 'inheang',
		name: 'Inheang',
		role: 'Full-stack Developer',
		discipline: 'Interface & platform',
		owns: 'Clear product interfaces and the dependable systems behind them.',
		contributions: ['Admin interfaces', 'User management', 'Product foundations'],
		imageUrl: '/team/inheang-samurai.webp',
		mark: '01',
		motif: 'Code grid',
		motifDescription: 'A measured grid representing systems that stay understandable.',
		principle: 'Make every layer legible.',
		links: [],
		portraitApproval: 'pending'
	},
	{
		id: 'makara',
		name: 'Makara',
		role: 'Full-stack Developer',
		discipline: 'Learner experience',
		owns: 'Accessible learning experiences carried from the first idea into production.',
		contributions: ['Learner experience', 'Shared design system', 'Authentication flows'],
		imageUrl: '/team/makara-samurai.webp',
		mark: '02',
		motif: 'Folded map',
		motifDescription: 'A navigational mark representing clear paths through the product.',
		principle: 'Make the next step obvious.',
		links: [],
		portraitApproval: 'pending'
	},
	{
		id: 'sothy',
		name: 'Sothy',
		role: 'Full-stack Developer',
		discipline: 'Quiz systems & insight',
		owns: 'The connection between quiz logic, product data and useful learner feedback.',
		contributions: ['Quiz engine', 'Learner APIs', 'Analytics & leaderboard'],
		imageUrl: '/team/sothy-samurai.webp',
		mark: '03',
		motif: 'Constellation',
		motifDescription: 'Connected points representing questions becoming useful insight.',
		principle: 'Turn every answer into direction.',
		links: [],
		portraitApproval: 'pending'
	},
	{
		id: 'soksan',
		name: 'SokSan',
		role: 'Full-stack Developer',
		discipline: 'Content operations & quality',
		owns: 'Content workflows and quality controls the whole team can trust.',
		contributions: ['Content operations', 'Admin workflows', 'Quality assurance'],
		imageUrl: '/team/soksan-samurai.webp',
		mark: '04',
		motif: 'Shield tiles',
		motifDescription: 'Interlocking tiles representing repeatable checks and resilient workflows.',
		principle: 'Trust is built into the workflow.',
		links: [],
		portraitApproval: 'pending'
	},
	{
		id: 'pich',
		name: 'Pich',
		role: 'Full-stack Developer',
		discipline: 'Product engineering',
		owns: 'Features carried from first idea to a reliable release.',
		contributions: ['Feature delivery', 'Testing', 'Team support'],
		imageUrl: '/team/pich-samurai.webp',
		mark: '05',
		motif: 'Seigaiha waves',
		motifDescription: 'Overlapping waves representing steady, repeated progress.',
		principle: 'Keep moving forward.',
		links: [],
		portraitApproval: 'pending'
	}
];
