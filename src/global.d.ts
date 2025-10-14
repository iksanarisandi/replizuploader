// Type declarations for Cloudflare Workers static content
declare const __STATIC_CONTENT_MANIFEST: string;

declare module '__STATIC_CONTENT_MANIFEST' {
  const manifest: string;
  export default manifest;
}
