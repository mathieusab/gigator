import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as any;
}

describe('PWA installability assets', () => {
  test('manifest exists and includes required fields', () => {
    const manifestPath = path.resolve(__dirname, '../../public/manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = readJson(manifestPath);
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons) {
      expect(icon.src).toMatch(/^\//);
      expect(icon.sizes).toMatch(/\d+x\d+/);
    }
  });

  test('service worker source exists', () => {
    const swPath = path.resolve(__dirname, '../../src/service-worker.ts');
    expect(fs.existsSync(swPath)).toBe(true);
  });

  test('icon assets exist', () => {
    const icon192 = path.resolve(__dirname, '../../public/icons/icon-192.png');
    const icon512 = path.resolve(__dirname, '../../public/icons/icon-512.png');

    expect(fs.existsSync(icon192)).toBe(true);
    expect(fs.existsSync(icon512)).toBe(true);
  });
});
