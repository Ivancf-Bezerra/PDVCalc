import { Component, effect, inject, OnInit, OnDestroy, signal, computed, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PdvStateService, type SalePaymentMethod, type SaleItem, type DailyOrder, PAYMENT_METHOD_LABELS } from '../../core/pdv-state.service';
import { ItemsCatalogService, type CatalogItem, PDV_CATEGORIES, type PdvCategoryId } from '../../core/items-catalog.service';
import { PdvCartService, type CartLineItem } from '../../core/pdv-cart.service';
import { SidebarSubmenuService } from '../../core/sidebar-submenu.service';

export interface OrderSnapshotForPrint {
  lines: CartLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  orderNumber: number;
}

@Component({
  selector: 'app-pdv',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './pdv.component.html',
  styleUrl: './pdv.component.scss',
})
export class PdvComponent implements OnInit, OnDestroy {
  protected readonly pdv = inject(PdvStateService);
  protected readonly catalog = inject(ItemsCatalogService);
  protected readonly cart = inject(PdvCartService);
  private readonly sidebarSubmenu = inject(SidebarSubmenuService);

  protected readonly pdvCategories = PDV_CATEGORIES;
  protected readonly catStripScrollRef = viewChild<ElementRef<HTMLElement>>('catStripScroll');
  protected readonly activeTab = signal<string>('tab-pdv');
  protected readonly tabs = [
    { id: 'tab-pdv', label: 'PDV' },
    { id: 'tab-daily', label: 'Vendas Diárias' },
    { id: 'tab-monthly', label: 'Relatório mensal' },
    { id: 'tab-bd-items', label: 'BD ITEMS' },
  ];

  protected readonly selectedCategory = signal<PdvCategoryId>(PDV_CATEGORIES[0].id);
  protected readonly searchQuery = signal('');
  protected readonly barcodeInput = signal('');
  protected readonly showPaymentModal = signal(false);
  protected readonly showDiscountModal = signal(false);
  protected readonly paymentMethod = signal<'dinheiro' | 'debito' | 'credito' | 'pix' | 'outros'>('dinheiro');
  protected readonly amountReceived = signal<number>(0);
  protected readonly discountInput = signal<number>(0);
  protected readonly discountPctInput = signal<number>(0);
  protected readonly discountType = signal<'value' | 'pct'>('value');
  protected readonly paymentError = signal<string | null>(null);
  protected readonly showPrintPromptModal = signal(false);
  protected readonly orderDataForPrint = signal<OrderSnapshotForPrint | null>(null);
  protected readonly showAddQuantityModal = signal(false);
  protected readonly selectedProductForAdd = signal<CatalogItem | null>(null);
  protected readonly addQuantityModalQty = signal(1);
  protected readonly addQuantityModalNote = signal('');
  protected readonly showAddedFeedback = signal(false);
  private addedFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  protected readonly showCancelModal = signal(false);
  protected readonly saleToCancelId = signal<string | null>(null);
  protected readonly cancelReason = signal('');

  protected readonly undoSaleId = signal<string | null>(null);
  protected readonly showUndoBanner = signal(false);
  private undoTimeout: ReturnType<typeof setTimeout> | null = null;
  private static readonly UNDO_TIMEOUT_MS = 8000;

  protected readonly showOrderDetailModal = signal(false);
  protected readonly orderDetailId = signal<string | null>(null);
  protected readonly orderDetail = computed<DailyOrder | null>(() => {
    const id = this.orderDetailId();
    if (!id) return null;
    return this.pdv.todayOrders().find(o => o.orderId === id) ?? null;
  });

  protected readonly dailyPaymentFilter = signal<SalePaymentMethod | 'all' | 'cancelados'>('all');
  protected readonly dailySearchQuery = signal('');
  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  protected readonly paymentMethods: SalePaymentMethod[] = ['dinheiro', 'debito', 'credito', 'pix', 'outros'];

