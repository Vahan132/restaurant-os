import 'reflect-metadata';
import { SETUP_PAGE_HTML } from './setup-page.html';
import { SetupPageController } from './setup-page.controller';

describe('EDGE-SETUP-3B setup page', () => {
  it('the controller returns the self-contained HTML document', () => {
    expect(new SetupPageController().page()).toBe(SETUP_PAGE_HTML);
    expect(SETUP_PAGE_HTML.startsWith('<!doctype html>')).toBe(true);
  });

  it('is fully self-contained — NO external asset dependencies (airplane test)', () => {
    for (const needle of ['http://', 'https://', '<link', 'cdn', 'googleapis', 'unpkg', 'jsdelivr']) {
      expect(SETUP_PAGE_HTML.toLowerCase().includes(needle)).toBe(false);
    }
    // No external <script src="...">; the only <script> is the inline one.
    expect(/<script\s+src=/i.test(SETUP_PAGE_HTML)).toBe(false);
  });

  it('drives the 3A endpoints and polls status through the restart', () => {
    expect(SETUP_PAGE_HTML).toContain("fetch('/setup/pair'");
    expect(SETUP_PAGE_HTML).toContain("fetch('/setup/status'");
    expect(SETUP_PAGE_HTML).toContain('pollUntilPaired');
  });

  it('is trilingual (hy/ru/en) with a language toggle', () => {
    expect(SETUP_PAGE_HTML).toContain('I18N');
    expect(SETUP_PAGE_HTML).toMatch(/en:\s*\{/);
    expect(SETUP_PAGE_HTML).toMatch(/hy:\s*\{/);
    expect(SETUP_PAGE_HTML).toMatch(/ru:\s*\{/);
  });

  it('maps the 3A error codes and confirms re-pair destructively', () => {
    expect(SETUP_PAGE_HTML).toContain('INVALID_PAIRING_CODE');
    expect(SETUP_PAGE_HTML).toContain('CLOUD_UNREACHABLE');
    expect(SETUP_PAGE_HTML).toContain('PAIRING_KEK_UNAVAILABLE');
    expect(SETUP_PAGE_HTML).toContain('confirmRepair');
  });

  it('never bakes in or displays secret material', () => {
    // No secret VALUE is embedded (a 64-hex token/KEK would look like this).
    expect(/[0-9a-f]{64}/i.test(SETUP_PAGE_HTML)).toBe(false);
    // No user-facing jargon referencing the secret material (the API code
    // PAIRING_KEK_UNAVAILABLE is only used for comparison, never shown).
    const lower = SETUP_PAGE_HTML.toLowerCase();
    for (const jargon of ['node token', 'nodetoken', 'fiscalkek', 'fiscal kek', 'outbox']) {
      expect(lower.includes(jargon)).toBe(false);
    }
  });
});
