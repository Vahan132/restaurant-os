'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useAdminConsumerListingControllerCreatePhoto,
  useAdminConsumerListingControllerDeletePhoto,
  useAdminConsumerListingControllerOrderPhotos,
} from '@/api/generated/admin-consumer-listing/admin-consumer-listing';
import type { PhotoResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { useConfirm } from '@/components/ui/use-confirm';
import {
  EMPTY_I18N,
  fromI18nDraft,
  I18nTextEditor,
  type I18nDraft,
} from '@/components/consumer-listing/i18n-text-editor';
import { getErrorMessage } from '@/lib/api-error';
import { useConsumerListingInvalidation } from '@/lib/consumer-listing/use-consumer-listing';
import { toast } from '@/stores/toast';

/** 1×1 transparent-on-grey fallback for photos whose URL fails to load. */
const FALLBACK_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#f3f4f6"/><path d="M20 56l14-18 10 12 6-7 10 13z" fill="#d1d5db"/><circle cx="30" cy="28" r="6" fill="#d1d5db"/></svg>',
  );

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function PhotosEditor({
  photos,
  disabled,
}: {
  photos: PhotoResponse[];
  disabled?: boolean;
}) {
  const t = useTranslations('consumerListing');
  const tc = useTranslations('common');
  const { invalidateRestaurant } = useConsumerListingInvalidation();
  const { ask, dialog } = useConfirm();

  const createPhoto = useAdminConsumerListingControllerCreatePhoto();
  const deletePhoto = useAdminConsumerListingControllerDeletePhoto();
  const orderPhotos = useAdminConsumerListingControllerOrderPhotos();

  const [url, setUrl] = useState('');
  const [showAlt, setShowAlt] = useState(false);
  const [alt, setAlt] = useState<I18nDraft>(EMPTY_I18N);
  const [error, setError] = useState<string>();
  const [broken, setBroken] = useState<Set<string>>(new Set());

  const ordered = [...photos].sort((a, b) => a.position - b.position);
  const busy =
    createPhoto.isPending || deletePhoto.isPending || orderPhotos.isPending;

  const add = async () => {
    const trimmed = url.trim();
    if (!isHttpsUrl(trimmed)) {
      setError(t('photos.httpsError'));
      return;
    }
    setError(undefined);
    try {
      const altPayload = fromI18nDraft(alt);
      const hasAlt = altPayload.en || altPayload.ru || altPayload.hy;
      await createPhoto.mutateAsync({
        data: { url: trimmed, ...(hasAlt ? { alt: altPayload } : {}) },
      });
      await invalidateRestaurant();
      setUrl('');
      setAlt(EMPTY_I18N);
      setShowAlt(false);
      toast.success(t('photos.added'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (photo: PhotoResponse) => {
    const ok = await ask({
      title: t('photos.deleteTitle'),
      message: t('photos.deleteConfirm'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
    });
    if (!ok) return;
    try {
      await deletePhoto.mutateAsync({ photoId: photo.id });
      await invalidateRestaurant();
      toast.success(t('photos.deleted'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...ordered];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    // Both indices are in-range per the guard above; swap via temps so
    // noUncheckedIndexedAccess doesn't widen the slots to `| undefined`.
    const a = next[index]!;
    const b = next[target]!;
    next[index] = b;
    next[target] = a;
    try {
      await orderPhotos.mutateAsync({
        data: { orderedPhotoIds: next.map((p) => p.id) },
      });
      await invalidateRestaurant();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const markBroken = (id: string) =>
    setBroken((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  return (
    <div className="space-y-4">
      {ordered.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-500">
          {t('photos.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {ordered.map((photo, i) => (
            <li
              key={photo.id}
              className="flex items-center gap-3 rounded-md border border-gray-200 p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={broken.has(photo.id) ? FALLBACK_SRC : photo.url}
                alt={photo.alt?.en ?? ''}
                onError={() => markBroken(photo.id)}
                className="h-14 w-14 shrink-0 rounded object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-gray-600">
                {photo.url}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('photos.moveUp')}
                  disabled={disabled || busy || i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('photos.moveDown')}
                  disabled={disabled || busy || i === ordered.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={disabled || busy}
                  onClick={() => remove(photo)}
                >
                  {tc('delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <div className="space-y-2 rounded-md border border-gray-200 p-3">
          <Field label={t('photos.addLabel')} error={error}>
            <input
              className={inputClass}
              value={url}
              placeholder="https://…"
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <p className="text-xs text-gray-500">{t('photos.rightsNote')}</p>

          <button
            type="button"
            className="text-xs font-medium text-brand hover:underline"
            onClick={() => setShowAlt((v) => !v)}
          >
            {showAlt ? t('photos.hideAlt') : t('photos.addAlt')}
          </button>
          {showAlt && <I18nTextEditor value={alt} onChange={setAlt} />}

          <Button variant="primary" onClick={add} disabled={busy || !url.trim()}>
            {t('photos.addButton')}
          </Button>
        </div>
      )}
      {dialog}
    </div>
  );
}
