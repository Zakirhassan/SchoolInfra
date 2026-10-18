// Uploaded files (photo_url, document_url) are stored as "/uploads/..." paths
// and served by the Worker (R2). In production the frontend lives on another
// origin (Cloudflare Pages), so those paths must be prefixed with the API origin.
// VITE_API_URL is e.g. "https://api.example.com/api"; in dev it is unset and
// "/uploads" goes through the Vite proxy (origin '').

export function originFromApiUrl(apiUrl?: string): string {
    return (apiUrl || '/api').replace(/\/api\/?$/, '');
}

export const API_ORIGIN: string = originFromApiUrl((import.meta as any).env?.VITE_API_URL);

export function resolveAssetUrl<T extends string | null | undefined>(url: T, origin: string = API_ORIGIN): T | string {
    if (!url) return url;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) return url; // already absolute (http:, https:, data:, blob:, //)
    return origin + (url.startsWith('/') ? url : '/' + url);
}
