'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type {
  CatalogTaxonomyResponse,
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Field, inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';
import { getErrorMessage } from '@/lib/api-error';
import {
  taxonomyLabel,
  useCatalogCreate,
  useCatalogUpdate,
  type CatalogItemVM,
} from '@/lib/platform-catalog/use-catalog';
import { toast } from '@/stores/toast';

export function CatalogItemForm({
  item,
  taxonomy,
  onClose,
  onSaved,
}: {
  item: CatalogItemVM | null;
  taxonomy?: CatalogTaxonomyResponse;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations('platformCatalog');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isEdit = item !== null;

  const [slug, setSlug] = useState(item?.slug ?? '');
  const [nameHy, setNameHy] = useState(item?.nameHy ?? '');
  const [nameRu, setNameRu] = useState(item?.nameRu ?? '');
  const [nameEn, setNameEn] = useState(item?.nameEn ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [adgCode, setAdgCode] = useState(item?.adgCode ?? '');
  const [allergens, setAllergens] = useState<Set<string>>(
    new Set(item?.allergenSlugs ?? []),
  );
  const [allergensReviewed, setAllergensReviewed] = useState(
    item?.allergensReviewed ?? false,
  );
  const [error, setError] = useState<string | undefined>();

  const createMut = useCatalogCreate();
  const updateMut = useCatalogUpdate();
  const submitting = createMut.isPending || updateMut.isPending;

  const allergenOptions = useMemo(
    () => [...(taxonomy?.allergens ?? [])].sort((a, b) => a.position - b.position),
    [taxonomy],
  );
  const categories = useMemo(
    () => [...(taxonomy?.categories ?? [])].sort((a, b) => a.position - b.position),
    [taxonomy],
  );

  const toggle = (s: string) =>
    setAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const save = async () => {
    if (!isEdit && !slug.trim()) {
      setError(t('validSlug'));
      return;
    }
    if (!nameHy.trim() || !nameRu.trim() || !nameEn.trim()) {
      setError(t('validNames'));
      return;
    }
    setError(undefined);
    // orval mistyped the nullable fields as object|null; coerce at this boundary.
    const categoryValue = (categoryId || null) as unknown;
    const adgValue = (adgCode.trim() || null) as unknown;
    try {
      if (isEdit && item) {
        const data: UpdateCatalogItemDto = {
          nameHy: nameHy.trim(),
          nameRu: nameRu.trim(),
          nameEn: nameEn.trim(),
          categoryId: categoryValue as UpdateCatalogItemDto['categoryId'],
          adgCode: adgValue as UpdateCatalogItemDto['adgCode'],
          allergenSlugs: [...allergens],
          allergensReviewed,
        };
        await updateMut.mutateAsync({ id: item.id, data });
        toast.success(t('updated'));
      } else {
        const data: CreateCatalogItemDto = {
          slug: slug.trim(),
          nameHy: nameHy.trim(),
          nameRu: nameRu.trim(),
          nameEn: nameEn.trim(),
          categoryId: categoryValue as CreateCatalogItemDto['categoryId'],
          adgCode: adgValue as CreateCatalogItemDto['adgCode'],
          allergenSlugs: [...allergens],
          allergensReviewed,
        };
        await createMut.mutateAsync({ data });
        toast.success(t('created'));
      }
      await onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Drawer
      open
      title={isEdit ? t('editTitle') : t('createTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting}>
            {submitting ? tc('loading') : tc('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!isEdit && (
          <Field label={t('slug')} required>
            <input
              className={inputClass}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="wheat-flour"
            />
          </Field>
        )}

        <Field label={`${t('name')} (HY)`} required>
          <input className={inputClass} value={nameHy} onChange={(e) => setNameHy(e.target.value)} />
        </Field>
        <Field label={`${t('name')} (RU)`} required>
          <input className={inputClass} value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
        </Field>
        <Field label={`${t('name')} (EN)`} required>
          <input className={inputClass} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>

        <Field label={t('category')}>
          <select
            className={inputClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t('noCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {taxonomyLabel(c, locale)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('adgCode')}>
          <input
            className={inputClass}
            value={adgCode}
            onChange={(e) => setAdgCode(e.target.value)}
            placeholder={t('adgCodePlaceholder')}
          />
        </Field>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-gray-700">{t('allergens')}</span>
          {allergenOptions.length === 0 ? (
            <p className="text-xs text-gray-500">{t('noAllergens')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allergenOptions.map((a) => {
                const checked = allergens.has(a.slug);
                return (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                      checked
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggle(a.slug)}
                    />
                    {taxonomyLabel(a, locale)}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* CATALOG-3-SUPPORT: the tagging gate. Flipping true lets dishes show verified allergens. */}
        <Toggle
          label={t('reviewed')}
          description={t('reviewedDesc')}
          checked={allergensReviewed}
          onChange={setAllergensReviewed}
        />

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Drawer>
  );
}
