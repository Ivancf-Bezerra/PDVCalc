import { Injectable, signal, computed, inject } from '@angular/core';
import { PdvStateService, type PaymentSplitEntry } from './pdv-state.service';
import { ItemsCatalogService, type CatalogItem } from './items-catalog.service';
import { StorageService } from './storage.service';

const LS_FAVORITES = 'pdv.favorites.v1';
const LS_LAST_ORDER = 'pdv.lastOrder.v1';

export interface CartLineItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  note?: string;
}

export type PaymentMethod = 'dinheiro' | 'debito' | 'credito' | 'pix' | 'outros';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(2, 8);
}

@Injectable({ providedIn: 'root' })
export class PdvCartService {
  private readonly pdvState = inject(PdvStateService);
  private readonly catalogService = inject(ItemsCatalogService);
  private readonly storage = inject(StorageService);

  private readonly linesSignal = signal<CartLineItem[]>([]);
  private readonly discountSignal = signal<number>(0);
  private readonly orderNoteSignal = signal<string>('');
  private readonly operatorSignal = signal<string>('Operador');
  private readonly customerSignal = signal<string>('');

  readonly lines = this.linesSignal.asReadonly();
  readonly orderDiscount = this.discountSignal.asReadonly();
  readonly orderNote = this.orderNoteSignal.asReadonly();
  readonly operator = this.operatorSignal.asReadonly();
  readonly customer = this.customerSignal.asReadonly();

  readonly subtotal = computed(() =>
    this.linesSignal().reduce((sum, l) => sum + l.subtotal, 0)
  );

  readonly total = computed(() => {
    const sub = this.subtotal();
    const disc = Math.max(0, this.discountSignal());
    return Math.max(0, sub - disc);
  });

  readonly nextOrderNumber = computed(() => {
    return this.pdvState.todaySales().length + 1;
  });

  addItem(product: CatalogItem, quantity: number = 1, note?: string): void {
    const price = this.catalogService.effectivePrice(product);
    const existing = this.linesSignal().find((l) => l.productId === product.id && (l.note ?? '') === (note ?? ''));
    if (existing) {
      this.updateQty(existing.id, quantity);
      return;
    }
    const qty = Math.max(1, quantity);
    const line: CartLineItem = {
      id: uid(),
      productId: product.id,
      name: product.name,
      quantity: qty,
      unitPrice: price,
      subtotal: qty * price,
      note: note?.trim() || undefined,
    };
    this.linesSignal.update((list) => [...list, line]);
  }

  addCustomItem(name: string, quantity: number, unitPrice: number, note?: string): void {
    const trimmedName = name.trim() || 'Item avulso';
    const qty = Math.max(1, quantity);
    const price = Math.max(0, unitPrice);
    const line: CartLineItem = {
      id: uid(),
      productId: `custom:${uid()}`,
      name: trimmedName,
      quantity: qty,
      unitPrice: price,
      subtotal: qty * price,
      note: note?.trim() || undefined,
    };
    this.linesSignal.update((list) => [...list, line]);
  }

  updateQty(lineId: string, delta: number): void {
    this.linesSignal.update((list) =>
      list.map((l) => {
        if (l.id !== lineId) return l;
        const qty = Math.max(0, l.quantity + delta);
        if (qty === 0) return null;
        return {
          ...l,
          quantity: qty,
          subtotal: qty * l.unitPrice,
        };
      }).filter((l): l is CartLineItem => l !== null)
    );
  }

  setLineNote(lineId: string, note: string): void {
    this.linesSignal.update((list) =>
      list.map((l) => (l.id === lineId ? { ...l, note: note.trim() || undefined } : l))
    );
  }

  removeLine(lineId: string): void {
    this.linesSignal.update((list) => list.filter((l) => l.id !== lineId));
  }

  setDiscount(value: number): void {
    this.discountSignal.set(Math.max(0, value));
  }

  setOrderNote(note: string): void {
    this.orderNoteSignal.set(note ?? '');
  }

  setOperator(name: string): void {
    this.operatorSignal.set(name ?? 'Operador');
  }

  setCustomer(name: string): void {
    this.customerSignal.set(name ?? '');
  }

  clearCart(): void {
    this.linesSignal.set([]);
    this.discountSignal.set(0);
    this.orderNoteSignal.set('');
  }

  cancelOrder(): void {
    this.clearCart();
  }

