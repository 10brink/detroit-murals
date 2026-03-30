// Client-side flagging helpers — preserve existing UI state when the server rejects a flag attempt
export function nextFlagCount(currentFlagCount, responseOk, responseBody) {
	if (!responseOk) return currentFlagCount;
	return typeof responseBody?.flag_count === 'number' ? responseBody.flag_count : currentFlagCount;
}