  protected readonly filteredDailyOrders = computed(() => {
    let orders = this.pdv.todayOrders();
    const filter = this.dailyPaymentFilter();
    if (filter !== 'all' && filter !== 'cancelados') {
      orders = orders.filter(o => !o.cancelled && o.paymentMethod === filter);
    } else if (filter === 'cancelados') {
      orders = orders.filter(o => o.cancelled);
    }
    const q = this.dailySearchQuery().trim().toLowerCase();
    if (q) {
      orders = orders.filter(o => o.items.some(i => i.description.toLowerCase().includes(q)));
    }
    return orders;
  });

  protected readonly dailySummary = computed(() => {
    const allOrders = this.pdv.todayOrders();
    const activeOrders = allOrders.filter(o => !o.cancelled);
    const cancelledOrders = allOrders.filter(o => o.cancelled);
    const byMethod: Record<string, { count: number; total: number }> = {};
    for (const m of this.paymentMethods) {
      byMethod[m] = { count: 0, total: 0 };
    }
    let totalItems = 0;
    let totalRevenue = 0;
    let avgTicket = 0;
    for (const o of activeOrders) {
      totalItems += o.totalItems;
      totalRevenue += o.totalValue;
      const method = o.paymentMethod ?? 'outros';
      if (byMethod[method]) {
        byMethod[method].count += 1;
        byMethod[method].total += o.totalValue;
      }
    }
    if (activeOrders.length > 0) {
      avgTicket = totalRevenue / activeOrders.length;
    }
    const cancelledCount = cancelledOrders.length;
    const cancelledTotal = cancelledOrders.reduce((sum, o) => sum + o.totalValue, 0);
    return { totalItems, totalRevenue, avgTicket, byMethod, salesCount: activeOrders.length, cancelledCount, cancelledTotal };
  });

