'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  ALLOWED_IMAGE_TYPES,
  putToPresignedUrl,
  validateImageFile,
} from '@/lib/media/upload';

export interface PresignResult {
  url: string;
  key: string;
}

/**
 * Reusable image upload control: pick/drop a file -> client-validate (type/size)
 * -> presign -> direct PUT to R2 (bypassing the app axios) -> finalize via
 * `onUploaded(key)` -> preview. Decoupled from any generated hook: the parent
 * supplies `presign` (usually wrapping a media presign mutation). The URL-paste
 * fallback lives in the parent, alongside this control.
 */
export function ImageUpload({
  previewUrl,
  presign,
  onUploaded,
  disabled,
  shape = 'wide',
  keepPreview = true,
}: {
  /** Current served image URL for the preview (parent-controlled). */
  previewUrl?: string | null;
  /** Ask the backend for a presigned PUT for this content-type. */
  presign: (contentType: string) => Promise<PresignResult>;
  /** Called with the server-generated key after a successful upload (finalize). */
  onUploaded: (key: string) => Promise<void> | void;
  disabled?: boolean;
  /** Preview aspect: 'wide' for single fields, 'square' for logo/thumbnails. */
  shape?: 'wide' | 'square';
  /** Keep the just-uploaded image as the preview. Set false for collection adds. */
  keepPreview?: boolean;
}) {
  const t = useTranslations('mediaUpload');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string>();

  // Revoke the object URL when it changes or the control unmounts.
  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );

  const handleFile = async (file?: File) => {
    if (!file || disabled || uploading) return;
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem === 'size' ? t('errorSize') : t('errorType'));
      return;
    }
    setError(undefined);
    setUploading(true);
    try {
      const { url, key } = await presign(file.type);
      await putToPresignedUrl(url, file);
      await onUploaded(key);
      if (keepPreview) {
        const obj = URL.createObjectURL(file);
        setLocalPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return obj;
        });
      }
    } catch {
      setError(t('errorUpload'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const open = () => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  const preview = localPreview ?? previewUrl ?? undefined;
  const box = shape === 'square' ? 'h-28 w-28' : 'h-28 w-full max-w-xs';

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={t('choose')}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        }}
        onDragOver={(e) => {
          if (!disabled) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex ${box} items-center justify-center overflow-hidden rounded-md border-2 border-dashed text-center text-xs transition-colors ${
          dragOver ? 'border-brand bg-brand/5' : 'border-gray-300'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-brand'}`}
      >
        {uploading ? (
          <span className="text-gray-500">{t('uploading')}</span>
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-gray-500">{t('dropHint')}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        className="hidden"
        disabled={disabled}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || uploading}
          onClick={open}
        >
          {uploading ? t('uploading') : t('choose')}
        </Button>
        <span className="text-xs text-gray-400">{t('constraints')}</span>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
