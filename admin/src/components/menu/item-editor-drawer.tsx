'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  useItemsControllerAvailability,
  useItemsControllerCreate,
  useItemsControllerGet,
  useItemsControllerPrice,
  useItemsControllerStatus,
  useItemsControllerUpdate,
} from '@/api/generated/menu-items/menu-items';
import { useMediaControllerPresignMenuItemImage } from '@/api/generated/media/media';
import {
  CreateMenuItemDtoPreparationStation,
  MenuItemResponseAvailability,
  MenuItemResponseStatus,
  type CategoryResponse,
  type MenuItemResponse,
  type SetItemAvailabilityDtoAvailability,
  type SetItemStatusDtoStatus,
} from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { ModifierGroupsEditor } from '@/components/menu/modifier-groups-editor';
import {
  TranslationFields,
  descriptionTranslationFields,
  nameTranslationFields,
  primaryLocaleName,
  toI18nDraft,
  EMPTY_I18N,
  type I18nDraft,
} from '@/components/menu/translation-fields';
import { RecipeCostPanel } from '@/components/inventory/recipe-cost-panel';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Field, inputClass } from '@/components/ui/form';
import { ImageUpload } from '@/components/ui/image-upload';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { useRecipeForMenuItem } from '@/lib/inventory/use-recipe-data';
import { useMenuInvalidation } from '@/lib/menu/use-menu-invalidation';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { formatMoney, minorToInput, toMinor } from '@/lib/money';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

const STATIONS = Object.values(CreateMenuItemDtoPreparationStation);

