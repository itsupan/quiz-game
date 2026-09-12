<script lang="ts">
	import { resolve } from '$app/paths';

	// Mock Data
	const progress = [
		{ label: 'Vocabulary', value: 85, colorClass: 'bg-brand-red', textClass: 'text-brand-red' },
		{ label: 'Grammar', value: 62, colorClass: 'bg-ink', textClass: 'text-ink' },
		{ label: 'Listening', value: 40, colorClass: 'bg-stone-500', textClass: 'text-ink' }
	];

	const exams = [
		{
			date: '2023.10.24',
			name: 'JLPT N5 Mock Exam Alpha',
			category: 'Comprehensive',
			score: 142,
			maxScore: 180,
			status: 'pass',
			scoreClass: 'text-brand-red'
		},
		{
			date: '2023.10.15',
			name: 'Advanced Conjugation Drill',
			category: 'Grammar',
			score: 88,
			maxScore: 100,
			status: 'neutral',
			scoreClass: 'text-ink'
		},
		{
			date: '2023.10.02',
			name: 'Kanji Set 04 - Nature',
			category: 'Vocabulary',
			score: 65,
			maxScore: 100,
			status: 'alert',
			scoreClass: 'text-stone-500'
		}
	];
</script>

<svelte:head>
	<title>Analytics | QuizGame</title>
</svelte:head>

