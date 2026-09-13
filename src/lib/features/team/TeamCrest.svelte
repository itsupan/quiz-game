<script lang="ts">
	type Props = {
		label?: string;
	};

	let { label }: Props = $props();
</script>

<svg viewBox="0 0 120 120" role={label ? 'img' : 'presentation'} aria-label={label}>
	<circle cx="60" cy="60" r="56"></circle>
	<path d="M24 38h72L83 54H37zM37 54v35M83 54v35M29 68h62"></path>
	<path class="check" d="m47 78 9 9 20-25"></path>
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		fill: none;
		stroke: currentColor;
		stroke-width: 3;
	}

	.check {
		stroke: var(--color-brand-red);
		stroke-width: 6;
	}
</style>
