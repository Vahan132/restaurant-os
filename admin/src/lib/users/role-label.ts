'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** What any role list gives us: the stored name plus the canonical role code. */
export interface RoleLabelInput {
  code: string;
  name: string;
  isSystem?: boolean;
}

/**
 * Display name for a role.
 *
 * System roles are seeded from SYSTEM_ROLE_NAMES in the API catalog, which is
 * English-only — so an Armenian or Russian admin read "Kitchen Staff" in an
 * otherwise translated screen. Their `code` is canonical and stable, so the UI
 * prefers a translation keyed by it (`roles.systemName.<CODE>`) and falls back to
 * the stored name, which is what a CUSTOM role must always keep.
 */
export function useRoleLabel(): (role: RoleLabelInput) => string {
  const t = useTranslations('roles');
  return useCallback(
    (role: RoleLabelInput) => {
      const key = `systemName.${role.code}`;
      return role.isSystem !== false && t.has(key) ? t(key) : role.name;
    },
    [t],
  );
}
