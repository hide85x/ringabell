// Stub for optional MongoDB driver dependencies not needed in Cloudflare Workers.
// The driver uses try/catch lazy requires for these — we redirect them here so
// the Rollup bundler doesn't fail when the packages aren't installed.
export default {}
