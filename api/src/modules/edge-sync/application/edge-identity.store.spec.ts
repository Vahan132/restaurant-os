import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AppConfig } from '../../../shared/infrastructure/config/env.schema';
import { EdgeIdentityStore } from './edge-identity.store';

function storeAt(path: string): EdgeIdentityStore {
  const config = {
    get: (k: string) => (k === 'EDGE_IDENTITY_PATH' ? path : undefined),
  } as unknown as ConfigService<AppConfig, true>;
  return new EdgeIdentityStore(config);
}

describe('EdgeIdentityStore (EDGE-SETUP-3A)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'edge-identity-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a sourceable KEY=VALUE env file with all identity fields', () => {
    const path = join(dir, 'edge-identity.env');
    storeAt(path).write({
      organizationId: 'org-1',
      restaurantId: 'r-1',
      branchId: 'b-1',
      nodeId: 'node-1',
      nodeToken: 'f'.repeat(64),
      fiscalKek: 'a'.repeat(64),
    });
    const body = readFileSync(path, 'utf8');
    expect(body).toContain('EDGE_ORG_ID=org-1');
    expect(body).toContain('EDGE_RESTAURANT_ID=r-1');
    expect(body).toContain('EDGE_BRANCH_ID=b-1');
    expect(body).toContain('EDGE_NODE_ID=node-1');
    expect(body).toContain(`EDGE_NODE_TOKEN=${'f'.repeat(64)}`);
    expect(body).toContain(`FISCAL_MASTER_KEK=${'a'.repeat(64)}`);
    // Trailing newline so `. file` sources the last line.
    expect(body.endsWith('\n')).toBe(true);
  });

  it('writes with owner-only permissions (no group/other access)', () => {
    const path = join(dir, 'edge-identity.env');
    storeAt(path).write({
      organizationId: 'o',
      restaurantId: 'r',
      branchId: 'b',
      nodeId: 'n',
      nodeToken: 't',
      fiscalKek: 'k',
    });
    // Security property: no permission bits for group or other.
    expect(statSync(path).mode & 0o077).toBe(0);
  });

  it('creates the parent directory and overwrites on re-pair', () => {
    const path = join(dir, 'nested', 'edge-identity.env');
    const s = storeAt(path);
    s.write({ organizationId: 'o', restaurantId: 'r', branchId: 'b', nodeId: 'n1', nodeToken: 't1', fiscalKek: 'k1' });
    expect(existsSync(path)).toBe(true);
    s.write({ organizationId: 'o', restaurantId: 'r', branchId: 'b', nodeId: 'n2', nodeToken: 't2', fiscalKek: 'k2' });
    const body = readFileSync(path, 'utf8');
    expect(body).toContain('EDGE_NODE_ID=n2');
    expect(body).not.toContain('EDGE_NODE_ID=n1');
  });
});
