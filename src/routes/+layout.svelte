<!-- Root layout — applies global Tailwind styles and renders page content -->
<script>
	import '../app.css';
	let { children } = $props();
</script>

{@render children()}
