<!-- Main map page — renders fullscreen Mapbox GL map with clustered mural markers, lightbox, and mural submission -->
<script>
	import { onMount } from 'svelte';
	import { PUBLIC_MAPBOX_TOKEN, PUBLIC_CLOUDINARY_CLOUD_NAME, PUBLIC_CLOUDINARY_UPLOAD_PRESET } from '$env/static/public';
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { cloudinaryUrl } from '$lib/cloudinary.js';
	import { nextFlagCount } from '$lib/flagging.js';
	import MuralLightbox from '$lib/MuralLightbox.svelte';
	import SubmitPanel from '$lib/SubmitPanel.svelte';
	import BottomSheet from '$lib/BottomSheet.svelte';

	let mapContainer;
	let map;
	let areas = $state([]);
	let selectedArea = $state('');

	// Lightbox state
	let currentMurals = $state([]);
	let lightboxIndex = $state(-1);
	let lightbox = $derived(lightboxIndex >= 0 ? currentMurals[lightboxIndex] : null);

	// Edit state
	let editing = $state(false);
	let editName = $state('');
	let editAddress = $state('');
	let editArtist = $state('');
	let editNeighborhood = $state('');
	let editStatus = $state('');
	let saving = $state(false);

	// Pin-drop / submit state
	let pinDropMode = $state(false);
	let pinLocation = $state(null);
	let tempMarker = $state(null);
	let submitPanel = $state(false);
	let uploadedImageUrl = $state('');
	let uploadPreview = $state('');
	let uploading = $state(false);
	let submitting = $state(false);
	let submitAddress = $state('');
	let submitArtist = $state('');
	let locationFromExif = $state(false);

	// Admin state
	let isLoggedIn = $state(false);
	let showLoginPrompt = $state(false);
	let loginPassword = $state('');
	let loginError = $state('');
	let viewingPending = $state(false);

	// Upload validation
	let uploadError = $state('');
	const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
	const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

	// Submit feedback
	let submitSuccess = $state(false);

	// Neighborhood boundaries toggle
	let showBoundaries = $state(false);
	let boundariesLoaded = false;

	// Mobile detection and UI state
	let isMobile = $state(typeof window !== 'undefined' && window.innerWidth < 768);
	let mobileAreaSheet = $state(false);
	let mobileMenuSheet = $state(false);

	// Thumbnail markers
	let thumbnailMarkers = [];
	let clusterMarkers = [];

	const DETROIT_CENTER = [-83.09, 42.35];
	const DEFAULT_ZOOM = 12;
	const SOURCE_ID = 'murals';

	onMount(() => {
		mapboxgl.accessToken = PUBLIC_MAPBOX_TOKEN;

		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/mapbox/streets-v12',
			center: DETROIT_CENTER,
			zoom: DEFAULT_ZOOM
		});

		map.addControl(new mapboxgl.NavigationControl(), 'top-right');

		const onResize = debounce(() => { isMobile = window.innerWidth < 768; }, 200);
		window.addEventListener('resize', onResize);

		map.on('load', () => {
			setupClusterSource();
			fetchMurals();
			fetchAreas();
			checkAuth();
		});

		map.on('moveend', debounce(() => {
			fetchMurals();
			renderThumbnails();
			renderClusterThumbnails();
		}, 300));

		// Pin-drop click handler
		map.on('click', (e) => {
			if (!pinDropMode) return;

			pinLocation = { lng: e.lngLat.lng, lat: e.lngLat.lat };

			// Move or create temp marker
			if (tempMarker) {
				tempMarker.setLngLat([pinLocation.lng, pinLocation.lat]);
			} else {
				tempMarker = new mapboxgl.Marker({ color: '#3b82f6' })
					.setLngLat([pinLocation.lng, pinLocation.lat])
					.addTo(map);
			}

			submitPanel = true;
		});

		function onKeydown(e) {
			if (e.key === 'Escape') {
				if (pinDropMode) cancelPinDrop();
				else if (lightboxIndex >= 0) closeLightbox();
			}
			if (lightboxIndex >= 0) {
				if (e.key === 'ArrowRight') navigateLightbox(1);
				if (e.key === 'ArrowLeft') navigateLightbox(-1);
			}
		}
		window.addEventListener('keydown', onKeydown);

		return () => {
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('resize', onResize);
			clearThumbnails();
			clearClusterMarkers();
			map.remove();
		};
	});

	function debounce(fn, ms) {
		let timer;
		return (...args) => {
			clearTimeout(timer);
			timer = setTimeout(() => fn(...args), ms);
		};
	}

	function setupClusterSource() {
		map.addSource(SOURCE_ID, {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] },
			cluster: true,
			clusterMaxZoom: 14,
			clusterRadius: 30
		});

		// Invisible cluster layer — kept for queryRenderedFeatures; HTML markers handle visuals
		map.addLayer({
			id: 'clusters',
			type: 'circle',
			source: SOURCE_ID,
			filter: ['has', 'point_count'],
			paint: {
				'circle-color': 'transparent',
				'circle-radius': 36,
				'circle-stroke-width': 0
			}
		});

		// Hidden circle layer for click detection on unclustered points
		map.addLayer({
			id: 'unclustered-point',
			type: 'circle',
			source: SOURCE_ID,
			filter: ['!', ['has', 'point_count']],
			paint: {
				'circle-color': 'transparent',
				'circle-radius': 24,
				'circle-stroke-width': 0
			}
		});

		map.on('click', 'unclustered-point', (e) => {
			if (pinDropMode) return;
			const clickedId = e.features[0].properties.id;
			const idx = currentMurals.findIndex((m) => m.id === clickedId);
			if (idx >= 0) lightboxIndex = idx;
		});

		map.on('mouseenter', 'unclustered-point', () => { if (!pinDropMode) map.getCanvas().style.cursor = 'pointer'; });
		map.on('mouseleave', 'unclustered-point', () => { if (!pinDropMode) map.getCanvas().style.cursor = ''; });

		// Neighborhood boundary layers (hidden by default)
		map.addSource('neighborhoods', {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] }
		});

		map.addLayer({
			id: 'neighborhood-fill',
			type: 'fill',
			source: 'neighborhoods',
			paint: {
				'fill-color': '#d4a574',
				'fill-opacity': 0.1
			},
			layout: { visibility: 'none' }
		}, 'clusters');

		map.addLayer({
			id: 'neighborhood-outline',
			type: 'line',
			source: 'neighborhoods',
			paint: {
				'line-color': '#d4a574',
				'line-width': 2,
				'line-opacity': 0.6
			},
			layout: { visibility: 'none' }
		}, 'clusters');

		map.addLayer({
			id: 'neighborhood-label',
			type: 'symbol',
			source: 'neighborhoods',
			layout: {
				'text-field': ['get', 'neighborhood'],
				'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
				'text-size': 12,
				visibility: 'none'
			},
			paint: {
				'text-color': '#8B6914',
				'text-halo-color': '#fff',
				'text-halo-width': 1.5
			}
		});
	}

	async function toggleBoundaries() {
		showBoundaries = !showBoundaries;

		if (showBoundaries && !boundariesLoaded) {
			try {
				const res = await fetch('/api/neighborhoods');
				const data = await res.json();
				map.getSource('neighborhoods').setData(data);
				boundariesLoaded = true;
			} catch (err) {
				console.error('Failed to load boundaries:', err);
				showBoundaries = false;
				return;
			}
		}

		const vis = showBoundaries ? 'visible' : 'none';
		map.setLayoutProperty('neighborhood-fill', 'visibility', vis);
		map.setLayoutProperty('neighborhood-outline', 'visibility', vis);
		map.setLayoutProperty('neighborhood-label', 'visibility', vis);
	}

	function clearThumbnails() {
		thumbnailMarkers.forEach((m) => m.remove());
		thumbnailMarkers = [];
	}

	function clearClusterMarkers() {
		clusterMarkers.forEach((m) => m.remove());
		clusterMarkers = [];
	}

	function renderClusterThumbnails() {
		clearClusterMarkers();
		if (!map || !map.getSource(SOURCE_ID)) return;

		const features = map.queryRenderedFeatures({ layers: ['clusters'] });
		const source = map.getSource(SOURCE_ID);

		for (const feature of features) {
			const clusterId = feature.properties.cluster_id;
			const count = feature.properties.point_count;
			const [lng, lat] = feature.geometry.coordinates;

			source.getClusterLeaves(clusterId, 1, 0, (err, leaves) => {
				if (err || !leaves?.length) return;
				const imageUrl = leaves[0].properties.image_url;

				const clusterSize = isMobile ? 48 : 72;
				const el = document.createElement('div');
				el.style.cssText = `position: relative; width: ${clusterSize}px; height: ${clusterSize}px; cursor: pointer;`;

				const img = document.createElement('img');
				img.src = cloudinaryUrl(imageUrl, { width: clusterSize * 2, height: clusterSize * 2 });
				img.alt = '';
				img.loading = 'lazy';
				img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 3px solid #d4a574; box-shadow: 0 2px 6px rgba(0,0,0,0.3);';
				img.onerror = () => {
					el.style.cssText += 'background: #d4a574; border-radius: 50%;';
					img.remove();
				};

				const badge = document.createElement('div');
				badge.textContent = count > 999 ? '999+' : count;
				badge.style.cssText = 'position: absolute; top: -4px; right: -4px; background: #d4a574; color: white; border-radius: 999px; font-size: 11px; font-weight: bold; padding: 2px 6px; min-width: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.3);';

				el.appendChild(img);
				el.appendChild(badge);

				el.addEventListener('click', (e) => {
					e.stopPropagation();
					if (pinDropMode) return;
					source.getClusterExpansionZoom(clusterId, (err, zoom) => {
						if (err) return;
						map.easeTo({ center: [lng, lat], zoom: zoom + 1 });
					});
				});

				const marker = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
				clusterMarkers.push(marker);
			});
		}
	}

	function renderThumbnails() {
		clearThumbnails();
		if (!map || !map.getSource(SOURCE_ID)) return;

		const features = map.queryRenderedFeatures({ layers: ['unclustered-point'] });

		for (const feature of features) {
			const props = feature.properties;
			const [lng, lat] = feature.geometry.coordinates;
			const flagged = (props.flag_count || 0) > 0;

			const thumbSize = isMobile ? 96 : 144;
			const el = document.createElement('div');
			el.style.cssText = `
				width: ${thumbSize}px; height: ${thumbSize}px; border-radius: 50%; overflow: hidden;
				border: 3px solid ${flagged ? '#999' : '#d4a574'};
				box-shadow: 0 2px 6px rgba(0,0,0,0.3);
				cursor: pointer; background: #222;
				opacity: ${flagged ? '0.5' : '1'};
			`;

			const img = document.createElement('img');
			img.src = cloudinaryUrl(props.image_url, { width: thumbSize * 2, height: thumbSize * 2 });
			img.alt = '';
			img.loading = 'lazy';
			img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
			el.appendChild(img);

			el.addEventListener('click', (e) => {
				e.stopPropagation();
				if (pinDropMode) return;
				const idx = currentMurals.findIndex((m) => m.id === props.id);
				if (idx >= 0) lightboxIndex = idx;
			});

			let marker;
			img.onerror = () => {
				marker?.remove();
				thumbnailMarkers = thumbnailMarkers.filter((m) => m !== marker);
				currentMurals = currentMurals.filter((m) => m.id !== props.id);
			};

			marker = new mapboxgl.Marker({ element: el })
				.setLngLat([lng, lat])
				.addTo(map);

			thumbnailMarkers.push(marker);
		}
	}

	function updateMapData(murals) {
		currentMurals = murals;

		const geojson = {
			type: 'FeatureCollection',
			features: murals.map((m) => ({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
				properties: {
					id: m.id,
					mural_id: m.mural_id,
					title: m.title,
					address: m.address,
					artist: m.artist,
					neighborhood: m.neighborhood,
					image_url: m.image_url,
					notes: m.notes,
					flag_count: m.flag_count || 0
				}
			}))
		};

		const source = map.getSource(SOURCE_ID);
		if (source) {
			source.setData(geojson);
			map.once('idle', () => {
				renderThumbnails();
				renderClusterThumbnails();
			});
		}
	}

	async function fetchMurals() {
		if (selectedArea) return fetchMuralsByNeighborhood(selectedArea);

		const bounds = map.getBounds();
		const bbox = [
			bounds.getWest(),
			bounds.getSouth(),
			bounds.getEast(),
			bounds.getNorth()
		].join(',');

		try {
			const res = await fetch(`/api/murals?bbox=${bbox}`);
			const data = await res.json();
			updateMapData(data);
		} catch (err) {
			console.error('Failed to fetch murals:', err);
		}
	}

	async function fetchMuralsByNeighborhood(name) {
		try {
			const res = await fetch(`/api/murals?neighborhood=${encodeURIComponent(name)}`);
			const data = await res.json();
			updateMapData(data);
		} catch (err) {
			console.error('Failed to fetch murals by neighborhood:', err);
		}
	}

	async function fetchAreas() {
		try {
			const res = await fetch('/api/areas');
			areas = await res.json();
		} catch (err) {
			console.error('Failed to fetch areas:', err);
		}
	}

	function onAreaChange(e) {
		selectedArea = e.target.value;
		if (selectedArea) {
			fetchMuralsByNeighborhood(selectedArea);
		} else {
			fetchMurals();
		}
	}

	// Admin auth
	async function checkAuth() {
		try {
			const res = await fetch('/api/login');
			const data = await res.json();
			isLoggedIn = data.authenticated;
		} catch {}
	}

	async function login() {
		loginError = '';
		try {
			const res = await fetch('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password: loginPassword })
			});
			if (res.ok) {
				isLoggedIn = true;
				showLoginPrompt = false;
				loginPassword = '';
			} else {
				loginError = 'Invalid password';
			}
		} catch {
			loginError = 'Connection error';
		}
	}

	async function logout() {
		await fetch('/api/logout', { method: 'POST' });
		isLoggedIn = false;
		if (viewingPending) {
			viewingPending = false;
			fetchMurals();
		}
	}

	function togglePending() {
		viewingPending = !viewingPending;
		if (viewingPending) {
			fetchPendingMurals();
		} else {
			fetchMurals();
		}
	}

	async function fetchPendingMurals() {
		try {
			const res = await fetch('/api/murals?status=pending');
			const data = await res.json();
			updateMapData(data);
		} catch (err) {
			console.error('Failed to fetch pending murals:', err);
		}
	}

	// Lightbox
	function closeLightbox() {
		lightboxIndex = -1;
		editing = false;
	}

	function navigateLightbox(dir) {
		if (currentMurals.length === 0) return;
		editing = false;
		lightboxIndex = (lightboxIndex + dir + currentMurals.length) % currentMurals.length;
	}

	async function flagMural() {
		if (!lightbox) return;
		try {
			const res = await fetch('/api/murals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: lightbox.id })
			});
			const data = await res.json();
			currentMurals[lightboxIndex] = {
				...currentMurals[lightboxIndex],
				flag_count: nextFlagCount(currentMurals[lightboxIndex].flag_count, res.ok, data)
			};
		} catch (err) {
			console.error('Failed to flag mural:', err);
		}
	}

	// Edit mode
	function startEditing() {
		if (!lightbox) return;
		editName = lightbox.name || '';
		editAddress = lightbox.address || '';
		editArtist = lightbox.artist || '';
		editNeighborhood = lightbox.neighborhood || '';
		editStatus = lightbox.status || 'approved';
		editing = true;
	}

	function cancelEditing() {
		editing = false;
	}

	async function saveEdit() {
		if (!lightbox) return;
		saving = true;
		try {
			const res = await fetch('/api/murals/edit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: lightbox.id,
					name: editName,
					address: editAddress,
					artist: editArtist,
					neighborhood: editNeighborhood,
					status: editStatus
				})
			});
			const data = await res.json();
			if (res.ok) {
				currentMurals[lightboxIndex] = {
					...currentMurals[lightboxIndex],
					name: data.name,
					title: data.title,
					address: data.address,
					artist: data.artist,
					neighborhood: data.neighborhood,
					status: data.status
				};
				editing = false;
			}
		} catch (err) {
			console.error('Failed to save edit:', err);
		} finally {
			saving = false;
		}
	}

	// Pin-drop mode
	function enterPinDrop() {
		pinDropMode = true;
		map.getCanvas().style.cursor = 'crosshair';
	}

	function cancelPinDrop() {
		pinDropMode = false;
		submitPanel = false;
		pinLocation = null;
		uploadedImageUrl = '';
		uploadPreview = '';
		uploadError = '';
		submitAddress = '';
		submitArtist = '';
		locationFromExif = false;
		map.getCanvas().style.cursor = '';
		if (tempMarker) {
			tempMarker.remove();
			tempMarker = null;
		}
	}

	async function handleFileSelect(e) {
		const file = e.target.files?.[0];
		if (!file) return;

		uploadError = '';

		// Validate file type and size
		if (!ALLOWED_TYPES.includes(file.type)) {
			uploadError = 'Only JPEG, PNG, and WebP images allowed';
			return;
		}
		if (file.size > MAX_FILE_SIZE) {
			uploadError = 'Image must be under 10MB';
			return;
		}

		// Local preview
		uploadPreview = URL.createObjectURL(file);

		// Extract GPS from EXIF (lazy-load exifr)
		try {
			const { default: exifr } = await import('exifr');
			const gps = await exifr.gps(file);
			if (gps?.latitude && gps?.longitude) {
				locationFromExif = true;
				pinLocation = { lat: gps.latitude, lng: gps.longitude };
				submitPanel = true;

				// Move map to photo location and place marker
				map.flyTo({ center: [gps.longitude, gps.latitude], zoom: 17 });
				if (tempMarker) {
					tempMarker.setLngLat([gps.longitude, gps.latitude]);
				} else {
					tempMarker = new mapboxgl.Marker({ color: '#3b82f6' })
						.setLngLat([gps.longitude, gps.latitude])
						.addTo(map);
				}
			}
		} catch {
			// No GPS data — user will need to click the map
		}

		// Upload to Cloudinary
		uploading = true;
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('upload_preset', PUBLIC_CLOUDINARY_UPLOAD_PRESET);
			formData.append('folder', 'detroit-murals/user');

			const res = await fetch(
				`https://api.cloudinary.com/v1_1/${PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
				{ method: 'POST', body: formData }
			);
			const data = await res.json();
			uploadedImageUrl = data.secure_url;
		} catch (err) {
			console.error('Upload failed:', err);
			uploadedImageUrl = '';
		} finally {
			uploading = false;
		}
	}

	async function submitMural() {
		if (!uploadedImageUrl || !pinLocation) return;

		submitting = true;
		try {
			const res = await fetch('/api/murals/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					image_url: uploadedImageUrl,
					lat: pinLocation.lat,
					lng: pinLocation.lng,
					address: submitAddress || undefined,
					artist: submitArtist || undefined
				})
			});

			if (res.ok) {
				cancelPinDrop();
				submitSuccess = true;
				setTimeout(() => { submitSuccess = false; }, 4000);
				fetchMurals();
			}
		} catch (err) {
			console.error('Submit failed:', err);
		} finally {
			submitting = false;
		}
	}
</script>

<div class="relative w-screen h-dvh">
	<div bind:this={mapContainer} class="w-full h-full"></div>

	<!-- Desktop controls (top-left) -->
	<div class="hidden md:flex absolute top-4 left-4 z-10 gap-2">
		{#if areas.length > 0}
			<select
				onchange={onAreaChange}
				class="bg-white/90 backdrop-blur-sm text-gray-800 px-4 py-2 rounded-lg shadow-lg border border-gray-200 text-sm font-medium cursor-pointer hover:bg-white transition-colors"
			>
				<option value="">All Murals</option>
				{#each areas as area}
					<option value={area.neighborhood}>{area.neighborhood} ({area.count})</option>
				{/each}
			</select>
		{/if}

		<button
			onclick={toggleBoundaries}
			class="backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg text-sm font-medium cursor-pointer transition-colors
				{showBoundaries ? 'bg-amber-500/90 text-white hover:bg-amber-600' : 'bg-white/90 text-gray-800 border border-gray-200 hover:bg-white'}"
		>
			Neighborhoods
		</button>

		{#if !pinDropMode}
			<button
				onclick={enterPinDrop}
				class="bg-blue-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors"
			>
				+ Add Mural
			</button>
		{:else}
			<button
				onclick={cancelPinDrop}
				class="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium cursor-pointer hover:bg-red-600 transition-colors"
			>
				Cancel
			</button>
		{/if}

		{#if isLoggedIn}
			<button
				onclick={togglePending}
				class="backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg text-sm font-medium cursor-pointer transition-colors
					{viewingPending ? 'bg-orange-500/90 text-white hover:bg-orange-600' : 'bg-white/90 text-gray-800 border border-gray-200 hover:bg-white'}"
			>
				{viewingPending ? 'Exit Pending' : 'Pending'}
			</button>
			<button
				onclick={logout}
				class="bg-white/90 backdrop-blur-sm text-gray-500 px-3 py-2 rounded-lg shadow-lg text-sm cursor-pointer hover:bg-white border border-gray-200 transition-colors"
			>
				Logout
			</button>
		{:else}
			<button
				onclick={() => { showLoginPrompt = true; }}
				class="bg-white/90 backdrop-blur-sm text-gray-400 w-9 h-9 rounded-lg shadow-lg text-sm cursor-pointer hover:bg-white border border-gray-200 transition-colors flex items-center justify-center"
				title="Admin login"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
					<path d="M7 11V7a5 5 0 0110 0v4"/>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Mobile controls (bottom bar) -->
	{#if !pinDropMode || !isMobile}
		<div class="md:hidden fixed bottom-0 inset-x-0 z-10 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-3 py-2 flex gap-2 safe-area-pb">
			<button
				onclick={() => { mobileAreaSheet = true; }}
				class="flex-1 min-h-12 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-200 transition-colors truncate"
			>
				{selectedArea || 'Neighborhoods'}
			</button>

			{#if !pinDropMode}
				<button
					onclick={enterPinDrop}
					class="flex-1 min-h-12 bg-blue-500 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors"
				>
					+ Add Mural
				</button>
			{:else}
				<button
					onclick={cancelPinDrop}
					class="flex-1 min-h-12 bg-red-500 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-red-600 transition-colors"
				>
					Cancel
				</button>
			{/if}

			<button
				onclick={() => { mobileMenuSheet = true; }}
				class="min-h-12 w-12 bg-gray-100 text-gray-600 rounded-lg text-lg cursor-pointer hover:bg-gray-200 transition-colors flex items-center justify-center"
			>
				&#8943;
			</button>
		</div>
	{/if}

	<!-- Mobile neighborhood picker sheet -->
	{#if mobileAreaSheet}
		<BottomSheet open={true} snapPoints={[50, 85]} initialSnap={0} onclose={() => { mobileAreaSheet = false; }}>
			<h3 class="text-gray-800 font-semibold text-lg mb-3">Neighborhoods</h3>
			<button
				onclick={() => { selectedArea = ''; fetchMurals(); mobileAreaSheet = false; }}
				class="w-full min-h-12 text-left px-4 rounded-lg text-base text-gray-800 hover:bg-gray-100 transition-colors {selectedArea === '' ? 'font-semibold bg-gray-100' : ''}"
			>
				All Murals
			</button>
			{#each areas as area}
				<button
					onclick={() => { selectedArea = area.neighborhood; fetchMuralsByNeighborhood(area.neighborhood); mobileAreaSheet = false; }}
					class="w-full min-h-12 text-left px-4 rounded-lg text-base text-gray-800 hover:bg-gray-100 transition-colors {selectedArea === area.neighborhood ? 'font-semibold bg-gray-100' : ''}"
				>
					{area.neighborhood} <span class="text-gray-400">({area.count})</span>
				</button>
			{/each}
		</BottomSheet>
	{/if}

	<!-- Mobile overflow menu sheet -->
	{#if mobileMenuSheet}
		<BottomSheet open={true} snapPoints={[35]} initialSnap={0} onclose={() => { mobileMenuSheet = false; }}>
			<div class="space-y-2">
				<button
					onclick={() => { toggleBoundaries(); mobileMenuSheet = false; }}
					class="w-full min-h-12 text-left px-4 rounded-lg text-base text-gray-800 hover:bg-gray-100 transition-colors"
				>
					{showBoundaries ? 'Hide Neighborhoods' : 'Show Neighborhoods'}
				</button>
				{#if isLoggedIn}
					<button
						onclick={() => { togglePending(); mobileMenuSheet = false; }}
						class="w-full min-h-12 text-left px-4 rounded-lg text-base text-gray-800 hover:bg-gray-100 transition-colors"
					>
						{viewingPending ? 'Exit Pending' : 'View Pending'}
					</button>
					<button
						onclick={() => { logout(); mobileMenuSheet = false; }}
						class="w-full min-h-12 text-left px-4 rounded-lg text-base text-red-500 hover:bg-gray-100 transition-colors"
					>
						Logout
					</button>
				{:else}
					<button
						onclick={() => { showLoginPrompt = true; mobileMenuSheet = false; }}
						class="w-full min-h-12 text-left px-4 rounded-lg text-base text-gray-800 hover:bg-gray-100 transition-colors"
					>
						Admin Login
					</button>
				{/if}
			</div>
		</BottomSheet>
	{/if}

	<!-- Submit success banner -->
	{#if submitSuccess}
		<div class="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-green-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium">
			Submitted for review — thanks!
		</div>
	{/if}

	<!-- Viewing pending banner -->
	{#if viewingPending}
		<div class="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-orange-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium">
			Viewing pending submissions
		</div>
	{/if}

	<!-- Login prompt -->
	{#if showLoginPrompt}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => { showLoginPrompt = false; loginError = ''; loginPassword = ''; }}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="bg-white rounded-xl shadow-2xl p-6 w-72 md:w-72 w-[calc(100%-2rem)] max-w-sm mx-4" onclick={(e) => e.stopPropagation()}>
				<h3 class="text-gray-800 font-semibold text-base mb-4">Admin Login</h3>
				<input
					type="password"
					placeholder="Password"
					bind:value={loginPassword}
					onkeydown={(e) => { if (e.key === 'Enter') login(); }}
					class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 mb-3 focus:outline-none focus:border-blue-400"
				/>
				{#if loginError}
					<p class="text-red-500 text-xs mb-3">{loginError}</p>
				{/if}
				<div class="flex gap-2">
					<button
						onclick={() => { showLoginPrompt = false; loginError = ''; loginPassword = ''; }}
						class="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={login}
						class="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors"
					>
						Login
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Pin-drop instruction banner -->
	{#if pinDropMode && !submitPanel}
		<div class="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-blue-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-lg shadow-lg text-sm md:text-sm text-base font-medium">
			{isMobile ? 'Tap' : 'Click'} the map to place your mural
		</div>
	{/if}

	<!-- Submit panel -->
	{#if submitPanel}
		<SubmitPanel
			{uploadPreview}
			{uploadedImageUrl}
			{uploading}
			{uploadError}
			{submitting}
			{pinLocation}
			{pinDropMode}
			{locationFromExif}
			bind:submitAddress
			bind:submitArtist
			onfileselect={handleFileSelect}
			onsubmit={submitMural}
			oncancel={cancelPinDrop}
			{isMobile}
		/>
	{/if}
</div>

<!-- Lightbox -->
{#if lightbox}
	<MuralLightbox
		mural={lightbox}
		murals={currentMurals}
		index={lightboxIndex}
		{isLoggedIn}
		{editing}
		bind:editName
		bind:editAddress
		bind:editArtist
		bind:editNeighborhood
		bind:editStatus
		{saving}
		onnavigate={navigateLightbox}
		onclose={closeLightbox}
		onflag={flagMural}
		onstartedit={startEditing}
		oncanceledit={cancelEditing}
		onsaveedit={saveEdit}
		{isMobile}
	/>
{/if}
