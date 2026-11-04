import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useFiltersStore } from './filters';

function reset() {
  useFiltersStore.setState({
    searchQuery: '',
    selectedAttributeValueIds: [],
    pendingExpandCategoryId: null,
  });
}

test('toggleValue adds then removes an id', () => {
  reset();
  const s = useFiltersStore.getState();
  s.toggleValue('a');
  assert.deepEqual(useFiltersStore.getState().selectedAttributeValueIds, ['a']);
  useFiltersStore.getState().toggleValue('a');
  assert.deepEqual(useFiltersStore.getState().selectedAttributeValueIds, []);
});

test('isSelected + countSelectedIn reflect state', () => {
  reset();
  useFiltersStore.getState().toggleValue('a');
  useFiltersStore.getState().toggleValue('c');
  assert.equal(useFiltersStore.getState().isSelected('a'), true);
  assert.equal(useFiltersStore.getState().isSelected('b'), false);
  assert.equal(useFiltersStore.getState().countSelectedIn(['a', 'b', 'c']), 2);
});

test('clearSelected wipes ids but leaves search intact', () => {
  reset();
  useFiltersStore.getState().setSearchQuery('pizza');
  useFiltersStore.getState().toggleValue('a');
  useFiltersStore.getState().clearSelected();
  assert.deepEqual(useFiltersStore.getState().selectedAttributeValueIds, []);
  assert.equal(useFiltersStore.getState().searchQuery, 'pizza');
});
