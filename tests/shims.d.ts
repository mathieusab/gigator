// tests/shims.d.ts
// Minimal typings shims for this repo's lightweight test setup (no full tsconfig).
// Goal: keep `tsc`/editor from complaining while `tsx` runs tests at runtime.

declare module 'fastify' {
  const fastify: any;
  export default fastify;
}