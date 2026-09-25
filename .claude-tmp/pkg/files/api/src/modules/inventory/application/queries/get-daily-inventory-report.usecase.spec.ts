import { DailyInventorySource } from '../ports/daily-inventory.source';
import { DailyInventoryReportService } from '../services/daily-inventory-report.service';
import { GetDailyInventoryReportUseCase } from './get-daily-inventory-report.usecase';

describe('GetDailyInventoryReportUseCase — date range', () => {
  const source = {
    restaurantTimezone: jest.fn(async () => 'Asia/Yerevan'),
    findSnapshot: jest.fn(async () => null),
    saveSnapshot: jest.fn(async () => undefined),
  } as unknown as DailyInventorySource;
  const report = { businessDate: 'x', endDate: 'y', generatedAt: new Date().toISOString() };
  const builder = {
    todayFor: jest.fn(() => '2026-09-25'),
    build: jest.fn(async () => report),
    buildRange: jest.fn(async () => report),
  } as unknown as DailyInventoryReportService;
  const uc = new GetDailyInventoryReportUseCase(source, builder);

  beforeEach(() => jest.clearAllMocks());

  it('builds a multi-day range live from the ledger (no snapshot)', async () => {
    await uc.execute({ restaurantId: 'r', branchId: 'b', from: '2026-09-01', to: '2026-09-24' });
    expect(builder.buildRange).toHaveBeenCalledWith(
      'r',
      'b',
      '2026-09-01',
      '2026-09-24',
      'Asia/Yerevan',
    );
    expect(source.saveSnapshot).not.toHaveBeenCalled();
  });

  it('treats from == to as the classic single-day report', async () => {
    await uc.execute({ restaurantId: 'r', branchId: 'b', from: '2026-09-20', to: '2026-09-20' });
    expect(builder.buildRange).not.toHaveBeenCalled();
    expect(builder.build).toHaveBeenCalledWith('r', 'b', '2026-09-20', 'Asia/Yerevan');
    expect(source.saveSnapshot).toHaveBeenCalled();
  });

  it('rejects an inverted or too long range', async () => {
    await expect(
      uc.execute({ restaurantId: 'r', branchId: 'b', from: '2026-09-10', to: '2026-09-01' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_DATE_RANGE' } });
    await expect(
      uc.execute({ restaurantId: 'r', branchId: 'b', from: '2024-01-01', to: '2026-01-01' }),
    ).rejects.toMatchObject({ response: { code: 'DATE_RANGE_TOO_LONG' } });
  });
});
