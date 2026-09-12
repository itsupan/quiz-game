<script lang="ts">
	// Mock Data
	const profile = {
		name: 'Alex Kenji',
		level: 42,
		role: 'PRO',
		description:
			'Dedicated language learner focusing on JLPT N3 vocabulary. Consistent daily practice with a streak of 45 days. Aiming for fluency by next year.',
		joined: 'Mar 2023',
		location: 'Tokyo, JP',
		rank: 128,
		totalUsers: '10,432',
		percentile: '1.2%',
		nextRank: 'Gold',
		nextRankXp: '850 XP'
	};

	const achievements = [
		{
			title: '30 Day Streak',
			description: 'Completed a quiz every day for a month.',
			icon: 'fire',
			colorClass: 'bg-brand-red text-white'
		},
		{
			title: 'Perfect Score N4',
			description: 'Scored 100% on N4 Kanji test.',
			icon: 'star',
			colorClass: 'bg-stone-100 text-ink'
		},
		{
			title: 'Vocabulary Master',
			description: 'Learn 1000 new words. (840/1000)',
			icon: 'brain',
			colorClass: 'bg-stone-50 text-stone-400 border-stone-200'
		},
		{
			title: 'Speed Demon',
			description: 'Answer 50 questions in under 2 mins.',
			icon: 'clock',
			colorClass: 'bg-stone-50 text-stone-400 border-stone-200'
		}
	];
</script>

<svelte:head>
	<title>Profile | QuizGame</title>
</svelte:head>

