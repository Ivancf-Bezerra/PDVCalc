import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration } from 'chart.js';
import 'chart.js/auto';
import {
  PdvStateService,
  PAYMENT_METHOD_LABELS,
  type SalePaymentMethod,
} from '../../core/pdv-state.service';

@Component({
  selector: 'app-pdv-yearly-report',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, BaseChartDirective],
  templateUrl: './pdv-yearly-report.component.html',
  styleUrl: './pdv.component.scss',
})
export class PdvYearlyReportComponent {
  protected readonly pdv = inject(PdvStateService);

  private readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  private readonly paymentMethods: SalePaymentMethod[] = [
    'dinheiro',
    'debito',
    'credito',
    'pix',
    'outros',
  ];

  protected readonly selectedYear = signal(new Date().getFullYear());

  protected readonly availableYears = computed(() => {
    const months = this.pdv.monthlySales().map((m) => m.monthKey.slice(0, 4));
    const set = new Set(months);
    const current = new Date().getFullYear();
    set.add(String(current));
    return Array.from(set)
      .map((y) => parseInt(y, 10))
      .sort((a, b) => b - a);
  });

  protected readonly yearlyMonthlyData = computed(() => {
    const year = this.selectedYear();
    const byMonth = new Map<string, { total: number; count: number }>();
    for (const m of this.pdv.monthlySales()) {
      if (m.monthKey.startsWith(String(year))) {
        byMonth.set(m.monthKey, { total: m.total, count: m.count });
      }
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
      labels: data.map((m) => m.label),
      datasets: [
        {
          label: 'Receita (R$)',
          data: data.map((m) => m.total),
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
        callbacks: { label: (ctx) => this.pdv.money(ctx.parsed.y ?? 0) },
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
    const labels = this.paymentMethods.map((m) => this.paymentMethodLabels[m]);
    const values = this.paymentMethods.map((m) => byMethod[m].total);
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

  protected readonly topYearlyItems = computed(() => {
    const year = this.selectedYear();
    const prefix = String(year);
    const sales = this.pdv.sales().filter(
      (s) => !s.cancelled && s.createdAt.startsWith(prefix),
    );
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

  protected onYearSelect(value: string | number): void {
    this.selectedYear.set(Number(value));
  }
}

