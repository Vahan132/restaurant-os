/**
 * Top-level shape (locked decision D): one Organization → one Restaurant → two
 * Branches (a Yerevan flagship + a Gyumri second location), so branch isolation
 * is exercised end to end. Realistic Armenian names throughout; currency AMD.
 */
import { seedId } from '../ids';

export const ORG = {
  id: seedId('org:areni-group'),
  name: 'Արենի Հյուրասիրություն ՍՊԸ', // Areni Hospitality LLC
  slug: 'areni-group',
};

export const RESTAURANT = {
  id: seedId('restaurant:tavern-ararat'),
  name: 'Թավերն Արարատ', // Tavern Ararat
  slug: 'tavern-ararat',
  currency: 'AMD',
  defaultLanguage: 'hy',
  timezone: 'Asia/Yerevan',
};

export interface BranchSeed {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
}

export const BRANCHES: Record<'flagship' | 'second', BranchSeed> = {
  flagship: {
    id: seedId('branch:yerevan-kentron'),
    name: 'Կենտրոն (Երևան)', // Center (Yerevan)
    slug: 'yerevan-kentron',
    isDefault: true,
  },
  second: {
    id: seedId('branch:gyumri'),
    name: 'Գյումրի', // Gyumri
    slug: 'gyumri',
    isDefault: false,
  },
};

export const BRANCH_LIST: BranchSeed[] = [BRANCHES.flagship, BRANCHES.second];

/** Shared dev password for every seeded staff account (printed at the end). */
export const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? 'ChangeMe123!';

export const PLATFORM_ADMIN = {
  email: 'admin@platform.test',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'AdminPass123!',
  fullName: 'Platform Admin',
};