  protected readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const catId = this.selectedCategory();
    let list = query ? this.catalog.searchByName(this.searchQuery()) : this.catalog.getByCategory(catId);
    return list;
  });

  protected readonly favoriteProductIds = computed(() => {
    this.cart.favoritesVersionReadonly();
    return [...this.cart.getFavorites()];
  });

  protected readonly favoriteProducts = computed(() => {
    this.cart.favoritesVersionReadonly();
    const ids = this.cart.getFavorites();
    return this.catalog.items().filter((i) => ids.has(i.id));
  });

  protected readonly mostSoldProducts = computed(() => {
    const ids = this.cart.getMostSoldToday(8);
    const items = this.catalog.items();
    return ids
      .map((id) => items.find((i) => i.id === id) ?? items.find((i) => i.name === id))
      .filter((i): i is CatalogItem => i != null)
      .slice(0, 8);
  });

  protected readonly changeAmount = computed(() => {
    if (this.paymentMethod() !== 'dinheiro') return null;
    const received = Number(this.amountReceived()) || 0;
    const total = this.cart.total();
    return received >= total ? received - total : null;
  });

  protected currentDateTime(): string {
    return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected currentDate(): string {
    return new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected currentTime(): string {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  protected readonly newDescription = signal('');
  protected readonly newQuantity = signal(1);
  protected readonly newUnitPrice = signal(0);

  /** Paginação: seleção de itens por página é por tabela */
  protected readonly pageSizeOptions = [5, 10, 25, 50] as const;
  protected readonly tablePageSize = signal<Record<string, number>>({});
  protected readonly tablePage = signal<Record<string, number>>({});

  protected getTablePage(tableId: string): number {
    return this.tablePage()[tableId] ?? 1;
  }

  protected setTablePage(tableId: string, page: number): void {
    this.tablePage.update((m) => ({ ...m, [tableId]: Math.max(1, page) }));
  }

  protected getTablePageSize(tableId: string): number {
    return this.tablePageSize()[tableId] ?? 5;
  }

  protected setTablePageSize(tableId: string, size: number): void {
    this.tablePageSize.update((m) => ({ ...m, [tableId]: size }));
    this.setTablePage(tableId, 1);
  }

  protected onPageSizeChange(tableId: string, size: number | string): void {
    this.setTablePageSize(tableId, Number(size));
  }

  protected paginate<T>(items: T[], tableId: string): T[] {
    const size = this.getTablePageSize(tableId);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const page = Math.min(this.getTablePage(tableId), totalPages);
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  }

  /** Quantidade de itens na página atual (para altura mínima de 5 linhas quando &lt; 5). */
  protected paginatedLength(items: unknown[] | undefined | null, tableId: string): number {
    return this.paginate(items ?? [], tableId).length;
  }

  protected paginationInfo(
    items: unknown[],
    tableId: string
  ): { start: number; end: number; total: number; totalPages: number; currentPage: number } {
    const total = items.length;
    const size = this.getTablePageSize(tableId);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.min(this.getTablePage(tableId), totalPages);
    const start = total === 0 ? 0 : (currentPage - 1) * size + 1;
    const end = total === 0 ? 0 : Math.min(currentPage * size, total);
    return { start, end, total, totalPages, currentPage };
  }

  constructor() {
    effect(() => {
      const id = this.sidebarSubmenu.activeSubmenuId();
      if (id && this.tabs.some((t) => t.id === id)) {
        this.activeTab.set(id);
      }
    });
  }

  ngOnInit(): void {
    this.sidebarSubmenu.setSubmenuItems(this.tabs);
    const fromSidebar = this.sidebarSubmenu.activeSubmenuId();
    if (fromSidebar && this.tabs.some((t) => t.id === fromSidebar)) {
      this.activeTab.set(fromSidebar);
    } else {
      this.sidebarSubmenu.setActiveSubmenuId(this.activeTab());
    }
  }

  ngOnDestroy(): void {
    if (this.addedFeedbackTimeout) clearTimeout(this.addedFeedbackTimeout);
    this.clearUndoTimer();
    this.sidebarSubmenu.clearSubmenuItems();
  }

  protected setActiveTab(tabId: string): void {
    this.activeTab.set(tabId);
    this.sidebarSubmenu.setActiveSubmenuId(tabId);
  }

  protected selectCategory(catId: PdvCategoryId): void {
    this.selectedCategory.set(catId);
    this.searchQuery.set('');
  }

  protected selectCategoryAndCenter(catId: PdvCategoryId): void {
    this.selectCategory(catId);
    this.scheduleScrollSelectedIntoView();
  }

  protected scrollCategories(direction: number): void {
    const cats = this.pdvCategories;
    const n = Number(cats.length);
    if (n === 0) return;
    const currentId = this.selectedCategory();
    const idx = cats.findIndex((c) => c.id === currentId);
    const nextIdx = (idx < 0 ? 0 : idx + direction + n) % n;
    this.selectCategory(cats[nextIdx].id);
    this.scheduleScrollSelectedIntoView();
  }

  /** Agenda rolagem para centralizar o chip da categoria selecionada (após a view atualizar). */
  private scheduleScrollSelectedIntoView(): void {
    setTimeout(() => this.scrollSelectedCategoryIntoView(), 0);
  }

  private scrollSelectedCategoryIntoView(): void {
    const container = this.catStripScrollRef()?.nativeElement;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('.pdv-cat-chip--active');
    if (active) {
      active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }

  protected getPaymentFilterLabel(): string {
    const f = this.dailyPaymentFilter();
    if (f === 'all') return 'Todos';
    if (f === 'cancelados') return 'Cancelados';
    return PAYMENT_METHOD_LABELS[f];
  }

  protected openCancelModal(orderId: string): void {
    this.saleToCancelId.set(orderId);
    this.cancelReason.set('');
    this.showCancelModal.set(true);
  }

  protected closeCancelModal(): void {
    this.showCancelModal.set(false);
    this.saleToCancelId.set(null);
    this.cancelReason.set('');
  }

  protected readonly orderToCancel = computed<DailyOrder | null>(() => {
    const id = this.saleToCancelId();
    if (!id) return null;
    return this.pdv.todayOrders().find(o => o.orderId === id) ?? null;
  });

  protected confirmCancel(): void {
    const id = this.saleToCancelId();
    if (!id) return;
    const reason = this.cancelReason().trim() || undefined;
    this.pdv.cancelOrder(id, reason);
    this.closeCancelModal();
    this.startUndoTimer(id);
  }

  protected openOrderDetail(orderId: string): void {
    this.orderDetailId.set(orderId);
    this.showOrderDetailModal.set(true);
  }

  protected closeOrderDetail(): void {
    this.showOrderDetailModal.set(false);
    this.orderDetailId.set(null);
  }

  private startUndoTimer(saleId: string): void {
    this.clearUndoTimer();
    this.undoSaleId.set(saleId);
    this.showUndoBanner.set(true);
    this.undoTimeout = setTimeout(() => {
      this.showUndoBanner.set(false);
      this.undoSaleId.set(null);
    }, PdvComponent.UNDO_TIMEOUT_MS);
  }

  private clearUndoTimer(): void {
    if (this.undoTimeout) {
      clearTimeout(this.undoTimeout);
      this.undoTimeout = null;
    }
    this.showUndoBanner.set(false);
    this.undoSaleId.set(null);
  }

  protected undoCancel(): void {
    const id = this.undoSaleId();
    if (!id) return;
    this.pdv.restoreOrder(id);
    this.clearUndoTimer();
  }

  protected dismissUndo(): void {
    this.clearUndoTimer();
  }

  protected restoreOrder(orderId: string): void {
    this.pdv.restoreOrder(orderId);
  }

  protected getCategoryLabel(catId: PdvCategoryId): string {
    return this.pdvCategories.find((c) => c.id === catId)?.label ?? catId;
  }

  protected highlightMatch(text: string): string {
    const query = this.searchQuery().trim();
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

  protected getCategoryCount(catId: PdvCategoryId): number {
    return this.catalog.getByCategory(catId).length;
  }

  protected openAddQuantityModal(product: CatalogItem): void {
    this.selectedProductForAdd.set(product);
    this.addQuantityModalQty.set(1);
    this.addQuantityModalNote.set('');
    this.showAddQuantityModal.set(true);
  }

  protected closeAddQuantityModal(): void {
    this.showAddQuantityModal.set(false);
    this.selectedProductForAdd.set(null);
  }

  protected incrementQty(): void {
    this.addQuantityModalQty.update(q => q + 1);
  }

  protected decrementQty(): void {
    this.addQuantityModalQty.update(q => Math.max(1, q - 1));
  }

  protected confirmAddQuantity(): void {
    const product = this.selectedProductForAdd();
    if (!product) return;
    const qty = Math.max(1, this.addQuantityModalQty());
    const note = this.addQuantityModalNote().trim() || undefined;
    this.cart.addItem(product, qty, note);
    this.closeAddQuantityModal();
    this.flashAddedFeedback();
  }

  private flashAddedFeedback(): void {
    if (this.addedFeedbackTimeout) clearTimeout(this.addedFeedbackTimeout);
    this.showAddedFeedback.set(true);
    this.addedFeedbackTimeout = setTimeout(() => this.showAddedFeedback.set(false), 1500);
  }

  protected toggleFavorite(productId: string): void {
    this.cart.toggleFavorite(productId);
  }

  protected onBarcodeSubmit(): void {
    const value = this.barcodeInput().trim();
    if (!value) return;
    const product = this.catalog.findByBarcode(value);
    if (product) {
      this.cart.addItem(product, 1);
      this.barcodeInput.set('');
    }
  }

  protected openPaymentModal(): void {
    this.paymentError.set(null);
    this.amountReceived.set(this.cart.total());
    this.showPaymentModal.set(true);
  }

  protected closePaymentModal(): void {
    this.showPaymentModal.set(false);
    this.paymentError.set(null);
  }

  protected confirmPayment(): void {
    this.paymentError.set(null);
    const method = this.paymentMethod();
    const received = method === 'dinheiro' ? Number(this.amountReceived()) || 0 : undefined;
    const snapshot: OrderSnapshotForPrint = {
      lines: [...this.cart.lines()],
      subtotal: this.cart.subtotal(),
      discount: this.cart.orderDiscount(),
      total: this.cart.total(),
      orderNumber: this.cart.nextOrderNumber(),
    };
    const result = this.cart.finishOrder(method, received);
    if (result.success) {
      this.closePaymentModal();
      this.orderDataForPrint.set(snapshot);
      this.showPrintPromptModal.set(true);
    } else if (result.message) {
      this.paymentError.set(result.message);
    }
  }

  protected closePrintPromptModal(): void {
    this.showPrintPromptModal.set(false);
    this.orderDataForPrint.set(null);
  }

  protected printCupomAndClose(): void {
    const data = this.orderDataForPrint();
    if (data) this.printCupomFromData(data);
    this.closePrintPromptModal();
  }

  private printCupomFromData(data: OrderSnapshotForPrint): void {
    const content = [
      `Pedido #${data.orderNumber}`,
      new Date().toLocaleString('pt-BR'),
      '---',
      ...data.lines.map((l) => `${l.name} ${l.quantity}x ${this.cart.money(l.unitPrice)} = ${this.cart.money(l.subtotal)}${l.note ? ` (${l.note})` : ''}`),
      '---',
      `Subtotal: ${this.cart.money(data.subtotal)}`,
      `Desconto: ${this.cart.money(data.discount)}`,
      `Total: ${this.cart.money(data.total)}`,
    ].join('\n');
    const w = window.open('', '_blank');
    if (w) {
      w.document.write('<pre style="font-family:monospace;padding:16px;font-size:14px;">' + content.replace(/</g, '&lt;') + '</pre>');
      w.document.close();
      w.print();
      w.close();
    }
  }

  protected openDiscountModal(): void {
    const current = this.cart.orderDiscount();
    this.discountInput.set(current);
    this.discountPctInput.set(0);
    this.discountType.set('value');
    this.showDiscountModal.set(true);
  }

  protected closeDiscountModal(): void {
    this.showDiscountModal.set(false);
  }

  protected onDiscountValueChange(value: number): void {
    this.discountInput.set(value);
    const sub = this.cart.subtotal();
    this.discountPctInput.set(sub > 0 ? Math.round((value / sub) * 10000) / 100 : 0);
    this.discountType.set('value');
  }

  protected onDiscountPctChange(pct: number): void {
    this.discountPctInput.set(pct);
    const sub = this.cart.subtotal();
    this.discountInput.set(Math.round(sub * pct) / 100);
    this.discountType.set('pct');
  }

  protected applyDiscount(): void {
    const val = Math.max(0, Number(this.discountInput()) || 0);
    this.cart.setDiscount(val);
    this.closeDiscountModal();
  }

  protected addSale(): void {
    const desc = this.newDescription().trim() || 'Venda';
    const qty = Math.max(0, this.newQuantity());
    const price = Math.max(0, this.newUnitPrice());
    if (qty <= 0 || price <= 0) return;
    this.pdv.addSale(desc, qty, price);
    this.newDescription.set('');
    this.newQuantity.set(1);
    this.newUnitPrice.set(0);
  }

  protected removeSale(id: string): void {
    this.pdv.removeSale(id);
  }

  protected clearToday(): void {
    this.pdv.clearToday();
  }

  protected clearAll(): void {
    this.pdv.clearAll();
  }

  protected effectivePrice(item: CatalogItem): number {
    return this.catalog.effectivePrice(item);
  }

  protected setUseManual(item: CatalogItem, use: boolean): void {
    this.catalog.setUseManualPrice(item.id, use);
  }

  protected setManualPrice(item: CatalogItem, value: number): void {
    this.catalog.setManualPrice(item.id, value);
  }

  protected removeItem(id: string): void {
    this.catalog.removeItem(id);
  }
}
