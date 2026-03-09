import { Component, effect, inject, OnInit, OnDestroy, signal, computed, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration } from 'chart.js';
import 'chart.js/auto';
import { PdvStateService, type SalePaymentMethod, type SaleItem, type DailyOrder, PAYMENT_METHOD_LABELS } from '../../core/pdv-state.service';
import { ItemsCatalogService, type CatalogItem, PDV_CATEGORIES, type PdvCategoryId } from '../../core/items-catalog.service';
import { PdvCartService, type CartLineItem } from '../../core/pdv-cart.service';
import { SidebarSubmenuService } from '../../core/sidebar-submenu.service';
import { StorageService } from '../../core/storage.service';
import jsPDF from 'jspdf';

export interface OrderSnapshotForPrint {
  lines: CartLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  orderNumber: number;
}

const LS_CATEGORIES_ORDER = 'pdv.categoriesOrder.v1';

@Component({
  selector: 'app-pdv',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, BaseChartDirective],
  templateUrl: './pdv.component.html',
  styleUrl: './pdv.component.scss',
})
export class PdvComponent implements OnInit, OnDestroy {
  protected readonly pdv = inject(PdvStateService);
  protected readonly catalog = inject(ItemsCatalogService);
  protected readonly cart = inject(PdvCartService);
  private readonly sidebarSubmenu = inject(SidebarSubmenuService);
  private readonly storage = inject(StorageService);

  protected readonly Math = Math;

