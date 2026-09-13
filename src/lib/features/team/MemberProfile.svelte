<script lang="ts">
	import type { TeamMember } from './team';

	type Props = {
		member: TeamMember;
		compact?: boolean;
	};

	let { member, compact = false }: Props = $props();
</script>

<div class:compact class="member-profile">
	<p class="chapter">Chapter {member.mark} · {member.discipline}</p>
	<div class="name-reveal">
		<h3 data-name-reveal>{member.name}</h3>
	</div>
	<p class="role"><span>Role</span> {member.role}</p>
	<div class="ownership">
		<p>Owns</p>
		<p>{member.owns}</p>
	</div>
	<p class="principle">{member.principle}</p>
	<div class="contributions">
		<p>Contributed</p>
		<ul>
			{#each member.contributions as contribution (contribution)}
				<li data-seal>{contribution}</li>
			{/each}
		</ul>
	</div>
	<div class="motif">
		<span aria-hidden="true"></span>
		<div>
			<p>Armor motif · {member.motif}</p>
			<p>{member.motifDescription}</p>
		</div>
	</div>
</div>

<style>
	.member-profile {
		max-width: 34rem;
	}

	.chapter,
	.role,
	.ownership > p:first-child,
	.contributions > p,
	.motif p:first-child {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.chapter {
		color: var(--color-brand-red);
	}

	.name-reveal {
		overflow: hidden;
	}

	h3 {
		margin: 0.45rem 0 0;
		font-size: clamp(3.7rem, 7vw, 7.8rem);
		line-height: 0.85;
		letter-spacing: -0.075em;
		text-transform: uppercase;
	}

	.role {
		margin-top: 1.25rem;
	}

	.role span {
		margin-right: 0.65rem;
		color: var(--color-muted);
	}

	.ownership {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		gap: 1rem;
		margin-top: 2.4rem;
		padding-top: 1.1rem;
		border-top: 3px solid currentColor;
	}

	.ownership > p:last-child {
		margin: 0;
		font-size: clamp(1.05rem, 1.6vw, 1.45rem);
		font-weight: 650;
		line-height: 1.4;
	}

	.principle {
		margin: 1.7rem 0;
		padding-left: 1rem;
		border-left: 0.35rem solid var(--color-brand-red);
		font-size: 1rem;
		font-weight: 800;
	}

	.contributions ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}

	.contributions li {
		padding: 0.55rem 0.7rem;
		border: 2px solid currentColor;
		background: var(--color-paper);
		box-shadow: 3px 3px 0 currentColor;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.motif {
		display: grid;
		grid-template-columns: 1.5rem 1fr;
		gap: 0.8rem;
		margin-top: 1.8rem;
		color: var(--color-muted);
	}

	.motif > span {
		width: 1.1rem;
		height: 1.1rem;
		margin-top: 0.15rem;
		border: 2px solid var(--color-brand-red);
		box-shadow: 3px 3px 0 var(--color-brand-red);
	}

	.motif p:last-child {
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.compact h3 {
		font-size: clamp(3rem, 13vw, 5rem);
	}

	.compact .ownership {
		grid-template-columns: 1fr;
		gap: 0.5rem;
	}

	@media (prefers-reduced-motion: no-preference) {
		[data-name-reveal] {
			transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1) 90ms;
		}

		[data-seal] {
			transition:
				opacity 240ms ease-out,
				transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
		}

		[data-seal]:nth-child(2) {
			transition-delay: 70ms;
		}

		[data-seal]:nth-child(3) {
			transition-delay: 140ms;
		}

		:global(.motion-ready) :global([data-reveal]:not(.revealed)) [data-name-reveal] {
			transform: translateX(-110%);
		}

		:global(.motion-ready) :global([data-reveal]:not(.revealed)) [data-seal] {
			opacity: 0;
			transform: translateY(-0.6rem) scale(0.94);
		}
	}
</style>
