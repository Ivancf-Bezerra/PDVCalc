import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration } from 'chart.js';
import 'chart.js/auto';
import { PdvStateService, PAYMENT_METHOD_LABELS, type SalePaymentMethod } from '../../core/pdv-state.service';
import { createTablePagination } from '../../core/pagination';
import { PrintService } from '../../core/print.service';

@Component({
  selector: 'app-pdv-monthly-report',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, BaseChartDirective],
  templateUrl: './pdv-monthly-report.component.html',
  styleUrl: './pdv.component.scss',
})
export class PdvMonthlyReportComponent {
  protected readonly pdv = inject(PdvStateService);
  private readonly printService = inject(PrintService);

  private readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  private readonly paymentMethods: SalePaymentMethod[] = [
    'dinheiro',
    'debito',
    'credito',
    'pix',
    'outros',
  ];

  private readonly tablePagination = createTablePagination(5);
  protected readonly pageSizeOptions = this.tablePagination.pageSizeOptions;
  protected readonly getTablePage = this.tablePagination.getTablePage;
  protected readonly setTablePage = this.tablePagination.setTablePage;
  protected readonly getTablePageSize = this.tablePagination.getTablePageSize;
  protected readonly onPageSizeChange = this.tablePagination.onPageSizeChange;
  protected readonly paginate = this.tablePagination.paginate;
  protected readonly paginatedLength = this.tablePagination.paginatedLength;
  protected readonly paginationInfo = this.tablePagination.paginationInfo;

  protected readonly monthlyDailyPaymentChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const monthKey = this.pdv.getCurrentMonthKey();
    const sales = this.pdv.sales().filter((s) => !s.cancelled && s.createdAt.startsWith(monthKey));
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
    const labels = days.map((d) => d.toString().padStart(2, '0'));

    const colors: Record<SalePaymentMethod, string> = {
      dinheiro: 'rgba(16, 185, 129, 0.8)',
      debito: 'rgba(59, 130, 246, 0.8)',
      credito: 'rgba(139, 92, 246, 0.8)',
      pix: 'rgba(251, 113, 133, 0.8)',
      outros: 'rgba(148, 163, 184, 0.8)',
    };

    const datasets = this.paymentMethods.map((method) => ({
      label: this.paymentMethodLabels[method],
      backgroundColor: colors[method],
      data: days.map((day) => map.get(`${day}-${method}`) ?? 0),
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
          label: (ctx) => {
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

  protected readonly monthlyDailyGrossChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const monthKey = this.pdv.getCurrentMonthKey();
    const [y, m] = monthKey.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const sales = this.pdv.sales().filter((s) => !s.cancelled && s.createdAt.startsWith(monthKey));
    const byDay = new Map<number, number>();
    for (const s of sales) {
      const day = new Date(s.createdAt).getDate();
      byDay.set(day, (byDay.get(day) ?? 0) + s.total);
    }
    const days = Array.from({ length: lastDay }, (_, i) => i + 1);
    const labels = days.map((d) => d.toString().padStart(2, '0'));
    const values = days.map((d) => byDay.get(d) ?? 0);
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
        ticks: { callback: (v) => this.pdv.money(Number(v)) },
      },
    },
  };

  protected readonly topMonthlyItems = computed(() => {
    const monthKey = this.pdv.getCurrentMonthKey();
    const sales = this.pdv.sales().filter((s) => !s.cancelled && s.createdAt.startsWith(monthKey));
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

  protected printMonthlyPaymentsReport(): void {
    const monthKey = this.pdv.getCurrentMonthKey();
    const byMethod = this.pdv.getMonthlyPaymentsByMethod(monthKey);
    const [y, m] = monthKey.split('-').map(Number);
    const label = new Date(y, (m ?? 1) - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
    const now = new Date().toLocaleString('pt-BR');
    const monthInfo = this.pdv.monthlySales().find((ms) => ms.monthKey === monthKey);
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

    this.printService.savePdf('Ficha de Vendas Mensais', (doc) => {
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 60;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Ficha de Vendas Mensais', 40, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Emitido em: ${now}`, pageWidth - 40, yPos - 4, { align: 'right' });

      yPos += 24;

      const cardWidth = (pageWidth - 80 - 3 * 12) / 4;
      const cardHeight = 46;
      summaryCards.forEach((c, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const x = 40 + col * (cardWidth + 12);
        const cy = yPos + row * (cardHeight + 10);
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

      yPos += cardHeight + 40;

      doc.setFontSize(11);
      doc.setTextColor(17);
      doc.text('Por forma de pagamento', 40, yPos);
      yPos += 12;

      const payCardWidth = (pageWidth - 80 - 2 * 12) / 3;
      const payCardHeight = 40;
      paymentCards.forEach((p, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 40 + col * (payCardWidth + 12);
        const py = yPos + row * (payCardHeight + 8);
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
    });
  }
}

