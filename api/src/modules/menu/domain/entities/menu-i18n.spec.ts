import 'reflect-metadata';
import { ItemMapper, OptionMapper } from '../../infrastructure/persistence/menu.mappers';
import { MenuCategory } from './menu-category';
import { MenuItem } from './menu-item';
import { ModifierOption } from './modifier-option';

describe('LOCALE-2A trilingual menu content', () => {
  describe('MenuItem', () => {
    const baseCreate = {
      id: 'i1',
      restaurantId: 'r1',
      branchId: 'b1',
      code: 'burger',
      categoryId: 'c1',
      name: 'Burger',
      priceAmount: 0,
    };

    it('create persists primary + provided name/description translations (missing → null)', () => {
      const item = MenuItem.create({
        ...baseCreate,
        nameHy: 'Բուրգեր',
        nameRu: 'Бургер',
        descriptionRu: 'Вкусно',
      });
      expect(item.name).toBe('Burger'); // primary unchanged
      expect(item.nameI18n).toEqual({ hy: 'Բուրգեր', ru: 'Бургер', en: null });
      expect(item.descriptionI18n).toEqual({ hy: null, ru: 'Вкусно', en: null });
      // "persist" = the mapper writes the columns.
      const row = ItemMapper.toCreate(item);
      expect(row).toMatchObject({
        name: 'Burger',
        nameHy: 'Բուրգեր',
        nameRu: 'Бургер',
        nameEn: null,
        descriptionRu: 'Вкусно',
      });
    });

    it('update sets, clears (explicit null), and leaves (absent) translations independently', () => {
      const item = MenuItem.create({ ...baseCreate, nameHy: 'Հ', nameRu: 'Р' });
      item.updateDetails({ nameRu: null, nameEn: 'Burger' }); // clear ru, set en, leave hy
      expect(item.nameI18n).toEqual({ hy: 'Հ', ru: null, en: 'Burger' });
      expect(ItemMapper.toUpdate(item)).toMatchObject({ nameHy: 'Հ', nameRu: null, nameEn: 'Burger' });
    });

    it('existing rows with no translations stay null (no accidental writes)', () => {
      const item = MenuItem.create(baseCreate);
      expect(item.nameI18n).toEqual({ hy: null, ru: null, en: null });
      item.updateDetails({ description: 'Tasty' }); // primary-only edit
      expect(item.nameI18n).toEqual({ hy: null, ru: null, en: null });
      expect(item.descriptionI18n).toEqual({ hy: null, ru: null, en: null });
    });
  });

  describe('MenuCategory.rename carries translations', () => {
    it('applies provided translations, leaves absent ones', () => {
      const cat = MenuCategory.create({
        id: 'c1',
        restaurantId: 'r1',
        branchId: 'b1',
        code: 'drinks',
        name: 'Drinks',
        nameHy: 'Ը',
      });
      cat.rename('Drinks', undefined, { nameRu: 'Напитки', nameHy: null });
      expect(cat.nameI18n).toEqual({ hy: null, ru: 'Напитки', en: null });
      expect(cat.name).toBe('Drinks');
    });
  });

  describe('ModifierOption', () => {
    it('create + update name translations round-trip through the mapper', () => {
      const opt = ModifierOption.create({
        id: 'o1',
        restaurantId: 'r1',
        branchId: 'b1',
        modifierGroupId: 'g1',
        name: 'Large',
        nameRu: 'Большой',
      });
      expect(opt.nameI18n).toEqual({ hy: null, ru: 'Большой', en: null });
      opt.update({ nameHy: 'Mets' }); // set hy, leave ru unchanged
      expect(OptionMapper.toUpdate(opt)).toMatchObject({ nameHy: 'Mets', nameRu: 'Большой', nameEn: null });
    });
  });
});
