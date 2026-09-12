<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Mock Data — no achievements system or global ranking exists yet, so this section
	// stays illustrative until that backend does. Name and avatar above it are real.
	const profile = {
		level: 42,
		tier: 'PRO',
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

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<span class="h-8 w-1.5 bg-brand-red" aria-hidden="true"></span>
		<h1 class="text-2xl font-black tracking-tight text-ink uppercase">Profile</h1>
	</div>

	<!-- Top Row: Profile & Rank -->
	<div class="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
		<!-- Profile Card -->
		<div class="flex flex-col border-2 border-ink bg-paper p-6 sm:flex-row sm:gap-6">
			<!-- Avatar Area -->
			<div
				class="relative mb-4 flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden border-2 border-ink bg-stone-200 sm:mb-0"
			>
				{#if data.avatarUrl}
					<img src={data.avatarUrl} alt="" class="h-full w-full object-cover" />
				{:else}
					<span class="text-4xl font-black text-stone-400"
						>{data.name.slice(0, 1).toUpperCase()}</span
					>
				{/if}
				<a
					href={resolve('/profile/settings')}
					aria-label="Change profile photo"
					class="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center bg-brand-red text-white transition-colors hover:bg-brand-red-dark"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
						/></svg
					>
				</a>
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
						>{profile.tier}</span
					>
				</div>
				<h2 class="mb-2 text-2xl font-black text-ink">{data.name}</h2>
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
		<div class="flex flex-col border-2 border-ink bg-stone-50 p-6">
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
	<div>
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
			<a
				href={resolve('/profile/settings')}
				class="flex w-full items-center justify-between border border-ink bg-paper p-4 transition-colors hover:bg-stone-50"
			>
				<span class="text-sm font-bold text-ink">Edit Personal Information</span>
				<span class="text-ink">→</span>
			</a>
			<a
				href={resolve('/profile/settings')}
				class="flex w-full items-center justify-between border border-ink bg-paper p-4 transition-colors hover:bg-stone-50"
			>
				<span class="text-sm font-bold text-ink">Security &amp; Password</span>
				<span class="text-ink">→</span>
			</a>
			<div
				class="flex w-full items-center justify-between border border-line bg-stone-50 p-4 text-stone-400"
			>
				<span class="text-sm font-bold">Notification Preferences</span>
				<span class="text-[10px] font-bold tracking-widest uppercase">Coming soon</span>
			</div>

			<form method="POST" action={resolve('/auth/signout')} class="mt-4">
				<button
					type="submit"
					class="flex w-full items-center justify-center gap-2 border border-brand-red bg-paper p-4 text-brand-red transition-colors hover:bg-danger-soft"
				>
					<span class="text-sm font-bold tracking-widest uppercase">Sign Out</span>
				</button>
			</form>
		</div>
	</div>
</div>