export function ItemEditorDrawer({
  itemId,
  categoryId,
  categories,
  currency,
  onClose,
  initialTab = 'details',
}: {
  itemId: string | null;
  categoryId: string | null;
  categories: CategoryResponse[];
  currency: string;
  onClose: () => void;
  initialTab?: 'details' | 'recipe';
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const ti = useTranslations('inventory');
  const canManage = usePermission(PERMISSIONS.MENU_MANAGE);
  const canSetPrice = usePermission(PERMISSIONS.MENU_ITEM_SET_PRICE);
  const canManageRecipe = usePermission(PERMISSIONS.INVENTORY_RECIPE_MANAGE);
  const { invalidateItems, invalidateItem, invalidateMenuTree, invalidateCategories } =
    useMenuInvalidation();
  const { data: restaurant } = useRestaurant();
  const primaryLocale = restaurant?.defaultLanguage;

  const [tab, setTab] = useState<'details' | 'recipe'>(initialTab);

  // After a create, we switch to edit mode for the new item so the user can
  // immediately manage its modifiers without closing the drawer.
  const [workingId, setWorkingId] = useState<string | null>(itemId);

  const detailQuery = useItemsControllerGet(workingId ?? '', {
    query: { enabled: !!workingId },
  });
  const detail = detailQuery.data;

  // Recipe estimated cost drives the margin helper (read-only to everyone).
  const { recipe } = useRecipeForMenuItem(workingId);
  const estimatedCost = recipe?.estimatedUnitCost_amount ?? null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameI18n, setNameI18n] = useState<I18nDraft>(EMPTY_I18N);
  const [descriptionI18n, setDescriptionI18n] = useState<I18nDraft>(EMPTY_I18N);
  const [formCategoryId, setFormCategoryId] = useState(categoryId ?? categories[0]?.id ?? '');
  const [priceInput, setPriceInput] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [imageKey, setImageKey] = useState<string | undefined>(undefined);
  const [station, setStation] = useState<string>(CreateMenuItemDtoPreparationStation.KITCHEN);
  const [prepTime, setPrepTime] = useState('');
  const [status, setStatus] = useState<string>(MenuItemResponseStatus.ACTIVE);
  const [availability, setAvailability] = useState<string>(
    MenuItemResponseAvailability.AVAILABLE,
  );
  // ADGCODE-UI: the dish-level SRC ATG classifier code (free-text; soft-warned only,
  // never blocks save — SRC is the real validator at fiscalization).
  const [adgCode, setAdgCode] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    category?: string;
    price?: string;
  }>({});

  // Populate the form from the fetched item (edit mode / after create).
  useEffect(() => {
    if (!detail) return;
    setName(detail.name);
    setDescription(detail.description ?? '');
    setNameI18n(toI18nDraft(detail.nameI18n));
    setDescriptionI18n(toI18nDraft(detail.descriptionI18n));
    setFormCategoryId(detail.categoryId);
    setPriceInput(minorToInput(detail.priceAmount, currency));
    setImageUrl(detail.imageUrl ?? '');
    setImageKey(detail.imageKey ?? undefined);
    setStation(detail.preparationStation);
    setPrepTime(detail.prepTimeMinutes != null ? String(detail.prepTimeMinutes) : '');
    setStatus(detail.status);
    setAvailability(detail.availability);
    setAdgCode(detail.adgCode ?? '');
  }, [detail, currency]);

  // ADGCODE-UI: accept 4–15 digits (SRC ATG codes are numeric). Empty is allowed
  // (not yet classified); we do NOT check the value against the SRC lists (v1).
  const ADG_CODE_RE = /^\d{4,15}$/;

  const create = useItemsControllerCreate();
  const update = useItemsControllerUpdate();
  const presignImage = useMediaControllerPresignMenuItemImage();
  const priceMut = useItemsControllerPrice();
  const statusMut = useItemsControllerStatus();
  const availabilityMut = useItemsControllerAvailability();
  const submitting =
    create.isPending ||
    update.isPending ||
    priceMut.isPending ||
    statusMut.isPending ||
    availabilityMut.isPending;

  const validate = (priceMinor: number | null) => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('validation.required');
    if (!formCategoryId) next.category = t('validation.required');
    if (priceMinor === null) next.price = t('validation.invalidPrice');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    const priceMinor = toMinor(priceInput, currency);
    if (!validate(priceMinor)) return;
    const prepTimeMinutes = prepTime.trim() === '' ? undefined : Number(prepTime);

    try {
      if (!workingId) {
        // CREATE: general fields first, then price/status/availability via their
        // dedicated endpoints (the create DTO no longer carries those).
        const created = (await create.mutateAsync({
          data: {
            name: name.trim(),
            categoryId: formCategoryId,
            description: description.trim() || undefined,
            imageUrl: imageKey ? undefined : imageUrl.trim() || undefined,
            imageKey: imageKey || undefined,
            preparationStation: station as CreateMenuItemDtoPreparationStation,
            prepTimeMinutes,
            ...nameTranslationFields(primaryLocale, nameI18n),
            ...descriptionTranslationFields(primaryLocale, descriptionI18n),
          },
        })) as MenuItemResponse;

        // Price is set via its dedicated (audited) endpoint after create, since
        // CreateMenuItemDto no longer accepts a price.
        if (canSetPrice && (priceMinor ?? 0) > 0) {
          await priceMut.mutateAsync({
            id: created.id,
            data: { priceAmount: priceMinor ?? 0 },
          });
        }

        if (status !== MenuItemResponseStatus.ACTIVE) {
          await statusMut.mutateAsync({
            id: created.id,
            data: { status: status as SetItemStatusDtoStatus },
          });
        }
        if (availability !== MenuItemResponseAvailability.AVAILABLE) {
          await availabilityMut.mutateAsync({
            id: created.id,
            data: { availability: availability as SetItemAvailabilityDtoAvailability },
          });
        }
        // ADGCODE-UI: create DTO can't carry adgCode; set it via PATCH after create.
        if (adgCode.trim()) {
          await update.mutateAsync({ id: created.id, data: { adgCode: adgCode.trim() } });
        }
        await Promise.all([invalidateItems(), invalidateMenuTree(), invalidateCategories()]);
        toast.success(t('toast.itemCreated'));
        setWorkingId(created.id);
      } else if (detail) {
        // EDIT: general fields via PATCH; price/status/availability only when
        // changed, each via its dedicated (audited) endpoint.
        await update.mutateAsync({
          id: workingId,
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            imageUrl: imageKey ? undefined : imageUrl.trim() || undefined,
            imageKey: imageKey || undefined,
            categoryId: formCategoryId,
            preparationStation: station as CreateMenuItemDtoPreparationStation,
            prepTimeMinutes,
            // Send the current field value (populated from the dish on load, so an
            // untouched code is preserved); an empty string clears it.
            adgCode: adgCode.trim(),
            ...nameTranslationFields(primaryLocale, nameI18n),
            ...descriptionTranslationFields(primaryLocale, descriptionI18n),
          },
        });
        if (canSetPrice && (priceMinor ?? 0) !== detail.priceAmount) {
          await priceMut.mutateAsync({ id: workingId, data: { priceAmount: priceMinor ?? 0 } });
          toast.success(t('toast.priceUpdated'));
        }
        if (status !== detail.status) {
          await statusMut.mutateAsync({
            id: workingId,
            data: { status: status as SetItemStatusDtoStatus },
          });
        }
        if (availability !== detail.availability) {
          await availabilityMut.mutateAsync({
            id: workingId,
            data: { availability: availability as SetItemAvailabilityDtoAvailability },
          });
        }
        await Promise.all([
          invalidateItems(),
          invalidateItem(workingId),
          invalidateMenuTree(),
          invalidateCategories(),
        ]);
        toast.success(t('toast.itemUpdated'));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const title = workingId ? t('editItem') : t('addItem');
  const loadingDetail = !!workingId && detailQuery.isLoading;

  // Margin helper (visible to anyone with read): price − estimated cost.
  const priceMinorNow = toMinor(priceInput, currency);
  const marginMinor =
    priceMinorNow != null && estimatedCost != null ? priceMinorNow - estimatedCost : null;
  const marginPct =
    marginMinor != null && priceMinorNow != null && priceMinorNow > 0
      ? (marginMinor / priceMinorNow) * 100
      : null;
  const modifierOptions = (detail?.modifierGroups ?? []).flatMap((g) => g.options);

  return (
    <Drawer
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('close')}
          </Button>
          <Can permission={PERMISSIONS.MENU_MANAGE}>
            <Button variant="primary" onClick={save} disabled={submitting || loadingDetail}>
              {workingId ? tc('save') : tc('create')}
            </Button>
          </Can>
        </>
      }
    >
      {loadingDetail ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-1 border-b border-gray-200">
            {(['details', 'recipe'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {key === 'details' ? ti('tabDetails') : ti('tabRecipe')}
              </button>
            ))}
          </div>

          {tab === 'details' ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <Field
                  label={`${t('itemName')} (${primaryLocaleName(primaryLocale)})`}
                  required
                  error={errors.name}
                >
              <input
                className={inputClass}
                value={name}
                disabled={!canManage}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <TranslationFields
              primaryLocale={primaryLocale}
              label={t('itemName')}
              value={nameI18n}
              onChange={setNameI18n}
              disabled={!canManage}
            />
            <Field label={`${t('description')} (${primaryLocaleName(primaryLocale)})`}>
              <textarea
                className={inputClass}
                rows={2}
                value={description}
                disabled={!canManage}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <TranslationFields
              primaryLocale={primaryLocale}
              label={t('description')}
              value={descriptionI18n}
              onChange={setDescriptionI18n}
              multiline
              disabled={!canManage}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('category')} required error={errors.category}>
                <select
                  className={inputClass}
                  value={formCategoryId}
                  disabled={!canManage}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`${ti('sellPrice')} (${currency})`} required error={errors.price}>
                <input
                  inputMode="decimal"
                  className={inputClass}
                  value={priceInput}
                  disabled={!canSetPrice}
                  onChange={(e) => setPriceInput(e.target.value)}
                />
                {!canSetPrice && (
                  <span className="mt-1 block text-xs text-gray-400">{ti('priceReadOnly')}</span>
                )}
                {marginMinor != null && (
                  <span className="mt-1 block text-xs text-gray-500">
                    {ti('margin')}: {formatMoney(marginMinor, currency)}
                    {marginPct != null && ` (${marginPct.toFixed(1)}%)`}
                  </span>
                )}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('prepStation')}>
                <select
                  className={inputClass}
                  value={station}
                  disabled={!canManage}
                  onChange={(e) => setStation(e.target.value)}
                >
                  {STATIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`station.${s}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('prepTime')}>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={prepTime}
                  disabled={!canManage}
                  onChange={(e) => setPrepTime(e.target.value)}
                />
              </Field>
            </div>
            <Field label={t('adgCode')}>
              <input
                className={inputClass}
                value={adgCode}
                disabled={!canManage}
                inputMode="numeric"
                placeholder={t('adgCodePlaceholder')}
                onChange={(e) => setAdgCode(e.target.value)}
              />
              {adgCode.trim() && !ADG_CODE_RE.test(adgCode.trim()) ? (
                <span className="mt-1 block text-xs text-amber-600">{t('adgCodeWarning')}</span>
              ) : (
                <span className="mt-1 block text-xs text-gray-500">{t('adgCodeHelper')}</span>
              )}
            </Field>
            <Field label={t('imageUrl')}>
              <input
                className={inputClass}
                value={imageUrl}
                disabled={!canManage}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageKey(undefined);
                }}
              />
            </Field>
            <ImageUpload
              previewUrl={imageUrl || null}
              disabled={!canManage}
              presign={async (contentType) => {
                const r = await presignImage.mutateAsync({ data: { contentType } });
                return { url: r.url, key: r.key };
              }}
              onUploaded={(key) => setImageKey(key)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('status')}>
                <select
                  className={inputClass}
                  value={status}
                  disabled={!canManage}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value={MenuItemResponseStatus.ACTIVE}>{t('active')}</option>
                  <option value={MenuItemResponseStatus.INACTIVE}>{t('inactive')}</option>
                </select>
              </Field>
              <Field label={t('availability')}>
                <select
                  className={inputClass}
                  value={availability}
                  disabled={!canManage}
                  onChange={(e) => setAvailability(e.target.value)}
                >
                  <option value={MenuItemResponseAvailability.AVAILABLE}>{t('available')}</option>
                  <option value={MenuItemResponseAvailability.UNAVAILABLE}>
                    {t('unavailable')}
                  </option>
                </select>
              </Field>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">{t('modifiers')}</h3>
            {workingId && detail ? (
              <ModifierGroupsEditor
                itemId={workingId}
                groups={detail.modifierGroups}
                currency={currency}
                onChanged={async () => {
                  await Promise.all([invalidateItem(workingId), invalidateMenuTree()]);
                }}
              />
            ) : (
              <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                {t('saveItemFirst')}
              </p>
            )}
              </div>
            </div>
          ) : workingId && detail ? (
            <RecipeCostPanel
              menuItemId={workingId}
              currency={currency}
              modifierOptions={modifierOptions}
              canManage={canManageRecipe}
            />
          ) : (
            <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
              {ti('saveItemFirstRecipe')}
            </p>
          )}
        </>
      )}
    </Drawer>
  );
}
