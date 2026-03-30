<!-- Mural submission panel — desktop right-side card, mobile bottom sheet -->
<script>
	import BottomSheet from './BottomSheet.svelte';

	let {
		uploadPreview = '',
		uploadedImageUrl = '',
		uploading = false,
		uploadError = '',
		submitting = false,
		pinLocation = null,
		pinDropMode = false,
		locationFromExif = false,
		submitAddress = $bindable(''),
		submitArtist = $bindable(''),
		onfileselect = () => {},
		onsubmit = () => {},
		oncancel = () => {},
		isMobile = false
	} = $props();
</script>

<!-- Desktop panel -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="absolute top-4 right-16 z-10 w-80 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-5 {isMobile ? 'hidden' : 'block'}"
	onclick={(e) => e.stopPropagation()}
>
	<h3 class="text-gray-800 font-semibold text-base mb-4">Add a Mural</h3>

	{#if uploadPreview}
		<img src={uploadPreview} alt="Preview" class="w-full h-40 object-cover rounded-lg mb-3" />
		{#if uploading}
			<p class="text-blue-500 text-xs mb-3">Uploading...</p>
		{:else if uploadedImageUrl}
			<p class="text-green-600 text-xs mb-3">Uploaded</p>
		{/if}
	{:else}
		<label class="block w-full h-32 border-2 border-dashed border-gray-300 rounded-lg mb-3 cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-center">
			<span class="text-gray-400 text-sm">Click to select photo</span>
			<input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" onchange={onfileselect} />
		</label>
		{#if uploadError}
			<p class="text-red-500 text-xs mb-3">{uploadError}</p>
		{/if}
	{/if}

	<input type="text" placeholder="Address (optional)" bind:value={submitAddress}
		class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 mb-2 focus:outline-none focus:border-blue-400" />
	<input type="text" placeholder="Artist (optional)" bind:value={submitArtist}
		class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 mb-4 focus:outline-none focus:border-blue-400" />

	{#if pinLocation}
		<p class="text-xs mb-4 {locationFromExif ? 'text-green-600' : 'text-gray-400'}">
			{locationFromExif ? '📍 Location from photo' : ''}
			{pinLocation.lat.toFixed(5)}, {pinLocation.lng.toFixed(5)}
		</p>
	{:else if pinDropMode}
		<p class="text-amber-500 text-xs mb-4">Click the map to set location</p>
	{/if}

	<div class="flex gap-2">
		<button onclick={oncancel}
			class="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors">Cancel</button>
		<button onclick={onsubmit}
			disabled={!uploadedImageUrl || !pinLocation || uploading || submitting}
			class="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium cursor-pointer transition-colors
				{!uploadedImageUrl || !pinLocation || uploading || submitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}">
			{#if submitting}Submitting...{:else}Submit{/if}
		</button>
	</div>
</div>

<!-- Mobile bottom sheet -->
{#if isMobile}
	<BottomSheet open={true} snapPoints={[45, 75]} initialSnap={0} onclose={oncancel}>
		<h3 class="text-gray-800 font-semibold text-lg mb-4">Add a Mural</h3>

		{#if uploadPreview}
			<img src={uploadPreview} alt="Preview" class="w-full h-48 object-cover rounded-lg mb-3" />
			{#if uploading}
				<p class="text-blue-500 text-sm mb-3">Uploading...</p>
			{:else if uploadedImageUrl}
				<p class="text-green-600 text-sm mb-3">Uploaded</p>
			{/if}
		{:else}
			<label class="block w-full h-20 border-2 border-dashed border-gray-300 rounded-lg mb-3 cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-center">
				<span class="text-gray-400 text-base">Tap to select photo</span>
				<input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" onchange={onfileselect} />
			</label>
			{#if uploadError}
				<p class="text-red-500 text-sm mb-3">{uploadError}</p>
			{/if}
		{/if}

		<div class="space-y-3 mb-4">
			<input type="text" placeholder="Address (optional)" bind:value={submitAddress}
				class="w-full px-4 py-3 rounded-lg border border-gray-200 text-base text-gray-800 focus:outline-none focus:border-blue-400" />
			<input type="text" placeholder="Artist (optional)" bind:value={submitArtist}
				class="w-full px-4 py-3 rounded-lg border border-gray-200 text-base text-gray-800 focus:outline-none focus:border-blue-400" />
		</div>

		{#if pinLocation}
			<p class="text-sm mb-4 {locationFromExif ? 'text-green-600' : 'text-gray-400'}">
				{locationFromExif ? '📍 Location from photo' : ''}
				{pinLocation.lat.toFixed(5)}, {pinLocation.lng.toFixed(5)}
			</p>
		{:else if pinDropMode}
			<p class="text-amber-500 text-sm mb-4">Tap the map to set location</p>
		{/if}

		<div class="flex gap-3">
			<button onclick={oncancel}
				class="flex-1 min-h-12 rounded-lg border border-gray-200 text-gray-600 text-base font-medium cursor-pointer hover:bg-gray-50 transition-colors">Cancel</button>
			<button onclick={onsubmit}
				disabled={!uploadedImageUrl || !pinLocation || uploading || submitting}
				class="flex-1 min-h-12 rounded-lg text-white text-base font-medium cursor-pointer transition-colors
					{!uploadedImageUrl || !pinLocation || uploading || submitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}">
				{#if submitting}Submitting...{:else}Submit{/if}
			</button>
		</div>
	</BottomSheet>
{/if}
