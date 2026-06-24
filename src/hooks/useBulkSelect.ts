'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * 2026-06-24: 리스트 행 일괄 선택 + 삭제용 hook.
 *
 * - selectedIds: 선택된 행 id Set
 * - toggle(id): 한 행 on/off
 * - clear(): 전체 해제
 * - setAll(ids): 헤더 ☐ — 전체 선택 / 일부 선택 시 전체 해제
 * - isAllSelected / isPartiallySelected: 헤더 체크박스 상태 결정용
 */
export function useBulkSelect(allIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allIds));
  }, [allIds]);

  const isAllSelected = useMemo(
    () => allIds.length > 0 && allIds.every(id => selectedIds.has(id)),
    [allIds, selectedIds],
  );
  const isPartiallySelected = useMemo(
    () => !isAllSelected && allIds.some(id => selectedIds.has(id)),
    [allIds, selectedIds, isAllSelected],
  );

  const toggleAll = useCallback(() => {
    if (isAllSelected || isPartiallySelected) {
      clear();
    } else {
      selectAll();
    }
  }, [isAllSelected, isPartiallySelected, clear, selectAll]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggle,
    clear,
    selectAll,
    toggleAll,
    isAllSelected,
    isPartiallySelected,
    isSelected: (id: string) => selectedIds.has(id),
  };
}
