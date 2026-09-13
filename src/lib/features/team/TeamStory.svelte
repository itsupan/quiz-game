<script lang="ts">
	import { onMount } from 'svelte';
	import LayeredPortrait from './LayeredPortrait.svelte';
	import MemberProfile from './MemberProfile.svelte';
	import TeamCrest from './TeamCrest.svelte';
	import type { TeamMember } from './team';

	type Props = {
		members: readonly TeamMember[];
	};

	let { members }: Props = $props();
	let pageRoot: HTMLElement;

	onMount(() => {
		const sections = pageRoot.querySelectorAll<HTMLElement>('[data-reveal]');

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			sections.forEach((section) => section.classList.add('revealed'));
			return;
		}

		pageRoot.classList.add('motion-ready');
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;

					entry.target.classList.add('revealed');
					observer.unobserve(entry.target);
				}
			},
			{ rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
		);

		sections.forEach((section) => observer.observe(section));
		return () => observer.disconnect();
	});
</script>

<div class="team-page" bind:this={pageRoot}>
	<section class="hero" aria-labelledby="team-title">
		<div class="hero-pattern" aria-hidden="true"></div>
		<div class="sun" aria-hidden="true"></div>
		<div class="brush brush-one" aria-hidden="true"></div>
		<div class="brush brush-two" aria-hidden="true"></div>

		<div class="hero-copy">
			<p class="eyebrow" data-hero-kicker>QuizGame · The makers' dōjō</p>
			<div class="title-mask">
				<h1 id="team-title" data-hero-title>The people behind<br />the challenge.</h1>
			</div>
			<div data-hero-copy>
				<p class="hero-lede">Design, engineering and learning working as one.</p>
				<a class="meet-link" href="#the-roster">
					<span>Meet the team</span>
					<span aria-hidden="true">↓</span>
				</a>
			</div>
		</div>

		<div class="hero-crest" aria-hidden="true">
			<TeamCrest />
		</div>

		<div class="hero-team" aria-hidden="true">
			{#each members as member, index (member.id)}
				<img
					src={member.imageUrl}
					alt=""
					class="hero-person hero-person-{index + 1}"
					loading="eager"
					fetchpriority={index === 0 ? 'high' : 'auto'}
				/>
			{/each}
		</div>

		<p class="hero-coordinate" aria-hidden="true">11.5564° N / 104.9282° E</p>
	</section>

	<section class="story-intro" id="the-roster" aria-labelledby="roster-title" data-reveal>
		<p class="eyebrow ink">Different disciplines · One mission</p>
		<h2 id="roster-title">Built across every layer.</h2>
		<p>
			From the first interaction to the last database query, every detail is shaped by people who
			understand the whole product.
		</p>
	</section>

	<section class="story-layout" aria-label="Team member stories">
		<div class="chapters">
			{#each members as member, index (member.id)}
				<article class="member-panel" id={member.id} data-reveal>
					<div class="portrait-column">
						<LayeredPortrait {member} eager={index < 2} />
					</div>
					<div class="copy-column">
						<MemberProfile {member} compact />
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="formation" aria-labelledby="formation-title" data-reveal>
		<div class="formation-copy">
			<p class="eyebrow">One team · One standard</p>
			<h2 id="formation-title">Built for every learner.</h2>
			<p>
				Different responsibilities move toward the same standard: a learning experience that is
				clear, dependable and worth returning to.
			</p>
		</div>

		<div class="formation-team" aria-hidden="true">
			<div class="formation-sun"></div>
			{#each members as member, index (member.id)}
				<img
					src={member.imageUrl}
					alt=""
					class="formation-person formation-person-{index + 1}"
					loading="lazy"
				/>
			{/each}
		</div>

		<p class="formation-signature">QUIZGAME / EST. 2026</p>
	</section>
</div>

<style>
	.team-page {
		--display-size: clamp(2.4rem, 6.5vw, 6.75rem);
		width: 100vw;
		margin: -2rem calc(50% - 50vw);
		overflow: clip;
		background: var(--color-paper);
	}

	.hero {
		position: relative;
		isolation: isolate;
		height: calc(100svh - 4rem);
		min-height: 34rem;
		overflow: hidden;
		border-bottom: 1px solid #3d3e3e;
		background: var(--color-ink);
		color: var(--color-paper);
	}

	.hero-pattern {
		position: absolute;
		inset: 0;
		z-index: -3;
		background-image: url('/patterns/seigaiha.svg');
		background-repeat: repeat;
		background-size: 8rem 4rem;
		opacity: 0.08;
	}

	.sun {
		position: absolute;
		top: 7%;
		right: 7%;
		z-index: -2;
		width: min(48vw, 43rem);
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--color-brand-red);
	}

	.brush {
		position: absolute;
		z-index: -1;
		background: var(--color-paper);
		opacity: 0.14;
		transform: rotate(-7deg);
		transform-origin: left;
	}

	.brush-one {
		top: 28%;
		left: -4%;
		width: 42%;
		height: 0.8rem;
	}

	.brush-two {
		top: 31%;
		left: 4%;
		width: 25%;
		height: 0.25rem;
	}

	.hero-copy {
		position: relative;
		z-index: 6;
		width: min(58rem, 72vw);
		padding: clamp(3rem, 8vh, 6rem) clamp(1.5rem, 6vw, 6rem) 14rem;
	}

	.eyebrow {
		margin: 0 0 1.25rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.eyebrow {
		color: #f19994;
	}

	.eyebrow.ink {
		color: var(--color-brand-red);
	}

	.title-mask {
		overflow: hidden;
	}

	.hero h1 {
		max-width: 55rem;
		margin: 0;
		font-size: var(--display-size);
		line-height: 0.86;
		letter-spacing: -0.07em;
		text-transform: uppercase;
	}

	.hero-lede {
		max-width: 34rem;
		margin: 1.5rem 0 0;
		font-size: clamp(0.9rem, 1.3vw, 1.1rem);
		color: #d6d2ca;
	}

	.meet-link {
		display: inline-flex;
		align-items: center;
		gap: 1.5rem;
		margin-top: 2rem;
		padding: 0.7rem 0;
		border-bottom: 2px solid var(--color-brand-red);
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.hero-crest {
		position: absolute;
		top: 2rem;
		right: 2rem;
		z-index: 5;
		width: 5rem;
	}

	.hero-team {
		position: absolute;
		right: clamp(-3rem, -1vw, -1rem);
		bottom: -8rem;
		z-index: 7;
		width: min(64vw, 72rem);
		height: min(74vh, 52rem);
		pointer-events: none;
	}

	.hero-person {
		--hero-stagger: 0ms;
		--breathe-delay: 800ms;
		position: absolute;
		bottom: 0;
		width: min(25vw, 24rem);
		height: 100%;
		object-fit: contain;
		object-position: bottom;
		filter: saturate(0.85) contrast(1.05);
	}

	.hero-person-1,
	.formation-person-1 {
		left: 0;
		z-index: 1;
	}

	.hero-person-2,
	.formation-person-2 {
		left: 16.5%;
		z-index: 3;
	}

	.hero-person-2 {
		--hero-stagger: 80ms;
		--breathe-delay: -1.5s;
	}

	.hero-person-3,
	.formation-person-3 {
		left: 33%;
		z-index: 5;
	}

	.hero-person-3 {
		--hero-stagger: 160ms;
		--breathe-delay: -3s;
	}

	.hero-person-4,
	.formation-person-4 {
		left: 49.5%;
		z-index: 4;
	}

	.hero-person-4 {
		--hero-stagger: 240ms;
		--breathe-delay: -4.5s;
	}

	.hero-person-5,
	.formation-person-5 {
		left: 66%;
		z-index: 2;
	}

	.hero-person-5 {
		--hero-stagger: 320ms;
		--breathe-delay: -6s;
	}

	.hero-coordinate,
	.formation-signature {
		position: absolute;
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.15em;
		color: #aaa59c;
	}

	@keyframes hero-rise {
		from {
			transform: translateY(2rem);
		}
		to {
			transform: translateY(0);
		}
	}

	@keyframes hero-title-in {
		from {
			transform: translateY(115%);
		}
		to {
			transform: translateY(0);
		}
	}

	@keyframes hero-person-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes breathe {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-0.55rem);
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		[data-hero-kicker] {
			animation: hero-rise 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
		}

		[data-hero-title] {
			animation: hero-title-in 850ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
		}

		[data-hero-copy] {
			animation: hero-rise 550ms cubic-bezier(0.22, 1, 0.36, 1) 320ms both;
		}

		.hero-person {
			animation:
				hero-person-in 800ms ease-out calc(180ms + var(--hero-stagger)) both,
				breathe 6s ease-in-out var(--breathe-delay) infinite alternate;
		}

		.team-page:global(.motion-ready) .story-intro > *,
		.team-page:global(.motion-ready) .member-panel .portrait-column,
		.team-page:global(.motion-ready) .member-panel .copy-column,
		.team-page:global(.motion-ready) .formation > * {
			transform: translateY(1.75rem);
			transition: transform 650ms cubic-bezier(0.22, 1, 0.36, 1);
		}

		.team-page:global(.motion-ready) .formation:not(:global(.revealed)) .formation-person {
			opacity: 0;
			transform: translateY(7rem);
		}

		.team-page:global(.motion-ready) .formation:not(:global(.revealed)) .formation-copy {
			opacity: 0;
			transform: translateX(-3rem);
		}

		.team-page:global(.motion-ready) .formation:not(:global(.revealed)) .formation-sun {
			opacity: 0;
			transform: scale(0.72);
		}

		.team-page:global(.motion-ready) .formation:not(:global(.revealed)) .formation-signature {
			opacity: 0;
		}

		.team-page:global(.motion-ready) .formation-copy,
		.team-page:global(.motion-ready) .formation-signature,
		.team-page:global(.motion-ready) .formation-person {
			transition:
				opacity 650ms ease-out,
				transform 750ms cubic-bezier(0.22, 1, 0.36, 1);
		}

		.team-page:global(.motion-ready) .formation-sun {
			transform-origin: center;
			transition:
				opacity 500ms ease-out 100ms,
				transform 850ms cubic-bezier(0.22, 1, 0.36, 1) 100ms;
		}

		.team-page:global(.motion-ready) .formation-person-2 {
			transition-delay: 80ms;
		}

		.team-page:global(.motion-ready) .formation-person-3 {
			transition-delay: 160ms;
		}

		.team-page:global(.motion-ready) .formation-person-4 {
			transition-delay: 240ms;
		}

		.team-page:global(.motion-ready) .formation-person-5 {
			transition-delay: 320ms;
		}

		.team-page:global(.motion-ready) .member-panel .copy-column {
			transition-delay: 90ms;
		}

		.team-page:global(.motion-ready) .story-intro:global(.revealed) > *,
		.team-page:global(.motion-ready) .member-panel:global(.revealed) .portrait-column,
		.team-page:global(.motion-ready) .member-panel:global(.revealed) .copy-column,
		.team-page:global(.motion-ready) .formation:global(.revealed) > * {
			transform: translateY(0);
		}
	}

	.hero-coordinate {
		right: 2rem;
		bottom: 1.5rem;
		z-index: 7;
	}

	.story-intro {
		display: grid;
		grid-template-columns: minmax(15rem, 0.7fr) 1.3fr;
		gap: 2rem 8vw;
		padding: clamp(5rem, 12vw, 10rem) max(1.5rem, calc((100vw - 92rem) / 2));
		border-bottom: 1px solid var(--color-ink);
	}

	.story-intro .eyebrow {
		grid-column: 1 / -1;
		margin-bottom: 0;
	}

	.story-intro h2,
	.formation h2 {
		margin: 0;
		font-size: clamp(2.7rem, 6vw, 6.8rem);
		line-height: 0.92;
		letter-spacing: -0.06em;
		text-transform: uppercase;
	}

	.story-intro > p:last-child {
		max-width: 36rem;
		margin: auto 0 0;
		font-size: clamp(1.1rem, 2vw, 1.5rem);
	}

	.story-layout {
		max-width: 100rem;
		margin: 0 auto;
		padding: 0 clamp(1.5rem, 4vw, 4rem);
	}

	.member-panel {
		display: grid;
		min-height: calc(100svh - 4rem);
		grid-template-columns: minmax(22rem, 3fr) minmax(19rem, 2fr);
		gap: clamp(2rem, 5vw, 6rem);
		align-items: center;
		padding: 5rem clamp(1rem, 3vw, 3rem);
		border-bottom: 1px solid var(--color-line);
		scroll-margin-top: 4rem;
	}

	.portrait-column {
		height: min(77svh, 49rem);
	}

	@media (min-width: 901px) {
		.portrait-column {
			width: auto;
			aspect-ratio: 2 / 3;
			justify-self: center;
		}
	}

	.copy-column {
		align-self: center;
	}

	.formation {
		position: relative;
		isolation: isolate;
		min-height: min(66rem, 100svh);
		overflow: hidden;
		padding: clamp(5rem, 9vw, 9rem) clamp(1.5rem, 7vw, 7rem);
		background: var(--color-ink);
		color: var(--color-paper);
	}

	.formation-copy {
		position: relative;
		z-index: 6;
		max-width: 48rem;
	}

	.formation-copy > p:last-child {
		max-width: 34rem;
		margin: 2rem 0 0;
		color: #cec9c0;
	}

	.formation-team {
		position: absolute;
		right: 0;
		bottom: -8rem;
		width: min(63vw, 70rem);
		height: 78%;
	}

	.formation-sun {
		position: absolute;
		top: 5%;
		left: 30%;
		width: min(35vw, 34rem);
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--color-brand-red);
	}

	.formation-person {
		position: absolute;
		bottom: 0;
		width: min(22vw, 20rem);
		height: 100%;
		object-fit: contain;
		object-position: bottom;
		filter: contrast(1.05);
	}

	.formation-signature {
		right: 2rem;
		bottom: 1.5rem;
	}

	@media (max-width: 1100px) {
		.member-panel {
			grid-template-columns: minmax(20rem, 1.05fr) minmax(18rem, 0.95fr);
			gap: 2rem;
		}
	}

	@media (max-width: 900px) {
		.hero {
			height: auto;
			min-height: 52rem;
		}

		.hero-copy {
			width: 100%;
			padding-bottom: 27rem;
		}

		.hero h1 {
			font-size: clamp(3rem, 13vw, 6rem);
		}

		.hero-team {
			right: -5rem;
			bottom: -5rem;
			width: 110%;
			height: 32rem;
		}

		.hero-person,
		.formation-person {
			width: 32%;
		}

		.story-layout {
			padding: 0 clamp(1rem, 5vw, 3rem);
		}

		.member-panel {
			grid-template-columns: minmax(18rem, 1fr) minmax(17rem, 0.9fr);
			gap: clamp(2rem, 5vw, 4rem);
			padding: 5rem 0;
			scroll-margin-top: 7rem;
		}

		.formation {
			min-height: 61rem;
		}

		.formation-team {
			right: -6rem;
			bottom: -7rem;
			width: 115%;
			height: 35rem;
		}
	}

	@media (max-width: 700px) {
		.team-page {
			margin-bottom: -2rem;
		}

		.hero {
			min-height: 47rem;
		}

		.hero-copy {
			padding: 4.5rem 1.25rem 23rem;
		}

		.hero-crest {
			top: 1.1rem;
			right: 1.1rem;
			width: 3.2rem;
		}

		.hero-lede {
			max-width: 21rem;
			font-size: 0.95rem;
		}

		.hero-team {
			right: -3.5rem;
			bottom: -3rem;
			height: 25rem;
		}

		.hero-coordinate {
			display: none;
		}

		.story-intro {
			display: block;
			padding: 5rem 1.5rem;
		}

		.story-intro h2 {
			margin-bottom: 2rem;
		}

		.member-panel {
			grid-template-columns: 1fr;
			gap: 3rem;
			padding: 4rem 0;
		}

		.formation {
			min-height: 56rem;
			padding: 5rem 1.5rem;
		}

		.formation h2 {
			font-size: clamp(2.8rem, 15vw, 4.5rem);
		}

		.formation-team {
			right: -5rem;
			height: 29rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-person {
			animation: none;
		}
	}
</style>
