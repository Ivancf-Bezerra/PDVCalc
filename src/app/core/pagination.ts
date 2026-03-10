import { signal } from '@angular/core';

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export type TablePageSizeMap = Record<string, number>;
export type TablePageMap = Record<string, number>;

export interface TablePaginationInfo {
  start: number;
  end: number;
  total: number;
  totalPages: number;
  currentPage: number;
}

export function createTablePagination(defaultPageSize = 5) {
  const tablePageSize = signal<TablePageSizeMap>({});
  const tablePage = signal<TablePageMap>({});

  const getTablePage = (tableId: string): number => {
    return tablePage()[tableId] ?? 1;
  };

  const setTablePage = (tableId: string, page: number): void => {
    tablePage.update((m) => ({ ...m, [tableId]: Math.max(1, page) }));
  };

  const getTablePageSize = (tableId: string): number => {
    return tablePageSize()[tableId] ?? defaultPageSize;
  };

  const setTablePageSize = (tableId: string, size: number): void => {
    tablePageSize.update((m) => ({ ...m, [tableId]: size }));
    setTablePage(tableId, 1);
  };

  const onPageSizeChange = (tableId: string, size: number | string): void => {
    setTablePageSize(tableId, Number(size));
  };

  const paginate = <T>(items: T[], tableId: string): T[] => {
    const size = getTablePageSize(tableId);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const page = Math.min(getTablePage(tableId), totalPages);
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  };

  const paginatedLength = (items: unknown[] | undefined | null, tableId: string): number => {
    return paginate(items ?? [], tableId).length;
  };

  const paginationInfo = (items: unknown[], tableId: string): TablePaginationInfo => {
    const total = items.length;
    const size = getTablePageSize(tableId);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.min(getTablePage(tableId), totalPages);
    const start = total === 0 ? 0 : (currentPage - 1) * size + 1;
    const end = total === 0 ? 0 : Math.min(currentPage * size, total);
    return { start, end, total, totalPages, currentPage };
  };

  return {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    tablePageSize,
    tablePage,
    getTablePage,
    setTablePage,
    getTablePageSize,
    setTablePageSize,
    onPageSizeChange,
    paginate,
    paginatedLength,
    paginationInfo,
  };
}

