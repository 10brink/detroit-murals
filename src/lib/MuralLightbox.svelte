<!-- Mural lightbox — desktop centered overlay with arrows, mobile bottom sheet with swipe navigation -->
<script>
	import BottomSheet from './BottomSheet.svelte';
	import { cloudinaryUrl } from './cloudinary.js';

	let {
		mural,
		murals = [],
		index = 0,
		isLoggedIn = false,
		editing = false,
		editName = $bindable(''),
		editAddress = $bindable(''),
		editArtist = $bindable(''),
		editNeighborhood = $bindable(''),
		editStatus = $bindable(''),
		saving = false,
		onnavigate = () => {},
		onclose = () => {},
		onflag = () => {},
		onstartedit = () => {},
		oncanceledit = () => {},
		onsaveedit = () => {},
		isMobile = false
	} = $props();

	// Swipe tracking for mobile image navigation
	let touchStartX = 0;
	let touchStartY = 0;

	function onImageTouchStart(e) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function onImageTouchEnd(e) {
		const deltaX = e.changedTouches[0].clientX - touchStartX;
		const deltaY = e.changedTouches[0].clientY - touchStartY;
		if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
			onnavigate(deltaX > 0 ? -1 : 1);
		}
	}
</script>

{#if mural}
	<!-- Desktop lightbox -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 items-center justify-center bg-black/50 {isMobile ? 'hidden' : 'flex'}"
		onclick={onclose}
	>
		<!-- Left arrow -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute left-4 top-1/2 -translate-y-1/2"
			onclick={(e) => { e.stopPropagation(); onnavigate(-1); }}
		>
			<button class="w-12 h-12 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-2xl cursor-pointer transition-colors">
				&#8249;
			</button>
		</div>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative max-w-5xl max-h-[90vh] mx-16"
			onclick={(e) => e.stopPropagation()}
		>
			<img
				src={cloudinaryUrl(mural.image_url, { width: 1200, crop: null })}
				alt="Mural"
				class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
			/>
			{#if editing}
				<div class="mt-3 w-72 mx-auto" onclick={(e) => e.stopPropagation()}>
					<input type="text" placeholder="Mural name" bind:value={editName}
						class="w-full px-3 py-1.5 rounded-lg bg-white/15 border border-white/30 text-white text-sm mb-2 focus:outline-none focus:border-white/60 placeholder:text-white/40" />
					<input type="text" placeholder="Artist" bind:value={editArtist}
						class="w-full px-3 py-1.5 rounded-lg bg-white/15 border border-white/30 text-white text-sm mb-2 focus:outline-none focus:border-white/60 placeholder:text-white/40" />
					<input type="text" placeholder="Address" bind:value={editAddress}
						class="w-full px-3 py-1.5 rounded-lg bg-white/15 border border-white/30 text-white text-sm mb-2 focus:outline-none focus:border-white/60 placeholder:text-white/40" />
					<input type="text" placeholder="Neighborhood" bind:value={editNeighborhood}
						class="w-full px-3 py-1.5 rounded-lg bg-white/15 border border-white/30 text-white text-sm mb-2 focus:outline-none focus:border-white/60 placeholder:text-white/40" />
					<select bind:value={editStatus}
						class="w-full px-3 py-1.5 rounded-lg bg-white/15 border border-white/30 text-white text-sm mb-3 focus:outline-none focus:border-white/60">
						<option value="approved" class="text-gray-800">Approved</option>
						<option value="pending" class="text-gray-800">Pending</option>
						<option value="rejected" class="text-gray-800">Rejected</option>
					</select>
					<div class="flex gap-2 justify-center">
						<button onclick={oncanceledit}
							class="px-4 py-1.5 text-sm rounded-lg bg-white/20 text-white/80 hover:bg-white/30 cursor-pointer transition-colors">Cancel</button>
						<button onclick={onsaveedit} disabled={saving}
							class="px-4 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 cursor-pointer transition-colors">
							{saving ? 'Saving...' : 'Save'}
						</button>
					</div>
				</div>
			{:else}
				<div class="mt-3 text-center">
					{#if mural.name || mural.title}
						<p class="text-white text-lg font-semibold drop-shadow-lg">{mural.name || mural.title}</p>
					{/if}
					{#if mural.artist}
						<p class="text-white/80 text-sm drop-shadow-lg">{mural.artist}</p>
					{/if}
					{#if mural.address}
						<p class="text-white/80 text-sm drop-shadow-lg">{mural.address}</p>
					{/if}
					{#if mural.neighborhood}
						<p class="text-white/60 text-sm drop-shadow-lg">{mural.neighborhood}</p>
					{/if}
					{#if mural.created_at}
						<p class="text-white/40 text-xs mt-1">Submitted {new Date(mural.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
					{/if}
					<p class="text-white/40 text-xs mt-1">{index + 1} / {murals.length}</p>
				</div>

				<div class="mt-3 flex justify-center gap-2">
					{#if isLoggedIn}
						<button
							onclick={(e) => { e.stopPropagation(); onstartedit(); }}
							class="px-4 py-2 text-sm rounded-lg bg-white/20 text-white/80 hover:bg-white/30 cursor-pointer transition-colors">Edit</button>
					{/if}
					<button
						onclick={(e) => { e.stopPropagation(); onflag(); }}
						class="px-4 py-2 text-sm rounded-lg transition-colors cursor-pointer {mural.flag_count > 0 ? 'bg-red-500/80 text-white' : 'bg-white/20 text-white/80 hover:bg-white/30'}">
						{#if mural.flag_count > 0}
							Flagged as removed ({mural.flag_count})
						{:else}
							Flag as removed
						{/if}
					</button>
				</div>
			{/if}

			<button
				onclick={onclose}
				class="absolute -top-3 -right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-gray-800 text-lg font-bold hover:bg-white shadow-lg cursor-pointer">
				&times;
			</button>
		</div>

		<!-- Right arrow -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute right-4 top-1/2 -translate-y-1/2"
			onclick={(e) => { e.stopPropagation(); onnavigate(1); }}
		>
			<button class="w-12 h-12 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-2xl cursor-pointer transition-colors">
				&#8250;
			</button>
		</div>
	</div>

	<!-- Mobile lightbox (bottom sheet) -->
	{#if isMobile}
		<BottomSheet open={true} snapPoints={[60, 95]} initialSnap={0} onclose={onclose}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				ontouchstart={onImageTouchStart}
				ontouchend={onImageTouchEnd}
				class="touch-pan-y"
			>
				<img
					src={cloudinaryUrl(mural.image_url, { width: 800, crop: null })}
					alt="Mural"
					class="w-full max-h-[45vh] object-contain rounded-lg"
				/>
			</div>

			{#if editing}
				<div class="mt-4 space-y-3">
					<input type="text" placeholder="Mural name" bind:value={editName}
						class="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-blue-400" />
					<input type="text" placeholder="Artist" bind:value={editArtist}
						class="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-blue-400" />
					<input type="text" placeholder="Address" bind:value={editAddress}
						class="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-blue-400" />
					<input type="text" placeholder="Neighborhood" bind:value={editNeighborhood}
						class="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-blue-400" />
					<select bind:value={editStatus}
						class="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-blue-400">
						<option value="approved">Approved</option>
						<option value="pending">Pending</option>
						<option value="rejected">Rejected</option>
					</select>
					<div class="flex gap-3">
						<button onclick={oncanceledit}
							class="flex-1 min-h-12 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors">Cancel</button>
						<button onclick={onsaveedit} disabled={saving}
							class="flex-1 min-h-12 rounded-lg bg-blue-500 text-white text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors">
							{saving ? 'Saving...' : 'Save'}
						</button>
					</div>
				</div>
			{:else}
				<div class="mt-4">
					{#if mural.name || mural.title}
						<p class="text-gray-900 text-base font-semibold">{mural.name || mural.title}</p>
					{/if}
					{#if mural.artist}
						<p class="text-gray-600 text-sm mt-1">{mural.artist}</p>
					{/if}
					{#if mural.address}
						<p class="text-gray-600 text-sm">{mural.address}</p>
					{/if}
					{#if mural.neighborhood}
						<p class="text-gray-400 text-sm">{mural.neighborhood}</p>
					{/if}
					{#if mural.created_at}
						<p class="text-gray-400 text-xs mt-2">Submitted {new Date(mural.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
					{/if}
					<p class="text-gray-400 text-xs mt-1">Swipe to navigate &middot; {index + 1} / {murals.length}</p>
				</div>

				<div class="mt-4 flex gap-3">
					{#if isLoggedIn}
						<button onclick={onstartedit}
							class="flex-1 min-h-12 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors">Edit</button>
					{/if}
					<button onclick={onflag}
						class="flex-1 min-h-12 rounded-lg text-sm font-medium cursor-pointer transition-colors {mural.flag_count > 0 ? 'bg-red-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}">
						{#if mural.flag_count > 0}
							Flagged ({mural.flag_count})
						{:else}
							Flag as removed
						{/if}
					</button>
				</div>
			{/if}
		</BottomSheet>
	{/if}
{/if}