<div class="mx-auto max-w-5xl pb-16">
	<!-- Header -->
	<div class="mb-12 border-b border-ink pb-6">
		<div class="flex flex-col justify-between md:flex-row md:items-end">
			<div class="flex items-start gap-4 md:gap-6">
				<div class="h-20 w-12 bg-brand-red md:h-24 md:w-14"></div>
				<div class="flex flex-col md:flex-row md:items-start md:gap-4">
					<div class="flex items-baseline gap-2">
						<span class="text-6xl font-black tracking-tighter text-ink md:text-7xl">04</span>
						<span class="text-4xl font-black text-stone-400 md:text-5xl">/</span>
					</div>
					<div class="mt-2 flex flex-col justify-end md:mt-0 md:h-full md:pb-2">
						<span class="text-[10px] font-bold tracking-widest text-stone-500 uppercase"
							>Seiseki Bunseki</span
						>
						<h1 class="text-3xl font-black tracking-tight text-ink uppercase md:text-4xl">
							Performance
						</h1>
					</div>
				</div>
			</div>
			<div class="mt-4 max-w-xs text-xs font-bold text-stone-500 md:mt-0 md:text-right">
				Data tracking and analytical breakdown of recent learning cycles.
			</div>
		</div>
	</div>

	<!-- Top Grid Section -->
	<div class="mb-20 grid grid-cols-1 gap-12 lg:grid-cols-[1.5fr_1fr]">
		<!-- Weekly Progress -->
		<div>
			<div class="mb-4 flex items-center justify-between border-b border-ink pb-2">
				<div class="flex items-center gap-2">
					<div class="bg-brand-red px-2 py-0.5">
						<span class="text-[10px] font-bold tracking-widest text-white uppercase">Progress</span>
					</div>
					<h2 class="text-lg font-black text-ink uppercase">Weekly Progress</h2>
				</div>
			</div>

			<div class="border border-ink bg-stone-50 p-6 md:p-8">
				{#each progress as item (item.label)}
					<div class="mb-6 last:mb-0">
						<div class="mb-2 flex justify-between font-bold">
							<span class="text-sm text-ink">{item.label}</span>
							<span class="text-sm {item.textClass}">{item.value}%</span>
						</div>
						<div class="h-2 w-full bg-stone-200">
							<div class="h-full {item.colorClass}" style="width: {item.value}%"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Kanji Mastery -->
		<div>
			<div class="mb-4 flex items-center justify-between border-b border-ink pb-2">
				<h2 class="text-lg font-black text-ink uppercase">Kanji Mastery</h2>
				<div class="bg-ink px-2 py-0.5">
					<span class="text-[10px] font-bold tracking-widest text-white uppercase">Stats</span>
				</div>
			</div>

			<div class="mb-4 grid grid-cols-2 gap-4">
				<div class="border border-ink bg-white p-4 md:p-6">
					<div class="mb-2 text-[10px] font-bold tracking-widest text-stone-500 uppercase">
						Learned
					</div>
					<div class="text-4xl font-black text-brand-red md:text-5xl">428</div>
				</div>
				<div class="border border-ink bg-white p-4 md:p-6">
					<div class="mb-2 text-[10px] font-bold tracking-widest text-stone-500 uppercase">
						Review
					</div>
					<div class="text-4xl font-black text-ink md:text-5xl">89</div>
				</div>
			</div>

			<div class="flex items-center justify-between bg-ink p-5 md:p-6">
				<div>
					<div class="mb-1 text-[10px] font-bold tracking-widest text-stone-400 uppercase">
						N4 Target
					</div>
					<div class="text-lg font-medium text-white md:text-xl">1500 kanji</div>
				</div>

				<!-- Circular Progress Ring -->
				<div class="relative flex h-14 w-14 items-center justify-center md:h-16 md:w-16">
					<svg class="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
						<path
							class="text-stone-800"
							stroke-width="3"
							stroke="currentColor"
							fill="none"
							d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
						/>
						<path
							class="text-brand-red"
							stroke-dasharray="28, 100"
							stroke-width="3"
							stroke-linecap="round"
							stroke="currentColor"
							fill="none"
							d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
						/>
					</svg>
					<span class="relative text-xs font-bold text-brand-red md:text-sm">28%</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Exam Scores Table -->
	<div>
		<div class="mb-6 flex items-end justify-between border-b border-line pb-2">
			<div class="flex items-center gap-3">
				<div class="h-6 w-1.5 bg-brand-red"></div>
				<h2 class="text-2xl font-black tracking-tight text-ink uppercase">Exam Scores</h2>
			</div>
			<a
				href={resolve('/analytics')}
				class="border-b border-ink pb-0.5 text-[10px] font-bold tracking-widest text-stone-500 uppercase transition-colors hover:text-ink"
			>
				View All Exams
			</a>
		</div>

		<div class="w-full overflow-x-auto border-2 border-ink bg-white">
			<table class="w-full min-w-[700px] text-left">
				<thead class="bg-stone-50">
					<tr>
						<th
							class="border-b border-ink px-6 py-4 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
							>Date</th
						>
						<th
							class="border-b border-ink px-6 py-4 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
							>Exam Name</th
						>
						<th
							class="border-b border-ink px-6 py-4 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
							>Category</th
						>
						<th
							class="border-b border-ink px-6 py-4 text-right text-[10px] font-bold tracking-widest text-stone-500 uppercase"
							>Score</th
						>
						<th
							class="border-b border-ink px-6 py-4 text-center text-[10px] font-bold tracking-widest text-stone-500 uppercase"
							>Status</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-line">
					{#each exams as exam (exam.name)}
						<tr>
							<td class="px-6 py-5 text-sm font-bold tracking-wider text-ink">{exam.date}</td>
							<td class="px-6 py-5 text-sm text-ink">{exam.name}</td>
							<td class="px-6 py-5">
								<span class="border border-line px-2 py-1 text-[10px] text-stone-600"
									>{exam.category}</span
								>
							</td>
							<td class="px-6 py-5 text-right font-bold">
								<span class="text-2xl {exam.scoreClass}">{exam.score}</span>
								<span class="text-sm text-stone-500">/{exam.maxScore}</span>
							</td>
							<td class="px-6 py-5 text-center">
								{#if exam.status === 'pass'}
									<svg
										class="mx-auto h-6 w-6 text-brand-red"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								{:else if exam.status === 'neutral'}
									<svg
										class="mx-auto h-6 w-6 text-stone-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<circle cx="12" cy="12" r="9" stroke-width="2" />
									</svg>
								{:else}
									<svg
										class="mx-auto h-6 w-6 text-brand-red"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
