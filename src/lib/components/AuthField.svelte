<script lang="ts">
	type Props = {
		id: string;
		label: string;
		type?: 'text' | 'email' | 'password';
		name?: string;
		autocomplete?: 'name' | 'email' | 'current-password' | 'new-password';
		required?: boolean;
	};

	let { id, label, type = 'text', name = id, autocomplete, required = false }: Props = $props();
</script>

<label
	for={id}
	class="mb-4 block text-[0.84rem] font-extrabold tracking-[0.09em] text-[var(--brown)] uppercase"
>
	{label}
</label>
<input
	{id}
	{name}
	{type}
	{autocomplete}
	{required}
	class="block w-full rounded-none border-0 border-b border-[var(--line-strong)] bg-transparent px-0 pb-3 text-base text-[var(--ink)] outline-none focus:border-b-2 focus:border-[var(--red)] focus:pb-[11px]"
/>