<!-- We use a negative margin on mobile to push to edges, but respect the container on large screens -->
<div class="flex min-h-[calc(100vh-10rem)] flex-col border-2 border-ink bg-paper md:flex-row">
	<!-- Sidebar -->
	<div
		class="w-full shrink-0 border-b-2 border-ink bg-stone-50 md:w-64 md:border-r-2 md:border-b-0"
	>
		<div class="p-6">
			<h2 class="text-lg font-black text-ink">Admin Portal</h2>
			<p class="text-sm font-medium text-stone-500">System Control</p>
		</div>
		<div class="border-t-2 border-ink"></div>
		<nav class="flex flex-col gap-1 p-4">
			<!-- Note: Icons would be replaced with actual SVG paths -->
			<a
				href="#/"
				class="flex items-center gap-3 px-3 py-2 text-xs font-bold tracking-widest text-ink uppercase hover:bg-stone-200"
				>Overview</a
			>
			<a
				href="#/"
				class="flex items-center gap-3 px-3 py-2 text-xs font-bold tracking-widest text-ink uppercase hover:bg-stone-200"
				>User Management</a
			>
			<a
				href="#/"
				class="flex items-center gap-3 px-3 py-2 text-xs font-bold tracking-widest text-ink uppercase hover:bg-stone-200"
				>Quiz Sets</a
			>
			<a
				href="#/"
				class="flex items-center gap-3 px-3 py-2 text-xs font-bold tracking-widest text-ink uppercase hover:bg-stone-200"
				>Question Bank</a
			>
			<a
				href="#/"
				class="flex items-center gap-3 px-3 py-2 text-xs font-bold tracking-widest text-ink uppercase hover:bg-stone-200"
				>System Logs</a
			>
		</nav>
		<div class="p-4">
			<button
				class="w-full bg-brand-red py-3 text-xs font-bold tracking-widest text-white uppercase transition-colors hover:bg-brand-red-dark"
			>
				Create New Set
			</button>
		</div>
		<div class="mt-auto border-t-2 border-ink">
			<nav class="flex flex-col gap-1 p-4">
				<a
					href="#/"
					class="flex items-center gap-3 px-3 py-2 text-xs font-bold tracking-widest text-ink uppercase hover:bg-stone-200"
					>Settings</a
				>
				<a
					href="#/"
					class="flex items-center gap-3 px-3 py-2 text-xs font-bold tracking-widest text-ink uppercase hover:bg-stone-200"
					>Logout</a
				>
			</nav>
		</div>
	</div>

	<!-- Main Profile Content -->
	<div class="flex-1 p-6 md:p-10 lg:p-16">
		<!-- Header -->
		<div class="mb-12 flex items-center gap-3">
			<div class="bg-brand-red px-2 py-1">
				<span class="text-3xl font-black text-white">05</span>
			</div>
			<span class="text-3xl font-light text-stone-400">\</span>
			<h1 class="text-3xl font-black tracking-tight text-ink uppercase">Profile</h1>
		</div>

		<!-- Top Row: Profile & Rank -->
		<div class="mb-12 grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
			<!-- Profile Card -->
			<div class="flex flex-col border border-ink bg-paper p-6 sm:flex-row sm:gap-6">
				<!-- Avatar Area -->
				<div class="relative mb-4 h-32 w-32 shrink-0 border-2 border-ink bg-stone-200 sm:mb-0">
					<!-- Edit Button -->
					<button
						class="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center bg-brand-red text-white transition-colors hover:bg-brand-red-dark"
					>
						<!-- Pencil Icon -->
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
							/></svg
						>
					</button>
				</div>

				<!-- Info Area -->
				<div class="flex flex-1 flex-col">
					<div class="mb-2 flex items-center gap-2">
						<span
							class="bg-brand-red px-2 py-0.5 text-[10px] font-bold tracking-widest text-white uppercase"
							>Level {profile.level}</span
						>
						<span
							class="bg-ink px-2 py-0.5 text-[10px] font-bold tracking-widest text-white uppercase"
							>{profile.role}</span
						>
					</div>
					<h2 class="mb-2 text-2xl font-black text-ink">{profile.name}</h2>
					<p class="mb-4 text-sm leading-relaxed font-medium text-stone-600">
						{profile.description}
					</p>

					<div class="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-3">
						<div class="flex items-center gap-1.5 border border-ink px-2 py-1">
							<span class="text-[10px] font-bold tracking-widest text-ink uppercase"
								>Joined {profile.joined}</span
							>
						</div>
						<div class="flex items-center gap-1.5 border border-ink px-2 py-1">
							<span class="text-[10px] font-bold tracking-widest text-ink uppercase"
								>{profile.location}</span
							>
						</div>
					</div>
				</div>
			</div>

			<!-- Rank Card -->
			<div class="flex flex-col border border-ink bg-stone-50 p-6">
				<div class="mb-4 flex items-center gap-2 border-b border-ink pb-2">
					<span class="font-bold text-brand-red">#</span>
					<span class="text-xs font-bold tracking-widest text-ink uppercase">Current Rank</span>
				</div>
				<div class="mb-1 flex items-baseline gap-1">
					<span class="text-6xl font-black text-ink">{profile.rank}</span>
					<span class="text-sm font-bold text-stone-500">/{profile.totalUsers}</span>
				</div>
				<p class="mb-8 text-xs font-bold tracking-widest text-stone-500 uppercase">
					Top {profile.percentile} Globally
				</p>

				<div class="mt-auto">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-[10px] font-bold tracking-widest text-ink uppercase"
							>Next Rank ({profile.nextRank})</span
						>
						<span class="text-[10px] font-bold tracking-widest text-ink uppercase"
							>{profile.nextRankXp}</span
						>
					</div>
					<div class="h-1.5 w-full bg-stone-200">
						<div class="h-full bg-brand-red" style="width: 75%"></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Achievements Section -->
		<div class="mb-12">
			<div class="mb-6 flex items-center gap-3">
				<div class="h-6 w-1.5 bg-brand-red"></div>
				<h2 class="text-2xl font-black tracking-tight text-ink uppercase">Achievements</h2>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each achievements as badge (badge.title)}
					<div
						class="flex flex-col items-center border border-ink bg-paper p-6 text-center {badge.colorClass.includes(
							'border-stone-200'
						)
							? 'border-stone-200'
							: ''}"
					>
						<div
							class="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink {badge.colorClass}"
						>
							<!-- Icon placeholder -->
							<span class="text-xl font-bold">O</span>
						</div>
						<h3
							class="mb-2 text-sm font-black text-ink uppercase {badge.colorClass.includes(
								'text-stone-400'
							)
								? 'text-stone-400'
								: ''}"
						>
							{badge.title}
						</h3>
						<p
							class="text-xs font-medium text-stone-500 {badge.colorClass.includes('text-stone-400')
								? 'text-stone-300'
								: ''}"
						>
							{badge.description}
						</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Account Settings Section -->
		<div>
			<div class="mb-6 flex items-center gap-3">
				<div class="h-6 w-1.5 bg-ink"></div>
				<h2 class="text-2xl font-black tracking-tight text-ink uppercase">Account Settings</h2>
			</div>

			<div class="flex flex-col gap-3">
				<button
					class="flex w-full items-center justify-between border border-ink bg-paper p-4 transition-colors hover:bg-stone-50"
				>
					<span class="text-sm font-bold text-ink">Edit Personal Information</span>
					<span class="text-ink">→</span>
				</button>
				<button
					class="flex w-full items-center justify-between border border-ink bg-paper p-4 transition-colors hover:bg-stone-50"
				>
					<span class="text-sm font-bold text-ink">Security & Password</span>
					<span class="text-ink">→</span>
				</button>
				<button
					class="flex w-full items-center justify-between border border-ink bg-paper p-4 transition-colors hover:bg-stone-50"
				>
					<span class="text-sm font-bold text-ink">Notification Preferences</span>
					<span class="text-ink">→</span>
				</button>

				<button
					class="mt-4 flex w-full items-center justify-center gap-2 border border-brand-red bg-paper p-4 text-brand-red transition-colors hover:bg-danger-soft"
				>
					<span class="text-sm font-bold tracking-widest text-brand-red uppercase">Sign Out</span>
				</button>
			</div>
		</div>
	</div>
</div>
