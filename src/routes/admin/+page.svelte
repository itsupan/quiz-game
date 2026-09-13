<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mx-auto max-w-[1400px] py-8">
	<!-- Header -->
	<header class="mb-10 flex items-end justify-between px-8">
		<div class="flex items-end">
			<!-- Solid Red Block -->
			<div class="mr-4 h-16 w-12 shrink-0 bg-brand-red"></div>
			<!-- Titles -->
			<div class="flex flex-col justify-end border-b-2 border-brand-red pb-1">
				<div class="mb-1 text-[10px] font-bold tracking-widest text-muted uppercase">
					SYSTEM OVERVIEW
				</div>
				<h1 class="m-0 text-4xl leading-none font-black tracking-wide text-ink uppercase">
					DASHBOARD
				</h1>
			</div>
		</div>
		<div class="pb-1 text-right">
			<div class="mb-1 text-xs font-bold tracking-widest text-brand-red uppercase">
				GUANLI MIANBAN
			</div>
			<div class="text-[10px] font-bold tracking-widest text-muted uppercase">STATUS: ONLINE</div>
		</div>
	</header>

	<!-- Cards -->
	<div class="mb-8 grid grid-cols-1 gap-6 px-8 md:grid-cols-3">
		<!-- Card 1 -->
		<div class="relative flex h-full flex-col overflow-hidden border border-ink bg-stone-100 p-6">
			<div
				class="absolute top-0 right-0 flex h-12 w-12 items-center justify-center border-b border-l border-ink bg-paper p-2"
			>
				<i class="fi fi-rs-users text-xl text-brand-red" aria-hidden="true"></i>
			</div>
			<div class="relative z-10 flex h-full flex-col">
				<h2 class="m-0 mb-6 text-xs font-bold tracking-wider text-muted uppercase">
					TOTAL STUDENTS
				</h2>
				<div
					data-testid="total-users"
					class="mb-6 text-6xl leading-none font-black tracking-tighter text-ink tabular-nums"
				>
					{data.overview.users?.total?.toLocaleString() || 0}
				</div>
				<div class="relative mt-auto h-px w-full bg-ink/20">
					<div class="absolute top-0 left-0 h-full w-3/4 bg-brand-red"></div>
				</div>
				<div
					class="mt-4 flex items-center justify-between text-[10px] font-bold tracking-widest uppercase"
				>
					<span class="flex items-center gap-1.5 text-brand-red"
						><i class="fi fi-rs-arrow-trend-up" aria-hidden="true"></i>
						{data.overview.attempts?.lastSevenDays?.toLocaleString() || 0} ATTEMPTS</span
					>
					<span class="text-muted"
						>{data.overview.attempts?.total?.toLocaleString() || 0} TOTAL</span
					>
				</div>
			</div>
		</div>

		<!-- Card 2 -->
		<div class="relative flex h-full flex-col overflow-hidden border border-ink bg-stone-100 p-6">
			<div
				class="absolute top-0 right-0 flex h-12 w-12 items-center justify-center border-b border-l border-ink bg-paper p-2"
			>
				<i class="fi fi-rs-document text-xl text-brand-red" aria-hidden="true"></i>
			</div>
			<div class="relative z-10 flex h-full flex-col">
				<h2 class="m-0 mb-6 text-xs font-bold tracking-wider text-muted uppercase">
					ACTIVE QUIZZES
				</h2>
				<div
					data-testid="total-quizzes"
					class="mb-6 text-6xl leading-none font-black tracking-tighter text-ink tabular-nums"
				>
					{data.overview.quizzes?.total?.toLocaleString() || 0}
				</div>
				<div class="relative mt-auto h-px w-full bg-ink/20">
					<div class="absolute top-0 left-0 h-full w-1/3 bg-brand-red"></div>
				</div>
				<div
					class="mt-4 flex items-center justify-between text-[10px] font-bold tracking-widest uppercase"
				>
					<span class="flex items-center gap-1.5 text-ink"
						><i class="fi fi-rs-rotate-right" aria-hidden="true"></i>
						{data.overview.quizzes?.draft || 0} SYNCING</span
					>
					<span class="text-muted">LIVE</span>
				</div>
			</div>
		</div>

		<!-- Card 3 -->
		<div
			class="relative flex h-full flex-col overflow-hidden border border-ink bg-brand-red p-6 text-white"
		>
			<!-- Watermark icon -->
			<i
				class="fi fi-rs-interrogation pointer-events-none absolute -right-6 -bottom-6 rotate-12 transform text-[8rem] opacity-[0.15]"
				aria-hidden="true"
			></i>
			<div class="relative z-10 flex h-full flex-col">
				<h2 class="m-0 mb-6 text-xs font-bold tracking-wider text-white/70 uppercase">
					QUESTIONS BANK
				</h2>
				<div
					data-testid="total-questions"
					class="mb-6 text-6xl leading-none font-black tracking-tighter text-white tabular-nums"
				>
					{data.overview.questions?.total?.toLocaleString() || 0}
				</div>
				<div class="relative mt-auto h-px w-full bg-white/30">
					<div class="absolute top-0 left-0 h-full w-full bg-white"></div>
				</div>
				<div
					class="mt-4 flex items-center justify-between text-[10px] font-bold tracking-widest text-white uppercase"
				>
					<span class="flex items-center gap-1.5"
						><i class="fi fi-rs-plus-small text-base" aria-hidden="true"></i>
						{data.overview.questions?.published?.toLocaleString() || 0} PUBLISHED</span
					>
					<span class="text-white/70"
						>{data.overview.questions?.draft?.toLocaleString() || 0} DRAFTS</span
					>
				</div>
			</div>
		</div>
	</div>

	<!-- Bottom Section -->
	<div class="grid grid-cols-1 gap-6 px-8 lg:grid-cols-[1fr_320px]">
		<!-- Recent Activity -->
		<div class="flex flex-col border border-ink bg-paper">
			<div class="flex items-center justify-between border-b border-ink bg-stone-50 p-4">
				<h2 class="m-0 flex items-center gap-3 text-sm font-bold tracking-widest uppercase">
					<i class="fi fi-rs-time-past text-lg text-brand-red" aria-hidden="true"></i>
					RECENT ACTIVITY
				</h2>
				<a
					href={resolve('/admin/logs')}
					class="border border-ink bg-white px-3 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors hover:bg-stone-100"
				>
					VIEW ALL
				</a>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full border-collapse text-left">
					<thead>
						<tr class="border-b border-ink bg-stone-50">
							<th
								class="w-16 px-4 py-3 text-center text-[10px] font-bold tracking-widest text-ink uppercase"
								>NO.</th
							>
							<th class="px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
								>ACTION</th
							>
							<th class="px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
								>USER</th
							>
							<th
								class="px-4 py-3 text-right text-[10px] font-bold tracking-widest text-ink uppercase"
								>TIME</th
							>
						</tr>
					</thead>
					<tbody class="text-xs">
						{#each data.recentActivity || [] as log, i (log.id)}
							<tr class="border-b border-ink transition-colors last:border-b-0 hover:bg-stone-50">
								<td class="px-4 py-4 text-center font-bold">{String(i + 1).padStart(2, '0')}</td>
								<td class="px-4 py-4">{log.action?.replace(/_/g, ' ')}: {log.entityLabel}</td>
								<td class="px-4 py-4">
									<div class="flex items-center gap-3">
										<div
											class="flex h-6 w-6 shrink-0 items-center justify-center border border-ink bg-stone-100"
										>
											<i
												class="fi {log.actorName ? 'fi-rs-user' : 'fi-rs-apps'} text-[10px]"
												aria-hidden="true"
											></i>
										</div>
										<span>{log.actorName || 'System'}</span>
									</div>
								</td>
								<td class="px-4 py-4 text-right font-mono text-[10px] text-muted">
									{new Intl.DateTimeFormat('en-US', {
										month: 'short',
										day: 'numeric',
										hour: 'numeric',
										minute: '2-digit'
									}).format(log.createdAt ? new Date(log.createdAt) : new Date())}
								</td>
							</tr>
						{/each}
						{#if !data.recentActivity || data.recentActivity.length === 0}
							<tr>
								<td
									colspan="4"
									class="p-8 text-center text-[10px] font-bold tracking-widest text-muted uppercase"
									>No recent activity</td
								>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Quick Actions -->
		<div class="relative flex h-full flex-col border border-ink bg-stone-50">
			<div class="flex items-center gap-3 border-b border-ink p-5">
				<i class="fi fi-rs-bolt text-lg text-ink" aria-hidden="true"></i>
				<h2 class="m-0 text-sm font-bold tracking-widest uppercase">QUICK ACTIONS</h2>
			</div>

			<div class="flex flex-1 flex-col gap-4 p-6">
				<a
					href={resolve('/admin/quizzes/new')}
					class="group flex w-full items-center justify-between border border-ink bg-white p-3 transition-colors hover:border-brand-red hover:text-brand-red"
				>
					<div class="flex items-center gap-4">
						<div
							class="flex h-7 w-7 items-center justify-center border border-ink bg-stone-50 transition-colors group-hover:border-brand-red"
						>
							<i class="fi fi-rs-document" aria-hidden="true"></i>
						</div>
						<span
							class="text-xs font-bold tracking-widest text-ink uppercase transition-colors group-hover:text-brand-red"
							>DRAFT NEW QUIZ</span
						>
					</div>
					<i
						class="fi fi-rs-arrow-right text-muted transition-colors group-hover:text-brand-red"
						aria-hidden="true"
					></i>
				</a>
				<a
					href={resolve('/admin/users')}
					class="group flex w-full items-center justify-between border border-ink bg-white p-3 transition-colors hover:border-brand-red hover:text-brand-red"
				>
					<div class="flex items-center gap-4">
						<div
							class="flex h-7 w-7 items-center justify-center border border-ink bg-stone-50 transition-colors group-hover:border-brand-red"
						>
							<i class="fi fi-rs-user-add" aria-hidden="true"></i>
						</div>
						<span
							class="text-xs font-bold tracking-widest text-ink uppercase transition-colors group-hover:text-brand-red"
							>INVITE ADMINS</span
						>
					</div>
					<i
						class="fi fi-rs-arrow-right text-muted transition-colors group-hover:text-brand-red"
						aria-hidden="true"
					></i>
				</a>
				<a
					href={resolve('/admin/users')}
					class="group flex w-full items-center justify-between border border-ink bg-white p-3 transition-colors hover:border-brand-red hover:text-brand-red"
				>
					<div class="flex items-center gap-4">
						<div
							class="flex h-7 w-7 items-center justify-center border border-ink bg-stone-50 transition-colors group-hover:border-brand-red"
						>
							<i class="fi fi-rs-stats" aria-hidden="true"></i>
						</div>
						<span
							class="text-xs font-bold tracking-widest text-ink uppercase transition-colors group-hover:text-brand-red"
							>GENERATE REPORT</span
						>
					</div>
					<i
						class="fi fi-rs-arrow-right text-muted transition-colors group-hover:text-brand-red"
						aria-hidden="true"
					></i>
				</a>
			</div>

			<div
				class="mt-auto flex items-center justify-between border-t border-ink bg-white p-5 text-[10px] font-bold tracking-widest uppercase"
			>
				<span>SYSTEM HEALTH</span>
				<span class="flex items-center gap-2 text-ink">
					<span class="h-2 w-2 rounded-full bg-brand-red"></span> OPTIMAL
				</span>
			</div>
		</div>
	</div>
</div>
