import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

const LS_KEY = 'itemsCatalog.v1';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Prefixos de 3 letras para código global (tipo de lista) + 4 números em ordem de cadastro. Ex.: REC0001, REV0002 */
export const GLOBAL_CODE_PREFIX = {
  /** Itens da Calculadora de Precificação (receitas). */
  REC: 'REC',
  /** Itens do Cadastro de Produtos (revenda). */
  REV: 'REV',
} as const;

const CODE_PREFIX_REC = 'REC';
const CODE_PREFIX_REV = 'REV';
const CODE_REGEX = /^(REC|REV)(\d{4})$/i;

/** Retorna o próximo número de sequência para o prefixo (1-based). */
function getNextSequenceNumber(list: CatalogItem[], prefix: string): number {
  const pre = prefix.toUpperCase();
  const numbers = list
    .map((i) => i.globalCode && i.globalCode.toUpperCase().startsWith(pre) ? i.globalCode.slice(3) : '')
    .filter((s) => /^\d{4}$/.test(s))
    .map((s) => parseInt(s, 10));
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return max + 1;
}

/** Gera código no formato XXX0001 (3 letras + 4 dígitos). */
function buildGlobalCode(prefix: string, sequence: number): string {
  return prefix.toUpperCase() + String(sequence).padStart(4, '0');
}

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

/** Unidades de venda comuns para produtos de revenda */
export const SALE_UNITS = [
  { id: 'un', label: 'Unidade' },
  { id: 'cx', label: 'Caixa' },
  { id: 'pct', label: 'Pacote' },
  { id: 'kg', label: 'Kg' },
  { id: 'g', label: 'g' },
  { id: 'L', label: 'L' },
  { id: 'ml', label: 'ml' },
  { id: 'outro', label: 'Outro' },
] as const;

