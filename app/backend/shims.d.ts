// app/backend/shims.d.ts
// Minimal TS shims for this repo's PoC backend TypeScript files.
//
// This project currently doesn't ship with a backend tsconfig, so VSCode/TS
// may report missing Node/module types. These shims keep editor tooling usable
// without forcing dependency installs yet.

declare const process: {
  env: Record<string, string | undefined>;
};

declare function require(id: string): any;

declare module 'pg' {
  // Minimal surface used in [`app/backend/controllers/oauth.ts`](app/backend/controllers/oauth.ts:1)
  export class Pool {
    constructor(opts?: any);
    connect(): Promise<any>;
  }
}

declare module 'crypto' {
  const crypto: any;
  export default crypto;
}