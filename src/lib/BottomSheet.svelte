<!-- Reusable touch-driven bottom sheet with configurable snap points for mobile UI -->
<script>
	import { onMount } from 'svelte';

	let {
		open = false,
		snapPoints = [40, 60, 95],
		initialSnap = 1,
		onclose = () => {},
		children
	} = $props();

	let sheetEl;
	let currentHeight = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let startHeight = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocity = 0;

	$effect(() => {
		if (open) {
			currentHeight = snapPoints[initialSnap] ?? snapPoints[0];
		}
	});

	function vhToPx(vh) {
		return (vh / 100) * window.innerHeight;
	}

	function pxToVh(px) {
		return (px / window.innerHeight) * 100;
	}

	function onTouchStart(e) {
		dragging = true;
		startY = e.touches[0].clientY;
		startHeight = currentHeight;
		lastY = startY;
		lastTime = Date.now();
		velocity = 0;
	}

	function onTouchMove(e) {
		if (!dragging) return;
		const currentY = e.touches[0].clientY;
		const deltaVh = pxToVh(startY - currentY);
		const newHeight = Math.max(0, Math.min(100, startHeight + deltaVh));
		currentHeight = newHeight;

		const now = Date.now();
		const dt = now - lastTime;
		if (dt > 0) {
			velocity = (lastY - currentY) / dt;
		}
		lastY = currentY;
		lastTime = now;
	}

	function onTouchEnd() {
		if (!dragging) return;
		dragging = false;

		// Dismiss if dragged below minimum snap or flicked down fast
		if (currentHeight < snapPoints[0] / 2 || (velocity < -0.5 && currentHeight < snapPoints[0])) {
			currentHeight = 0;
			setTimeout(() => onclose(), 250);
			return;
		}

		// Snap to nearest point, biased by velocity
		const velocityBias = velocity * 15;
		let target = snapPoints[0];
		let minDist = Infinity;
		for (const sp of snapPoints) {
			const dist = Math.abs(currentHeight + velocityBias - sp);
			if (dist < minDist) {
				minDist = dist;
				target = sp;
			}
		}
		currentHeight = target;
	}

	function onBackdropClick() {
		currentHeight = 0;
		setTimeout(() => onclose(), 250);
	}
</script>

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40 bg-black/40 transition-opacity duration-250"
		style="opacity: {Math.min(currentHeight / (snapPoints[1] ?? snapPoints[0]), 1)}"
		onclick={onBackdropClick}
	></div>

	<!-- Sheet -->
	<div
		bind:this={sheetEl}
		class="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl safe-area-pb"
		style="height: {currentHeight}vh; transition: {dragging ? 'none' : 'height 0.25s ease-out'}; will-change: height;"
	>
		<!-- Drag handle -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex justify-center py-3 cursor-grab touch-none"
			ontouchstart={onTouchStart}
			ontouchmove={onTouchMove}
			ontouchend={onTouchEnd}
		>
			<div class="w-10 h-1 bg-gray-300 rounded-full"></div>
		</div>

		<!-- Content -->
		<div class="overflow-y-auto px-4 pb-4" style="height: calc(100% - 40px);">
			{@render children()}
		</div>
	</div>
{/if}
