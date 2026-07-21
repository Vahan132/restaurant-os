import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../infrastructure/config/env.schema';
import { EdgeConfigService } from './edge-config.service';

function svc(env: Record<string, string | undefined>): EdgeConfigService {
  const config = {
    get: (k: string) => env[k],
  } as unknown as ConfigService<AppConfig, true>;
  return new EdgeConfigService(config);
}

const FULL = {
  APP_MODE: 'EDGE',
  EDGE_ORG_ID: 'org-1',
  EDGE_RESTAURANT_ID: 'r-1',
  EDGE_BRANCH_ID: 'b-1',
  EDGE_NODE_ID: 'node-1',
};

describe('EdgeConfigService — setup mode (EDGE-SETUP-3A)', () => {
  it('CLOUD: not edge, not paired, not setup mode', () => {
    const s = svc({ APP_MODE: 'CLOUD' });
    expect(s.isEdge).toBe(false);
    expect(s.isPaired).toBe(false);
    expect(s.isSetupMode).toBe(false);
    expect(s.getIdentityOrNull()).toBeNull();
  });

  it('EDGE + full identity: paired (operational)', () => {
    const s = svc(FULL);
    expect(s.isEdge).toBe(true);
    expect(s.isPaired).toBe(true);
    expect(s.isSetupMode).toBe(false);
    expect(s.getIdentity()).toEqual({
      organizationId: 'org-1',
      restaurantId: 'r-1',
      branchId: 'b-1',
      nodeId: 'node-1',
    });
  });

  it('EDGE + no identity: unpaired → setup mode (boots, no crash)', () => {
    const s = svc({ APP_MODE: 'EDGE' });
    expect(s.isEdge).toBe(true);
    expect(s.isPaired).toBe(false);
    expect(s.isSetupMode).toBe(true);
    expect(s.getIdentityOrNull()).toBeNull();
  });

  it('EDGE + PARTIAL identity: fails fast (corrupt)', () => {
    expect(() => svc({ APP_MODE: 'EDGE', EDGE_ORG_ID: 'org-1' })).toThrow();
  });
});
