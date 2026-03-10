import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

const LS_KEY = 'itemsCatalog.v1';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Categorias PDV para cafeteria/doceria */
export const PDV_CATEGORIES = [
  { id: 'cafes', label: 'Cafés', icon: 'coffee' },
  { id: 'bebidas-geladas', label: 'Bebidas geladas', icon: 'cup-soda' },
  { id: 'doces', label: 'Doces', icon: 'cake' },
  { id: 'salgados', label: 'Salgados', icon: 'sandwich' },
  { id: 'shakes', label: 'Shakes & Suplementos', icon: 'dumbbell' },
  { id: 'acai', label: 'Açaí & Bowls', icon: 'citrus' },
  { id: 'fit', label: 'Snacks Fit', icon: 'zap' },
  { id: 'combos', label: 'Combos', icon: 'package' },
  { id: 'outros', label: 'Outros', icon: 'grid-3x3' },
] as const;

export type PdvCategoryId = (typeof PDV_CATEGORIES)[number]['id'];

export interface CatalogItem {
  id: string;
  name: string;
  recipeId: string | null;
  cmv: number;
  feesPct: number;
  suggestedPrice: number;
  useManualPrice: boolean;
  manualPrice: number;
  /** Categoria para exibição no PDV (id de PDV_CATEGORIES) */
  categoryId?: PdvCategoryId | null;
  /** Código de barras para leitura no PDV */
  barcode?: string | null;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(2, 8);
}

@Injectable({ providedIn: 'root' })
export class ItemsCatalogService {
  private readonly storage = inject(StorageService);
  private readonly itemsSignal = signal<CatalogItem[]>(this.load());

  readonly items = this.itemsSignal.asReadonly();

  private load(): CatalogItem[] {
    const parsed = this.storage.get<CatalogItem[]>(LS_KEY);
    return Array.isArray(parsed) ? parsed : [];
  }

  private persist(): void {
    this.storage.set(LS_KEY, this.itemsSignal());
  }

  reload(): void {
    this.itemsSignal.set(this.load());
  }

  /** Preço efetivo do item (manual se habilitado, senão sugerido). */
  effectivePrice(item: CatalogItem): number {
    return item.useManualPrice ? item.manualPrice : item.suggestedPrice;
  }

  /** Produtos filtrados por categoria (id ou 'outros' se sem categoria). */
  getByCategory(categoryId: PdvCategoryId): CatalogItem[] {
    return this.itemsSignal().filter((i) => (i.categoryId ?? 'outros') === categoryId);
  }

  /** Busca produto por código de barras. */
  findByBarcode(barcode: string): CatalogItem | null {
    const normalized = (barcode || '').trim();
    if (!normalized) return null;
    return this.itemsSignal().find((i) => (i.barcode ?? '').trim() === normalized) ?? null;
  }

  /** Filtra produtos pelo nome (busca). */
  searchByName(query: string): CatalogItem[] {
    const q = (query || '').trim().toLowerCase();
    if (!q) return this.itemsSignal();
    return this.itemsSignal().filter((i) => i.name.toLowerCase().includes(q));
  }

  /** Sincroniza um item a partir da calculadora de precificação (receita + resultado). */
  syncFromRecipe(data: {
    recipeId: string;
    name: string;
    cmv: number;
    feesPct: number;
    suggestedPrice: number;
  }): void {
    const list = this.itemsSignal();
    const existing = list.find((i) => i.recipeId === data.recipeId);
    const base: CatalogItem = {
      id: existing?.id ?? uid(),
      name: data.name,
      recipeId: data.recipeId,
      cmv: data.cmv,
      feesPct: data.feesPct,
      suggestedPrice: data.suggestedPrice,
      useManualPrice: existing?.useManualPrice ?? false,
      manualPrice: existing?.manualPrice ?? data.suggestedPrice,
      categoryId: existing?.categoryId ?? 'outros',
      barcode: existing?.barcode ?? null,
    };
    if (existing) {
      this.itemsSignal.update((arr) =>
        arr.map((i) => (i.recipeId === data.recipeId ? { ...base, id: i.id } : i))
      );
    } else {
      this.itemsSignal.update((arr) => [...arr, { ...base, manualPrice: data.suggestedPrice }]);
    }
    this.persist();
  }

  setUseManualPrice(id: string, use: boolean): void {
    this.itemsSignal.update((arr) =>
      arr.map((i) => (i.id === id ? { ...i, useManualPrice: use } : i))
    );
    this.persist();
  }

  setManualPrice(id: string, value: number): void {
    this.itemsSignal.update((arr) =>
      arr.map((i) => (i.id === id ? { ...i, manualPrice: Math.max(0, value) } : i))
    );
    this.persist();
  }

  removeItem(id: string): void {
    this.itemsSignal.update((arr) => arr.filter((i) => i.id !== id));
    this.persist();
  }

  money(v: number): string {
    return BRL.format(Number.isFinite(v) ? v : 0);
  }
}