export type SaleUnitId = (typeof SALE_UNITS)[number]['id'];

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
  /** Código global de cadastro (3 letras + 4 números, ex.: REC0001, REV0002). Atribuído automaticamente. */
  globalCode?: string | null;
  /** Unidade de venda (revenda): un, cx, pct, kg, L, ml, g, outro */
  saleUnit?: SaleUnitId | string | null;
  /** Quantidade na embalagem (ex.: 12 latas na caixa). 0 ou null = não informado */
  quantityPerPackage?: number | null;
  /** Tamanho ou volume (ex.: 350ml, 1L, 500g) */
  sizeOrVolume?: string | null;
  /** Marca do produto */
  brand?: string | null;
  /** Observações */
  notes?: string | null;
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
    const list = Array.isArray(parsed) ? parsed : [];
    return this.migrateRevendaCmvMarkup(this.migrateGlobalCodes(list));
  }

  /** Migra itens de revenda antigos (cmv 0, useManualPrice true): define CMV = manualPrice, markup 30%, valor sugerido. */
  private migrateRevendaCmvMarkup(list: CatalogItem[]): CatalogItem[] {
    let changed = false;
    const out = list.map((i) => {
      if (i.recipeId != null || i.cmv > 0 || !i.useManualPrice) return i;
      const cmv = i.manualPrice ?? 0;
      const pct = 30;
      const suggestedPrice = Math.round(cmv * (1 + pct / 100) * 100) / 100;
      changed = true;
      return {
        ...i,
        cmv,
        feesPct: pct,
        suggestedPrice,
        useManualPrice: false,
        manualPrice: suggestedPrice,
      };
    });
    if (changed) {
      setTimeout(() => {
        this.itemsSignal.set(out);
        this.persist();
      }, 0);
    }
    return out;
  }

  /** Atribui globalCode (3 letras + 4 números) a itens que não têm (migração). Não altera o signal durante load(). */
  private migrateGlobalCodes(list: CatalogItem[]): CatalogItem[] {
    const existingRecNumbers = list
      .filter((i) => i.globalCode && CODE_REGEX.test(i.globalCode) && i.globalCode.toUpperCase().startsWith('REC'))
      .map((i) => parseInt(i.globalCode!.slice(3), 10))
      .filter((n) => !Number.isNaN(n));
    const existingRevNumbers = list
      .filter((i) => i.globalCode && CODE_REGEX.test(i.globalCode) && i.globalCode.toUpperCase().startsWith('REV'))
      .map((i) => parseInt(i.globalCode!.slice(3), 10))
      .filter((n) => !Number.isNaN(n));
    let nextRec = existingRecNumbers.length > 0 ? Math.max(...existingRecNumbers) + 1 : 1;
    let nextRev = existingRevNumbers.length > 0 ? Math.max(...existingRevNumbers) + 1 : 1;

    let changed = false;
    const out = list.map((i) => {
      if (i.globalCode && i.globalCode.trim() && CODE_REGEX.test(i.globalCode)) return i;
      changed = true;
      const code = i.recipeId != null
        ? buildGlobalCode(CODE_PREFIX_REC, nextRec++)
        : buildGlobalCode(CODE_PREFIX_REV, nextRev++);
      return { ...i, globalCode: code };
    });
    if (changed) {
      setTimeout(() => {
        this.itemsSignal.set(out);
        this.persist();
      }, 0);
    }
    return out;
  }

  /** Retorna o código global do item (sempre definido após migração). */
  getGlobalCode(item: CatalogItem): string {
    if (item.globalCode && item.globalCode.trim() && CODE_REGEX.test(item.globalCode)) {
      return item.globalCode.trim().toUpperCase();
    }
    return (item.recipeId != null ? CODE_PREFIX_REC : CODE_PREFIX_REV) + '????';
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

  /** Busca produto por código global de cadastro (ex.: REC0001, REV0002). */
  findByGlobalCode(code: string): CatalogItem | null {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) return null;
    return this.itemsSignal().find((i) => this.getGlobalCode(i) === normalized) ?? null;
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
    const id = existing?.id ?? uid();
    const base: CatalogItem = {
      id,
      name: data.name,
      recipeId: data.recipeId,
      cmv: data.cmv,
      feesPct: data.feesPct,
      suggestedPrice: data.suggestedPrice,
      useManualPrice: existing?.useManualPrice ?? false,
      manualPrice: existing?.manualPrice ?? data.suggestedPrice,
      categoryId: existing?.categoryId ?? 'outros',
      globalCode: existing?.globalCode ?? buildGlobalCode(CODE_PREFIX_REC, getNextSequenceNumber(list, CODE_PREFIX_REC)),
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

  setCategory(id: string, categoryId: PdvCategoryId | null): void {
    this.itemsSignal.update((arr) =>
      arr.map((i) => (i.id === id ? { ...i, categoryId: categoryId ?? undefined } : i))
    );
    this.persist();
  }

  setSaleUnit(id: string, value: string | null): void {
    const v = (value ?? '').trim() || null;
    this.itemsSignal.update((arr) =>
      arr.map((i) => (i.id === id ? { ...i, saleUnit: v } : i))
    );
    this.persist();
  }

  setQuantityPerPackage(id: string, value: number | null): void {
    const v = value === null || !Number.isFinite(value) || value < 0 ? null : value;
    this.itemsSignal.update((arr) =>
      arr.map((i) => (i.id === id ? { ...i, quantityPerPackage: v } : i))
    );
    this.persist();
  }

  setSizeOrVolume(id: string, value: string | null): void {
    const v = (value ?? '').trim() || null;
    this.itemsSignal.update((arr) =>
      arr.map((i) => (i.id === id ? { ...i, sizeOrVolume: v } : i))
    );
    this.persist();
  }

  setBrand(id: string, value: string | null): void {
    const v = (value ?? '').trim() || null;
    this.itemsSignal.update((arr) =>
      arr.map((i) => (i.id === id ? { ...i, brand: v } : i))
    );
    this.persist();
  }

  setNotes(id: string, value: string | null): void {
    const v = (value ?? '').trim() || null;
    this.itemsSignal.update((arr) =>
      arr.map((i) => (i.id === id ? { ...i, notes: v } : i))
    );
    this.persist();
  }

  /** Markup padrão (%) para produtos de revenda quando não informado. */
  static readonly DEFAULT_MARKUP_PCT = 30;

  /** Valor sugerido a partir de CMV e markup: CMV × (1 + markup%/100). */
  suggestedPriceFromMarkup(cmv: number, markupPct: number): number {
    const c = Math.max(0, Number(cmv) || 0);
    const p = Number(markupPct) || 0;
    return Math.round(c * (1 + p / 100) * 100) / 100;
  }

  /** Atualiza CMV do item. Em itens de revenda, recalcula o valor sugerido (CMV × markup). */
  setCmv(id: string, value: number): void {
    const cmv = Math.max(0, Number(value) || 0);
    this.itemsSignal.update((arr) =>
      arr.map((i) => {
        if (i.id !== id) return i;
        const updated = { ...i, cmv };
        if (i.recipeId == null) {
          updated.suggestedPrice = this.suggestedPriceFromMarkup(cmv, i.feesPct);
          if (!i.useManualPrice) updated.manualPrice = updated.suggestedPrice;
        }
        return updated;
      })
    );
    this.persist();
  }

  /** Atualiza markup (%) do item. Apenas itens de revenda; recalcula valor sugerido. */
  setMarkupPct(id: string, value: number): void {
    const pct = Math.max(0, Number(value) || 0);
    this.itemsSignal.update((arr) =>
      arr.map((i) => {
        if (i.id !== id || i.recipeId != null) return i;
        const suggestedPrice = this.suggestedPriceFromMarkup(i.cmv, pct);
        return {
          ...i,
          feesPct: pct,
          suggestedPrice,
          ...(i.useManualPrice ? {} : { manualPrice: suggestedPrice }),
        };
      })
    );
    this.persist();
  }

  /** Adiciona produto de fornecedor (sem receita). CMV + markup geram o valor sugerido usado no PDV. */
  addSupplierItem(data: {
    name: string;
    categoryId: PdvCategoryId;
    price: number;
    markupPct?: number | null;
    saleUnit?: string | null;
    quantityPerPackage?: number | null;
    sizeOrVolume?: string | null;
    brand?: string | null;
    notes?: string | null;
  }): CatalogItem | null {
    const name = (data.name ?? '').trim();
    if (!name) return null;
    const cmv = Math.max(0, Number(data.price) || 0);
    const markupPct = Number(data.markupPct) >= 0 ? Number(data.markupPct) : ItemsCatalogService.DEFAULT_MARKUP_PCT;
    const suggestedPrice = this.suggestedPriceFromMarkup(cmv, markupPct);
    const qty = data.quantityPerPackage != null && Number.isFinite(data.quantityPerPackage) && data.quantityPerPackage >= 0
      ? data.quantityPerPackage
      : null;
    const id = uid();
    const list = this.itemsSignal();
    const nextNum = getNextSequenceNumber(list, CODE_PREFIX_REV);
    const item: CatalogItem = {
      id,
      name,
      recipeId: null,
      cmv,
      feesPct: markupPct,
      suggestedPrice,
      useManualPrice: false,
      manualPrice: suggestedPrice,
      categoryId: data.categoryId ?? 'outros',
      globalCode: buildGlobalCode(CODE_PREFIX_REV, nextNum),
      saleUnit: (data.saleUnit ?? '').trim() || null,
      quantityPerPackage: qty,
      sizeOrVolume: (data.sizeOrVolume ?? '').trim() || null,
      brand: (data.brand ?? '').trim() || null,
      notes: (data.notes ?? '').trim() || null,
    };
    this.itemsSignal.update((arr) => [...arr, item]);
    this.persist();
    return item;
  }

  removeItem(id: string): void {
    this.itemsSignal.update((arr) => arr.filter((i) => i.id !== id));
    this.persist();
  }

  money(v: number): string {
    return BRL.format(Number.isFinite(v) ? v : 0);
  }
}
