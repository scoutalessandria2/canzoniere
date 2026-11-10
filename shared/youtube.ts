// YouTube links: a song's recording is stored in the .cho as the bare 11
// character video id ({x_youtube:<id>}); the editor accepts any link shape and
// shows the canonical watch URL.

export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
const ID_PATH = /^\/(?:shorts|embed|live)\/([^/]+)/;

function validId(id: string | null | undefined): string | null {
	return id && YOUTUBE_ID_RE.test(id) ? id : null;
}

// The video id of a bare id or of a youtube.com / youtu.be link (watch,
// shorts, embed, live, with any extra parameters), null for anything else.
export function youtubeId(input: string): string | null {
	const text = input.trim();
	if (YOUTUBE_ID_RE.test(text)) return text;
	let url: URL;
	try {
		url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	const host = url.hostname.toLowerCase();
	if (host === 'youtu.be') return validId(url.pathname.split('/')[1]);
	if (!HOSTS.has(host)) return null;
	if (url.pathname === '/watch') return validId(url.searchParams.get('v'));
	return validId(url.pathname.match(ID_PATH)?.[1]);
}

export function youtubeUrl(id: string): string {
	return `https://www.youtube.com/watch?v=${id}`;
}
