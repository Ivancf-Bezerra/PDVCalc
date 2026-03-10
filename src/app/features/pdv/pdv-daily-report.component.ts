import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration } from 'chart.js';
import 'chart.js/auto';
import {
  PdvStateService,
  type DailyOrder,
  type SalePaymentMethod,
  PAYMENT_METHOD_LABELS,
} from '../../core/pdv-state.service';
import { createTablePagination } from '../../core/pagination';
import { PrintService } from '../../core/print.service';

@Component({
  selector: 'app-pdv-daily-report',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, BaseChartDirective],
  templateUrl: './pdv-daily-report.component.html',
  styleUrl: './pdv.component.scss',
})
export class PdvDailyReportComponent {
  protected readonly pdv = inject(PdvStateService);
  private readonly printService = inject(PrintService);

  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  protected readonly paymentMethods: SalePaymentMethod[] = [
    'dinheiro',
    'debito',
    'credito',
    'pix',
    'outros',
  ];

  protected readonly dailyPaymentFilter = signal<SalePaymentMethod | 'all' | 'cancelados'>('all');
  protected readonly dailySearchQuery = signal('');

  private readonly tablePagination = createTablePagination(5);
  protected readonly pageSizeOptions = this.tablePagination.pageSizeOptions;
  protected readonly getTablePage = this.tablePagination.getTablePage;
  protected readonly setTablePage = this.tablePagination.setTablePage;
  protected readonly getTablePageSize = this.tablePagination.getTablePageSize;
  protected readonly onPageSizeChange = this.tablePagination.onPageSizeChange;
  protected readonly paginate = this.tablePagination.paginate;
  protected readonly paginatedLength = this.tablePagination.paginatedLength;
  protected readonly paginationInfo = this.tablePagination.paginationInfo;

  protected readonly filteredDailyOrders = computed(() => {
    let orders = this.pdv.todayOrders();
    const filter = this.dailyPaymentFilter();
    if (filter !== 'all' && filter !== 'cancelados') {
      orders = orders.filter((o) => !o.cancelled && o.paymentMethod === filter);
    } else if (filter === 'cancelados') {
      orders = orders.filter((o) => o.cancelled);
    }
    const q = this.dailySearchQuery().trim().toLowerCase();
    if (q) {
      orders = orders.filter((o) => o.items.some((i) => i.description.toLowerCase().includes(q)));
    }
    return orders;
  });

  protected readonly dailySummary = computed(() => {
    const allOrders = this.pdv.todayOrders();
    const activeOrders = allOrders.filter((o) => !o.cancelled);
    const cancelledOrders = allOrders.filter((o) => o.cancelled);
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
    return {
      totalItems,
      totalRevenue,
      avgTicket,
      byMethod,
      salesCount: activeOrders.length,
      cancelledCount,
      cancelledTotal,
    };
  });

  protected readonly dailyHourChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const sales = this.pdv.todaySales().filter((s) => !s.cancelled);
    const labels: string[] = [];
    const values: number[] = [];
    for (let hour = 6; hour <= 22; hour++) {
      labels.push(`${hour.toString().padStart(2, '0')}h`);
      const total = sales
        .filter((s) => new Date(s.createdAt).getHours() === hour)
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
          label: (ctx) => this.pdv.money(ctx.parsed.y ?? 0),
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
    const labels = this.paymentMethods.map((m) => this.paymentMethodLabels[m]);
    const values = this.paymentMethods.map((m) => summary.byMethod[m].total);

    const backgroundColor = [
      'rgba(16, 185, 129, 0.85)', // dinheiro
      'rgba(59, 130, 246, 0.85)', // débito
      'rgba(139, 92, 246, 0.85)', // crédito
      'rgba(251, 113, 133, 0.85)', // pix
      'rgba(148, 163, 184, 0.85)', // outros
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
          label: (ctx) => {
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
    const sales = this.pdv.todaySales().filter((s) => !s.cancelled);
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

  protected readonly showCancelModal = signal(false);
  protected readonly saleToCancelId = signal<string | null>(null);
  protected readonly cancelReason = signal('');

  protected readonly showOrderDetailModal = signal(false);
  protected readonly orderDetailId = signal<string | null>(null);
  protected readonly orderDetail = computed<DailyOrder | null>(() => {
    const id = this.orderDetailId();
    if (!id) return null;
    return this.pdv.todayOrders().find((o) => o.orderId === id) ?? null;
  });

  protected readonly orderToCancel = computed<DailyOrder | null>(() => {
    const id = this.saleToCancelId();
    if (!id) return null;
    return this.pdv.todayOrders().find((o) => o.orderId === id) ?? null;
  });

  protected readonly undoSaleId = signal<string | null>(null);
  protected readonly showUndoBanner = signal(false);
  private undoTimeout: ReturnType<typeof setTimeout> | null = null;
  private static readonly UNDO_TIMEOUT_MS = 8000;

  protected getPaymentFilterLabel(): string {
    const f = this.dailyPaymentFilter();
    if (f === 'all') return 'Todos';
    if (f === 'cancelados') return 'Cancelados';
    return this.paymentMethodLabels[f];
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

  protected restoreOrder(orderId: string): void {
    this.pdv.restoreOrder(orderId);
  }

  private startUndoTimer(saleId: string): void {
    this.clearUndoTimer();
    this.undoSaleId.set(saleId);
    this.showUndoBanner.set(true);
    this.undoTimeout = setTimeout(() => {
      this.showUndoBanner.set(false);
      this.undoSaleId.set(null);
    }, PdvDailyReportComponent.UNDO_TIMEOUT_MS);
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
    this.printService.savePdf('Ficha de Vendas Diárias', (doc) => {
      // Reaproveitar o mesmo layout de PDF do componente principal
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 60;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Ficha de Vendas Diárias', 40, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Emitido em: ${now}`, pageWidth - 40, y - 4, { align: 'right' });

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

      const lastRow = Math.floor((paymentCards.length - 1) / 3);
      const reservedHeight = (lastRow + 1) * (payCardHeight + 8);
      const yAfterPayments = y + reservedHeight + 20;

      if (summary.cancelledCount > 0) {
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
        doc.text(`${summary.cancelledCount} pedidos`, x + 8, cy + 28);
        doc.text(
          `- ${this.pdv.money(summary.cancelledTotal)}`,
          x + boxWidth - 8,
          cy + 28,
          { align: 'right' },
        );
      }
    });
  }

  protected currentDate(): string {
    return new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
}

