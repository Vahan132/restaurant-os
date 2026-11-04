'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { useAdminConsumerListingControllerPutAttributes } from '@/api/generated/admin-consumer-listing/admin-consumer-listing';
import { usePublicDiscoveryControllerAttributes } from '@/api/generated/discovery/discovery';
import type { AttributeCategoryResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-error';
import { attributeLabel, useConsumerListingInvalidation } from '@/lib/consumer-listing/use-consumer-listing';
import { isLocale, defaultLocale } from '@/i18n/config';
import { normalizeList } from '@/lib/normalize-list';
import { toast } from '@/stores/toast';

export function AttributesSelector({
  selectedIds,
  disabled,
}: {
  selectedIds: string[];
  disabled?: boolean;
}) {
  const t = useTranslations('consumerListing');
  const tc = useTranslations('common');
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const { invalidateRestaurant } = useConsumerListingInvalidation();

  const { data, isLoading } = usePublicDiscoveryControllerAttributes();
  // The mutator unwraps list endpoints to `{ items, pagination }`; normalize so
  // we always get an array regardless of whether the envelope is paginated.
  const categories = normalizeList<AttributeCategoryResponse>(data).items;
  const putAttributes = useAdminConsumerListingControllerPutAttributes();

  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  // Re-seed when the server set changes (e.g. after a refetch).
  useEffect(() => {
    setSelected(new Set(selectedIds));
  }, [selectedIds]);

  const initial = useMemo(() => new Set(selectedIds), [selectedIds]);
  const dirty =
    selected.size !== initial.size ||
    [...selected].some((id) => !initial.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    try {
      await putAttributes.mutateAsync({
        data: { attributeValueIds: [...selected] },
      });
      await invalidateRestaurant();
      toast.success(t('attributes.saved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return <p className="text-xs text-gray-500">{t('attributes.empty')}</p>;
  }

  const sortedCats = [...categories].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      {sortedCats.map((cat) => (
        <fieldset key={cat.id} className="space-y-2">
          <legend className="text-sm font-medium text-gray-800">
            {attributeLabel(cat, locale)}
          </legend>
          <div className="flex flex-wrap gap-2">
            {[...cat.values]
              .sort((a, b) => a.position - b.position)
              .map((value) => {
                const checked = selected.has(value.id);
                return (
                  <label
                    key={value.id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                      checked
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(value.id)}
                    />
                    {attributeLabel(value, locale)}
                  </label>
                );
              })}
          </div>
        </fieldset>
      ))}

      {!disabled && (
        <Button
          variant="primary"
          onClick={save}
          disabled={putAttributes.isPending || !dirty}
        >
          {tc('save')}
        </Button>
      )}
    </div>
  );
}