  /** Finaliza com uma única forma de pagamento (compatível). */
  finishOrder(
    paymentMethod: PaymentMethod,
    amountReceived?: number
  ): { success: boolean; change?: number; message?: string };

  /** Finaliza com múltiplas formas de pagamento. */
  finishOrder(
    payments: Array<{ method: PaymentMethod; amount: number }>,
    amountReceivedForDinheiro?: number
  ): { success: boolean; change?: number; message?: string };

  finishOrder(
    methodOrPayments: PaymentMethod | Array<{ method: PaymentMethod; amount: number }>,
    amountReceived?: number
  ): { success: boolean; change?: number; message?: string } {
    const lines = this.linesSignal();
    if (lines.length === 0) {
      return { success: false, message: 'Adicione itens ao pedido.' };
    }
    const total = this.total();
    const payments: Array<{ method: PaymentMethod; amount: number }> = Array.isArray(methodOrPayments)
      ? methodOrPayments
      : [{ method: methodOrPayments, amount: total }];
    const sumPayments = payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(sumPayments - total) > 0.005) {
      return { success: false, message: 'Soma dos pagamentos deve ser igual ao total.' };
    }
    const dinheiroTotal = payments.filter((p) => p.method === 'dinheiro').reduce((s, p) => s + p.amount, 0);
    if (dinheiroTotal > 0 && amountReceived != null) {
      if (amountReceived < dinheiroTotal) {
        return { success: false, message: 'Valor recebido (dinheiro) menor que a parte em dinheiro.' };
      }
    }
    const orderNum = this.nextOrderNumber();
    const firstMethod = payments[0].method;
    const paymentSplit: PaymentSplitEntry[] = payments.map((p) => ({ method: p.method, amount: p.amount }));
    this.pdvState.addSales(
      lines.map((l) => {
        const isCustom = l.productId?.startsWith('custom:');
        const baseName = l.name;
        const description = isCustom
          ? `item fora do BD: ${baseName}`
          : (l.note ? `${baseName} (${l.note})` : baseName);
        const itemNote = isCustom ? 'item fora do BD' : l.note;
        return {
          description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          productId: isCustom ? null : l.productId,
          itemNote,
        };
      }),
      firstMethod,
      orderNum,
      paymentSplit.length > 1 ? paymentSplit : null
    );
    this.storage.set(LS_LAST_ORDER, lines);
    const change = dinheiroTotal > 0 && amountReceived != null ? amountReceived - dinheiroTotal : undefined;
    this.clearCart();
    return { success: true, change };
  }

  /** Reabre o último pedido finalizado no carrinho. */
  reopenLastOrder(): boolean {
    const lines = this.storage.get<CartLineItem[]>(LS_LAST_ORDER);
    if (!Array.isArray(lines) || lines.length === 0) return false;
    this.linesSignal.set(lines.map((l) => ({ ...l, id: uid() })));
    return true;
  }

  hasLastOrder(): boolean {
    const lines = this.storage.get<CartLineItem[]>(LS_LAST_ORDER);
    return Array.isArray(lines) && lines.length > 0;
  }

  /** Favoritos (IDs de produtos) */
  getFavorites(): Set<string> {
    const arr = this.storage.get<string[]>(LS_FAVORITES);
    return new Set(Array.isArray(arr) ? arr : []);
  }

  private readonly favoritesVersion = signal(0);
  readonly favoritesVersionReadonly = this.favoritesVersion.asReadonly();

  toggleFavorite(productId: string): void {
    const fav = this.getFavorites();
    if (fav.has(productId)) fav.delete(productId);
    else fav.add(productId);
    this.storage.set(LS_FAVORITES, [...fav]);
    this.favoritesVersion.update((v) => v + 1);
  }

  isFavorite(productId: string): boolean {
    return this.getFavorites().has(productId);
  }

  /** Mais vendidos hoje (por productId ou descrição) */
  getMostSoldToday(limit: number = 8): string[] {
    const sales = this.pdvState.todaySales();
    const count = new Map<string, number>();
    for (const s of sales) {
      const id = s.productId ?? s.description;
      count.set(id, (count.get(id) ?? 0) + s.quantity);
    }
    return Array.from(count.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
  }

  reload(): void {
    this.clearCart();
    this.favoritesVersion.update(v => v + 1);
  }

  money(v: number): string {
    return this.pdvState.money(v);
  }
}
