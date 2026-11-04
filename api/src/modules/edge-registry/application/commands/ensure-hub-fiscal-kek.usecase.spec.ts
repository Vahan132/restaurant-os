import { EnsureHubFiscalKekUseCase } from './ensure-hub-fiscal-kek.usecase';

describe('EnsureHubFiscalKekUseCase (EDGE-KEK-2)', () => {
  const blob = { cipher: Buffer.from('c'), iv: Buffer.from('i'), authTag: Buffer.from('t') };
  const kek = Buffer.alloc(32, 7);

  function make(opts: { configured: boolean; stored: typeof blob | null }) {
    const nodes = {
      getFiscalKek: jest.fn().mockResolvedValue(opts.stored),
      setFiscalKek: jest.fn().mockResolvedValue(undefined),
    };
    const crypto = {
      isConfigured: opts.configured,
      unwrapHubKek: jest.fn().mockReturnValue(kek),
      generateHubKek: jest.fn().mockReturnValue(kek),
      wrapHubKek: jest.fn().mockReturnValue(blob),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { uc: new EnsureHubFiscalKekUseCase(nodes as any, crypto as any), nodes, crypto };
  }

  it('returns null when the cloud has no master KEK', async () => {
    const { uc, nodes } = make({ configured: false, stored: null });
    await expect(uc.execute('n1')).resolves.toEqual({ fiscalKek: null, created: false });
    expect(nodes.setFiscalKek).not.toHaveBeenCalled();
  });

  it('mints + stores a KEK for a node that has none', async () => {
    const { uc, nodes } = make({ configured: true, stored: null });
    const res = await uc.execute('n1');
    expect(res).toEqual({ fiscalKek: kek.toString('hex'), created: true });
    expect(nodes.setFiscalKek).toHaveBeenCalledWith('n1', blob);
  });

  it('returns the stored KEK without re-minting', async () => {
    const { uc, nodes, crypto } = make({ configured: true, stored: blob });
    const res = await uc.execute('n1');
    expect(res).toEqual({ fiscalKek: kek.toString('hex'), created: false });
    expect(crypto.generateHubKek).not.toHaveBeenCalled();
    expect(nodes.setFiscalKek).not.toHaveBeenCalled();
  });
});
