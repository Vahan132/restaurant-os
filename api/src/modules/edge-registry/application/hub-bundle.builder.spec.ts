import { buildHubBundle } from './hub-bundle.builder';

describe('buildHubBundle (EDGE-UPDATE-1)', () => {
  const files = buildHubBundle({
    organizationId: 'o',
    restaurantId: 'r',
    branchId: 'b',
    nodeId: 'n',
    nodeToken: 't',
    cloudUrl: 'https://x/res/api',
    dbPassword: 'p',
    jwtAccess: 'a',
    jwtRefresh: 'a',
    platformAccess: 'a',
    platformRefresh: 'a',
    consumerAccess: 'a',
    consumerRefresh: 'a',
    posDeviceSecret: 'pos-secret-0123456789',
    kdsDeviceSecret: 'kds-secret-0123456789',
  });
  const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));

  it('ships run + update scripts for both OSes', () => {
    expect(Object.keys(byPath).sort()).toEqual(
      ['.env.edge', 'run.cmd', 'run.sh', 'update.cmd', 'update.sh'].sort(),
    );
  });

  it('run and update scripts PULL before up (re-running = update)', () => {
    for (const p of ['run.cmd', 'run.sh', 'update.cmd', 'update.sh']) {
      const c = byPath[p] ?? '';
      expect(c.indexOf(' pull')).toBeGreaterThan(-1);
      expect(c.indexOf(' pull')).toBeLessThan(c.indexOf(' up -d'));
    }
  });

  it('follows the develop channel and no longer forces the FILE fiscal backend', () => {
    const env = byPath['.env.edge'] ?? '';
    expect(env).toContain('EDGE_IMAGE_TAG=develop');
    expect(env).toContain('EDGE_AUTO_UPDATE=true');
    expect(env).not.toContain('FISCAL_CONFIG_BACKEND=FILE');
    expect(env).toContain('EDGE_POS_DEVICE_SECRET=pos-secret-0123456789');
  });
});
