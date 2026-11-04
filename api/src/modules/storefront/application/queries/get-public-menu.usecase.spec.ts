import 'reflect-metadata';
import { Locale } from '../../../../shared/i18n/locale';
import { PublicStorefrontQuery } from '../ports/public-query.port';
import { GetPublicMenuUseCase } from './get-public-menu.usecase';

/** Records the locale menuTree was invoked with, so we can assert the resolution. */
class FakeQuery {
  public menuTreeLocale: Locale | null = null;
  constructor(private readonly defaultLang: string) {}

  async menuCurrency(): Promise<string> {
    return 'AMD';
  }
  async defaultLanguage(): Promise<string> {
    return this.defaultLang;
  }
  async defaultBranchId(): Promise<string | null> {
    return 'branch-default';
  }
  async menuTree(_restaurantId: string, _branchId: string, locale: Locale) {
    this.menuTreeLocale = locale;
    return [];
  }
}

function make(defaultLang: string) {
  const query = new FakeQuery(defaultLang);
  const useCase = new GetPublicMenuUseCase(query as unknown as PublicStorefrontQuery);
  return { useCase, query };
}

const base = { restaurantId: 'r1', branchId: 'b1' };

describe('GetPublicMenuUseCase — LOCALE-1 effective locale', () => {
  it('uses the guest requested locale (X-Locale) when valid', async () => {
    const { useCase, query } = make('en');
    await useCase.execute({ ...base, requestedLocale: 'hy' });
    expect(query.menuTreeLocale).toBe('hy');
  });

  it('falls back to the restaurant defaultLanguage when no X-Locale', async () => {
    const { useCase, query } = make('ru');
    await useCase.execute({ ...base, requestedLocale: null });
    expect(query.menuTreeLocale).toBe('ru');
  });

  it('falls back to en when neither request nor default is a supported locale', async () => {
    const { useCase, query } = make('fr'); // unsupported default
    await useCase.execute({ ...base, requestedLocale: null });
    expect(query.menuTreeLocale).toBe('en');
  });

  it('threads the resolved locale on the branch-explicit path too', async () => {
    const { useCase, query } = make('en');
    await useCase.execute({ restaurantId: 'r1', branchId: 'b9', requestedLocale: 'ru' });
    expect(query.menuTreeLocale).toBe('ru');
  });
});
