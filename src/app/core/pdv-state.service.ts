import { Injectable, inject, signal, computed } from '@angular/core';
import { StorageService } from './storage.service';

const LS_KEY = 'pdv.v1';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export type SalePaymentMethod = 'dinheiro' | 'debito' | 'credito' | 'pix' | 'outros';

export const PAYMENT_METHOD_LABELS: Record<SalePaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  pix: 'PIX',
  outros: 'Outros',
};

export type SaleStatus = 'active' | 'cancelled' | 'refunded';

export interface SaleItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  productId?: string | null;
  itemNote?: string | null;
  paymentMethod?: SalePaymentMethod | null;
  cancelled?: boolean;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  refunded?: boolean;
  refundedAt?: string | null;
  orderId?: string | null;
  orderNumber?: number | null;
}

export interface DailyOrder {
  orderId: string;
  orderNumber: number | null;
  createdAt: string;
  paymentMethod: SalePaymentMethod;
  items: SaleItem[];
  totalItems: number;
  totalValue: number;
  cancelled: boolean;
  refunded: boolean;
  cancelReason?: string | null;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(2, 8);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class PdvStateService {
  private readonly storage = inject(StorageService);
  private readonly salesSignal = signal<SaleItem[]>(this.loadSales());

  readonly sales = this.salesSignal.asReadonly();

  readonly todaySales = computed(() => {
    const key = todayKey();
    return this.salesSignal().filter((s) => s.createdAt.startsWith(key));
  });

  readonly dailyTotal = computed(() => {
    return this.todaySales().filter(s => !s.cancelled).reduce((sum, s) => sum + s.total, 0);
  });

  readonly dailyCount = computed(() => this.todaySales().filter(s => !s.cancelled).length);

  readonly dailyCancelledCount = computed(() => this.todaySales().filter(s => s.cancelled).length);
  readonly dailyCancelledTotal = computed(() => this.todaySales().filter(s => s.cancelled).reduce((sum, s) => sum + s.total, 0));

  readonly todayOrders = computed<DailyOrder[]>(() => {
    const sales = this.todaySales();
    const grouped = new Map<string, SaleItem[]>();
    for (const s of sales) {
      const key = s.orderId ?? s.id;
      const arr = grouped.get(key) ?? [];
      arr.push(s);
      grouped.set(key, arr);
    }
    return Array.from(grouped.entries()).map(([orderId, items]) => {
      const first = items[0];
      const allCancelled = items.every(i => i.cancelled);
      const anyRefunded = items.some(i => i.refunded);
      return {
        orderId,
        orderNumber: first.orderNumber ?? null,
        createdAt: first.createdAt,
        paymentMethod: (first.paymentMethod ?? 'outros') as SalePaymentMethod,
        items,
        totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
        totalValue: items.reduce((sum, i) => sum + i.total, 0),
        cancelled: allCancelled,
        refunded: anyRefunded,
        cancelReason: first.cancelReason,
      };
    });
  });

  /** Vendas agrupadas por mês (ano-mês). Ordenado do mais recente ao mais antigo. */
  readonly monthlySales = computed(() => {
    const list = this.salesSignal().filter(s => !s.cancelled);
    const byMonth = new Map<string, { total: number; count: number }>();
    for (const s of list) {
      const key = s.createdAt.slice(0, 7); // YYYY-MM
      const cur = byMonth.get(key) ?? { total: 0, count: 0 };
      cur.total += s.total;
      cur.count += 1;
      byMonth.set(key, cur);
    }
    return Array.from(byMonth.entries())
      .map(([monthKey, data]) => {
        const [y, m] = monthKey.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return { monthKey, label, total: data.total, count: data.count };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  });

  private loadSales(): SaleItem[] {
    const parsed = this.storage.get<SaleItem[]>(LS_KEY);
    return Array.isArray(parsed) ? parsed : [];
  }

  private persist(): void {
    this.storage.set(LS_KEY, this.salesSignal());
  }

  reload(): void {
    this.salesSignal.set(this.loadSales());
  }

  addSale(description: string, quantity: number, unitPrice: number, options?: { productId?: string | null; itemNote?: string | null; paymentMethod?: SalePaymentMethod | null }): void {
    const total = quantity * unitPrice;
    const item: SaleItem = {
      id: uid(),
      description: description || 'Venda',
      quantity,
      unitPrice,
      total,
      createdAt: new Date().toISOString(),
      productId: options?.productId ?? null,
      itemNote: options?.itemNote ?? null,
      paymentMethod: options?.paymentMethod ?? null,
    };
    this.salesSignal.update((list) => [item, ...list]);
    this.persist();
  }

  addSales(
    items: Array<{ description: string; quantity: number; unitPrice: number; productId?: string | null; itemNote?: string | null }>,
    paymentMethod?: SalePaymentMethod | null,
    orderNumber?: number | null
  ): void {
    const oid = uid();
    const now = new Date().toISOString();
    const toAdd: SaleItem[] = items.map((it) => ({
      id: uid(),
      description: it.description || 'Venda',
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      total: it.quantity * it.unitPrice,
      createdAt: now,
      productId: it.productId ?? null,
      itemNote: it.itemNote ?? null,
      paymentMethod: paymentMethod ?? null,
      orderId: oid,
      orderNumber: orderNumber ?? null,
    }));
    this.salesSignal.update((list) => [...toAdd, ...list]);
    this.persist();
  }

  cancelSale(id: string, reason?: string): void {
    this.salesSignal.update((list) =>
      list.map((s) => s.id === id && !s.cancelled
        ? { ...s, cancelled: true, cancelledAt: new Date().toISOString(), cancelReason: reason ?? null }
        : s)
    );
    this.persist();
  }

  cancelOrder(orderId: string, reason?: string): void {
    const now = new Date().toISOString();
    this.salesSignal.update((list) =>
      list.map((s) => (s.orderId === orderId || s.id === orderId) && !s.cancelled
        ? { ...s, cancelled: true, cancelledAt: now, cancelReason: reason ?? null }
        : s)
    );
    this.persist();
  }

  restoreSale(id: string): void {
    this.salesSignal.update((list) =>
      list.map((s) => s.id === id && s.cancelled && !s.refunded
        ? { ...s, cancelled: false, cancelledAt: null, cancelReason: null }
        : s)
    );
    this.persist();
  }

  restoreOrder(orderId: string): void {
    this.salesSignal.update((list) =>
      list.map((s) => (s.orderId === orderId || s.id === orderId) && s.cancelled && !s.refunded
        ? { ...s, cancelled: false, cancelledAt: null, cancelReason: null }
        : s)
    );
    this.persist();
  }

  /** Marca uma venda como extornada. O extorno funciona como cancelamento financeiro irreversível. */
  refundSale(id: string, reason?: string): void {
    this.salesSignal.update((list) =>
      list.map((s) => s.id === id && !s.refunded
        ? { ...s, cancelled: true, cancelledAt: new Date().toISOString(), cancelReason: reason ?? 'Extorno', refunded: true, refundedAt: new Date().toISOString() }
        : s)
    );
    this.persist();
  }

  getSaleById(id: string): SaleItem | undefined {
    return this.salesSignal().find((s) => s.id === id);
  }

  removeSale(id: string): void {
    this.salesSignal.update((list) => list.filter((s) => s.id !== id));
    this.persist();
  }

  clearToday(): void {
    const key = todayKey();
    this.salesSignal.update((list) => list.filter((s) => !s.createdAt.startsWith(key)));
    this.persist();
  }

  clearAll(): void {
    this.salesSignal.set([]);
    this.persist();
  }

  money(v: number): string {
    return BRL.format(Number.isFinite(v) ? v : 0);
  }
}