  protected readonly pdvCategories = PDV_CATEGORIES;
  protected readonly categoriesOrder = signal<PdvCategoryId[]>(PDV_CATEGORIES.map(c => c.id));
  protected readonly orderedCategories = computed(() => {
    const map = new Map(PDV_CATEGORIES.map(c => [c.id, c]));
    const seen = new Set<PdvCategoryId>();
    const result: { id: PdvCategoryId; label: string; icon: string }[] = [];
    for (const id of this.categoriesOrder()) {
      const cat = map.get(id);
      if (cat) {
        result.push(cat);
        seen.add(id);
      }
    }
    for (const cat of PDV_CATEGORIES) {
      if (!seen.has(cat.id)) result.push(cat);
    }
    return result;
  });
  protected readonly draggingCategoryId = signal<PdvCategoryId | null>(null);
  protected readonly catStripScrollRef = viewChild<ElementRef<HTMLElement>>('catStripScroll');
  protected readonly activeTab = signal<string>('tab-pdv');
  /** Aba efetiva: segue o sidebar quando válido, senão o activeTab local (para conteúdo sempre alinhado ao menu). */
  protected readonly effectiveTab = computed(() => {
    const fromSidebar = this.sidebarSubmenu.activeSubmenuId();
    if (fromSidebar && this.tabs.some((t) => t.id === fromSidebar)) return fromSidebar;
    return this.activeTab();
  });
  protected readonly tabs = [
    { id: 'tab-pdv', label: 'PDV' },
    { id: 'tab-daily', label: 'Vendas Diárias' },
    { id: 'tab-monthly', label: 'Relatório mensal' },
    { id: 'tab-yearly', label: 'Relatório anual' },
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

  protected readonly showCustomItemModal = signal(false);
  protected readonly customItemName = signal('');
  protected readonly customItemQty = signal(1);
  protected readonly customItemPrice = signal(0);

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

  protected readonly dailyHourChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const sales = this.pdv.todaySales().filter(s => !s.cancelled);
    const labels: string[] = [];
    const values: number[] = [];
    for (let hour = 6; hour <= 22; hour++) {
      labels.push(`${hour.toString().padStart(2, '0')}h`);
      const total = sales
        .filter(s => new Date(s.createdAt).getHours() === hour)
        .reduce((sum, s) => sum + s.total, 0);
      values.push(total);
    }
    return {
      labels,
      datasets: [
        {
          label: 'Receita por horário',
          data: values,
          backgroundColor: 'rgba(236, 72, 153, 0.7)',
          borderRadius: 6,
          maxBarThickness: 20,
        },
      ],
    };
  });

  protected readonly dailyHourChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => this.pdv.money(ctx.parsed.y ?? 0),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
      },
      y: {
        grid: { color: '#e5e7eb' },
        ticks: {
          callback: (value) => this.pdv.money(Number(value)),
        },
      },
    },
  };

  protected readonly dailyPaymentMethodChartData = computed<ChartConfiguration<'pie'>['data']>(() => {
    const summary = this.dailySummary();
    const labels = this.paymentMethods.map(m => this.paymentMethodLabels[m]);
    const values = this.paymentMethods.map(m => summary.byMethod[m].total);

    const backgroundColor = [
      'rgba(16, 185, 129, 0.85)',   // dinheiro
      'rgba(59, 130, 246, 0.85)',   // débito
      'rgba(139, 92, 246, 0.85)',   // crédito
      'rgba(251, 113, 133, 0.85)',  // pix
      'rgba(148, 163, 184, 0.85)',  // outros
    ];

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor,
        },
      ],
    };
  });

  protected readonly dailyPaymentMethodChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      tooltip: {
        callbacks: {
          label: ctx => {
            const label = ctx.label ?? '';
            const value = (ctx.parsed as number) ?? 0;
            const dataset = ctx.dataset.data as number[];
            const total = dataset.reduce((sum, v) => sum + (v ?? 0), 0);
            const pct = total ? (value / total) * 100 : 0;
            return `${label}: ${this.pdv.money(value)} (${pct.toFixed(1)}%)`;
          },
        },
      },
    },
  };

  protected readonly topDailyItems = computed(() => {
    const sales = this.pdv.todaySales().filter(s => !s.cancelled);
    const map = new Map<string, { name: string; qty: number; total: number }>();
    for (const s of sales) {
      const key = s.description;
      const entry = map.get(key) ?? { name: key, qty: 0, total: 0 };
      entry.qty += s.quantity;
      entry.total += s.total;
      map.set(key, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15);
  });

  protected readonly monthlyDailyPaymentChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const monthKey = this.pdv.getCurrentMonthKey();
    const sales = this.pdv.sales().filter(s => !s.cancelled && s.createdAt.startsWith(monthKey));
    if (sales.length === 0) {
      return { labels: [], datasets: [] };
    }
    const daysSet = new Set<number>();
    const map = new Map<string, number>();
    for (const s of sales) {
      const d = new Date(s.createdAt);
      const day = d.getDate();
      const method = (s.paymentMethod ?? 'outros') as SalePaymentMethod;
      daysSet.add(day);
      const key = `${day}-${method}`;
      map.set(key, (map.get(key) ?? 0) + s.total);
    }
    const days = Array.from(daysSet).sort((a, b) => a - b);
    const labels = days.map(d => d.toString().padStart(2, '0'));

    const colors: Record<SalePaymentMethod, string> = {
      dinheiro: 'rgba(16, 185, 129, 0.8)',
      debito: 'rgba(59, 130, 246, 0.8)',
      credito: 'rgba(139, 92, 246, 0.8)',
      pix: 'rgba(251, 113, 133, 0.8)',
      outros: 'rgba(148, 163, 184, 0.8)',
    };

    const datasets = this.paymentMethods.map(method => ({
      label: this.paymentMethodLabels[method],
      backgroundColor: colors[method],
      data: days.map(day => map.get(`${day}-${method}`) ?? 0),
      stack: 'pagamentos',
      borderRadius: 4,
      maxBarThickness: 18,
    }));

    return { labels, datasets };
  });

  protected readonly monthlyDailyPaymentChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: ctx => {
            const label = ctx.dataset.label ?? '';
            const val = ctx.parsed.y ?? 0;
            return `${label}: ${this.pdv.money(val)}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
      },
      y: {
        stacked: true,
        grid: { color: '#e5e7eb' },
        ticks: { callback: (v) => this.pdv.money(Number(v)) },
      },
    },
  };

  protected readonly topMonthlyItems = computed(() => {
    const monthKey = this.pdv.getCurrentMonthKey();
    const sales = this.pdv.sales().filter(s => !s.cancelled && s.createdAt.startsWith(monthKey));
    const map = new Map<string, { name: string; qty: number; total: number }>();
    for (const s of sales) {
      const key = s.description;
      const entry = map.get(key) ?? { name: key, qty: 0, total: 0 };
      entry.qty += s.quantity;
      entry.total += s.total;
      map.set(key, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15);
  });

  /** Gráfico B mensal: linha com valor bruto (receita total) de cada dia do mês, do dia 1 ao último. */
  protected readonly monthlyDailyGrossChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const monthKey = this.pdv.getCurrentMonthKey();
    const [y, m] = monthKey.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const sales = this.pdv.sales().filter(s => !s.cancelled && s.createdAt.startsWith(monthKey));
    const byDay = new Map<number, number>();
    for (const s of sales) {
      const day = new Date(s.createdAt).getDate();
      byDay.set(day, (byDay.get(day) ?? 0) + s.total);
    }
    const days = Array.from({ length: lastDay }, (_, i) => i + 1);
    const labels = days.map(d => d.toString().padStart(2, '0'));
    const values = days.map(d => byDay.get(d) ?? 0);
    return {
      labels,
      datasets: [
        {
          label: 'Valor bruto (R$)',
          data: values,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.2,
        },
      ],
    };
  });

  protected readonly monthlyDailyGrossChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => this.pdv.money(ctx.parsed.y ?? 0),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
      },
      y: {
        grid: { color: '#e5e7eb' },
        ticks: { callback: (v) => this.pdv.money(Number(v)) },
      },
    },
  };

  // --- Relatório anual ---
  protected readonly selectedYear = signal(new Date().getFullYear());
  protected readonly availableYears = computed(() => {
    const months = this.pdv.monthlySales().map(m => m.monthKey.slice(0, 4));
    const set = new Set(months);
    const current = new Date().getFullYear();
    set.add(String(current));
    return Array.from(set).map(y => parseInt(y, 10)).sort((a, b) => b - a);
  });
  /** Meses do ano selecionado (jan..dez) com total e count; meses sem venda têm total/count 0. */
  protected readonly yearlyMonthlyData = computed(() => {
    const year = this.selectedYear();
    const byMonth = new Map<string, { total: number; count: number }>();
    for (const m of this.pdv.monthlySales()) {
      if (m.monthKey.startsWith(String(year))) byMonth.set(m.monthKey, { total: m.total, count: m.count });
    }
    const result: { monthKey: string; label: string; total: number; count: number }[] = [];
    for (let month = 1; month <= 12; month++) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const data = byMonth.get(key) ?? { total: 0, count: 0 };
      const d = new Date(year, month - 1, 1);
      result.push({
        monthKey: key,
        label: d.toLocaleDateString('pt-BR', { month: 'short' }),
        total: data.total,
        count: data.count,
      });
    }
    return result;
  });
  protected readonly yearlySummary = computed(() => {
    const data = this.yearlyMonthlyData();
    const totalRevenue = data.reduce((s, m) => s + m.total, 0);
    const salesCount = data.reduce((s, m) => s + m.count, 0);
    const avgTicket = salesCount > 0 ? totalRevenue / salesCount : 0;
    return { totalRevenue, salesCount, avgTicket };
  });
  protected readonly yearlyRevenueByMonthChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const data = this.yearlyMonthlyData();
    return {
      labels: data.map(m => m.label),
      datasets: [
        {
          label: 'Receita (R$)',
          data: data.map(m => m.total),
          backgroundColor: 'rgba(199, 90, 122, 0.7)',
          borderRadius: 6,
          maxBarThickness: 24,
        },
      ],
    };
  });
  protected readonly yearlyRevenueByMonthChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: ctx => this.pdv.money(ctx.parsed.y ?? 0) },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: '#e5e7eb' },
        ticks: { callback: (v) => this.pdv.money(Number(v)) },
      },
    },
  };
  protected readonly yearlyPaymentChartData = computed<ChartConfiguration<'pie'>['data']>(() => {
    const year = this.selectedYear();
    const byMethod = this.pdv.getYearlyPaymentsByMethod(year);
    const labels = this.paymentMethods.map(m => this.paymentMethodLabels[m]);
    const values = this.paymentMethods.map(m => byMethod[m].total);
    const backgroundColor = [
      'rgba(16, 185, 129, 0.85)',
      'rgba(59, 130, 246, 0.85)',
      'rgba(139, 92, 246, 0.85)',
      'rgba(251, 113, 133, 0.85)',
      'rgba(148, 163, 184, 0.85)',
    ];
    return { labels, datasets: [{ data: values, backgroundColor }] };
  });
  protected readonly yearlyPaymentChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: ctx => {
            const label = ctx.label ?? '';
            const value = (ctx.parsed as number) ?? 0;
            const dataset = ctx.dataset.data as number[];
            const total = dataset.reduce((sum, v) => sum + (v ?? 0), 0);
            const pct = total ? (value / total) * 100 : 0;
            return `${label}: ${this.pdv.money(value)} (${pct.toFixed(1)}%)`;
          },
        },
      },
    },
  };
  protected readonly topYearlyItems = computed(() => {
    const year = this.selectedYear();
    const prefix = String(year);
    const sales = this.pdv.sales().filter(s => !s.cancelled && s.createdAt.startsWith(prefix));
    const map = new Map<string, { name: string; qty: number; total: number }>();
    for (const s of sales) {
      const key = s.description;
      const entry = map.get(key) ?? { name: key, qty: 0, total: 0 };
      entry.qty += s.quantity;
      entry.total += s.total;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 15);
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
    effect(() => {
      if (this.effectiveTab() === 'tab-yearly') {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
      }
    });

    effect(() => {
      const order = this.categoriesOrder();
      this.storage.set(LS_CATEGORIES_ORDER, order);
    });

    const stored = this.storage.get<PdvCategoryId[]>(LS_CATEGORIES_ORDER);
    if (Array.isArray(stored) && stored.length > 0) {
      const validIds = new Set<PdvCategoryId>(PDV_CATEGORIES.map(c => c.id));
      const filtered = stored.filter((id): id is PdvCategoryId => validIds.has(id as PdvCategoryId));
      if (filtered.length > 0) {
        this.categoriesOrder.set(filtered);
      }
    }
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

  protected onYearSelect(value: string | number): void {
    this.selectedYear.set(Number(value));
  }

  protected selectCategory(catId: PdvCategoryId): void {
    this.selectedCategory.set(catId);
    this.searchQuery.set('');
  }

  protected selectCategoryAndCenter(catId: PdvCategoryId): void {
    this.selectCategory(catId);
    this.scheduleScrollSelectedIntoView();
  }

  protected onCategoryDragStart(event: DragEvent, catId: PdvCategoryId): void {
    this.draggingCategoryId.set(catId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', catId);
    }
  }

  protected onCategoryDragOver(event: DragEvent, targetId: PdvCategoryId): void {
    event.preventDefault();
    const sourceId = this.draggingCategoryId();
    if (!sourceId || sourceId === targetId) return;
    const order = [...this.categoriesOrder()];
    const fromIdx = order.indexOf(sourceId);
    const toIdx = order.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, sourceId);
    this.categoriesOrder.set(order);
  }

  protected onCategoryDragEnd(): void {
    this.draggingCategoryId.set(null);
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

  protected openCustomItemModal(): void {
    this.customItemName.set('');
    this.customItemQty.set(1);
    this.customItemPrice.set(0);
    this.showCustomItemModal.set(true);
  }

  protected closeCustomItemModal(): void {
    this.showCustomItemModal.set(false);
  }

  protected incrementCustomQty(): void {
    this.customItemQty.update(q => q + 1);
  }

  protected decrementCustomQty(): void {
    this.customItemQty.update(q => Math.max(1, q - 1));
  }

  protected confirmCustomItem(): void {
    const name = this.customItemName().trim();
    const qty = Math.max(1, this.customItemQty());
    const price = Math.max(0, Number(this.customItemPrice()) || 0);
    if (!name || qty <= 0 || price <= 0) return;
    this.cart.addCustomItem(name, qty, price);
    this.closeCustomItemModal();
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

  protected printDailyPaymentsReport(): void {
    const summary = this.dailySummary();
    const now = new Date().toLocaleString('pt-BR');
    const summaryCards = [
      { label: 'Vendas', value: String(summary.salesCount) },
      { label: 'Itens vendidos', value: String(summary.totalItems) },
      { label: 'Receita total', value: this.pdv.money(summary.totalRevenue), accent: true },
      { label: 'Ticket médio', value: this.pdv.money(summary.avgTicket) },
    ];
    const paymentCards = this.paymentMethods.map((m) => {
      const data = summary.byMethod[m];
      return {
        label: this.paymentMethodLabels[m],
        count: data?.count ?? 0,
        total: this.pdv.money(data?.total ?? 0),
      };
    });
    this.openReportWindow(
      'Ficha de Vendas Diárias',
      'Ficha de Vendas Diárias',
      now,
      summaryCards,
      paymentCards,
      summary.cancelledCount,
      this.pdv.money(summary.cancelledTotal)
    );
  }

  protected printMonthlyPaymentsReport(): void {
    const monthKey = this.pdv.getCurrentMonthKey();
    const byMethod = this.pdv.getMonthlyPaymentsByMethod(monthKey);
    const [y, m] = monthKey.split('-').map(Number);
    const label = new Date(y, (m ?? 1) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const now = new Date().toLocaleString('pt-BR');
    const monthInfo = this.pdv.monthlySales().find(ms => ms.monthKey === monthKey);
    const totalCount = monthInfo?.count ?? 0;
    const totalValue = monthInfo?.total ?? 0;
    const summaryCards = [
      { label: 'Mês', value: label },
      { label: 'Vendas no mês', value: String(totalCount) },
      { label: 'Receita total', value: this.pdv.money(totalValue), accent: true },
    ];
    const paymentCards = this.paymentMethods.map((mth) => {
      const data = byMethod[mth];
      return {
        label: this.paymentMethodLabels[mth],
        count: data.count,
        total: this.pdv.money(data.total),
      };
    });
    this.openReportWindow(
      'Ficha de Vendas Mensais',
      'Ficha de Vendas Mensais',
      now,
      summaryCards,
      paymentCards,
      0,
      this.pdv.money(0)
    );
  }

  private openReportWindow(
    docTitle: string,
    heading: string,
    subtitle: string,
    summaryCards: Array<{ label: string; value: string; accent?: boolean }>,
    paymentCards: Array<{ label: string; count: number; total: string }>,
    cancelledCount: number,
    cancelledTotalFormatted: string
  ): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 60;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(heading, 40, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Emitido em: ${subtitle}`, pageWidth - 40, y - 4, { align: 'right' });

    y += 24;

    const cardWidth = (pageWidth - 80 - 3 * 12) / 4;
    const cardHeight = 46;
    summaryCards.forEach((c, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = 40 + col * (cardWidth + 12);
      const cy = y + row * (cardHeight + 10);
      doc.setDrawColor(230);
      doc.setFillColor(c.accent ? 254 : 249, c.accent ? 243 : 250, c.accent ? 247 : 251);
      doc.roundedRect(x, cy, cardWidth, cardHeight, 6, 6, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(107);
      doc.text(c.label.toUpperCase(), x + 8, cy + 14);
      doc.setFontSize(12);
      doc.setTextColor(17);
      doc.text(String(c.value), x + 8, cy + 30);
    });

    y += cardHeight + 40;

    doc.setFontSize(11);
    doc.setTextColor(17);
    doc.text('Por forma de pagamento', 40, y);
    y += 12;

    const payCardWidth = (pageWidth - 80 - 2 * 12) / 3;
    const payCardHeight = 40;
    paymentCards.forEach((p, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 40 + col * (payCardWidth + 12);
      const py = y + row * (payCardHeight + 8);
      doc.setDrawColor(230);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(x, py, payCardWidth, payCardHeight, 6, 6, 'FD');
      doc.setFontSize(9);
      doc.setTextColor(75);
      doc.text(p.label, x + 8, py + 14);
      doc.setFontSize(9);
      doc.setTextColor(17);
      doc.text(`${p.count} vendas`, x + 8, py + 28);
      doc.text(p.total, x + payCardWidth - 8, py + 28, { align: 'right' });
    });

    let lastRow = Math.floor((paymentCards.length - 1) / 3);
    let reservedHeight = (lastRow + 1) * (payCardHeight + 8);
    let yAfterPayments = y + reservedHeight + 20;

    if (cancelledCount > 0) {
      doc.setDrawColor(249, 128, 128);
      doc.setFillColor(254, 242, 242);
      const boxWidth = pageWidth - 80;
      const boxHeight = 40;
      const x = 40;
      const cy = yAfterPayments;
      doc.roundedRect(x, cy, boxWidth, boxHeight, 6, 6, 'FD');
      doc.setFontSize(9);
      doc.setTextColor(185, 28, 28);
      doc.text('Cancelados', x + 8, cy + 14);
      doc.setTextColor(127, 29, 29);
      doc.text(`${cancelledCount} pedidos`, x + 8, cy + 28);
      doc.text(`- ${cancelledTotalFormatted}`, x + boxWidth - 8, cy + 28, { align: 'right' });
    }

    doc.save(`${docTitle.replace(/\\s+/g, '_').toLowerCase()}.pdf`);
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
