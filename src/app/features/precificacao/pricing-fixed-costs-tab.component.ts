import { Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PricingStateService, type FixedCostItem } from '../../core/pricing-state.service';
import { createTablePagination } from '../../core/pagination';
import { safeNum } from '../../core/safe-num';

@Component({
  selector: 'app-pricing-fixed-costs-tab',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, LucideAngularModule],
  templateUrl: './pricing-fixed-costs-tab.component.html',
  styleUrl: './precificacao.component.scss',
})
export class PricingFixedCostsTabComponent {
  protected readonly pricing = inject(PricingStateService);

  protected readonly unitLabel = computed(() => this.pricing.getUnitLabel(this.pricing.selectedRecipe()));

  private readonly tablePagination = createTablePagination(5);
  protected readonly pageSizeOptions = this.tablePagination.pageSizeOptions;
  protected readonly getTablePage = this.tablePagination.getTablePage;
  protected readonly setTablePage = this.tablePagination.setTablePage;
  protected readonly getTablePageSize = this.tablePagination.getTablePageSize;
  protected readonly onPageSizeChange = this.tablePagination.onPageSizeChange;
  protected readonly paginate = this.tablePagination.paginate;
  protected readonly paginatedLength = this.tablePagination.paginatedLength;
  protected readonly paginationInfo = this.tablePagination.paginationInfo;

  private helpTooltipClose: (() => void) | null = null;
  protected showHelp(event: Event): void {
    const btn = event.currentTarget as HTMLElement;
    const text = btn.getAttribute('data-help');
    const el = document.getElementById('helpTooltip');
    if (!el || !text) return;
    this.helpTooltipClose?.();
    this.helpTooltipClose = null;
    el.textContent = text;
    el.setAttribute('aria-hidden', 'false');
    el.classList.add('show');
    const rect = btn.getBoundingClientRect();
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.bottom + 6}px`;
    const close = (): void => {
      el.classList.remove('show');
      el.setAttribute('aria-hidden', 'true');
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onEscape);
      if (this.helpTooltipClose === close) this.helpTooltipClose = null;
    };
    const onEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onEscape);
    this.helpTooltipClose = close;
    setTimeout(() => {
      document.addEventListener('click', (e: MouseEvent) => {
        if (!el.contains(e.target as Node) && !btn.contains(e.target as Node)) close();
      }, { once: true });
    }, 0);
  }

  protected updateFixedMonthlyHours(value: unknown): void {
    this.pricing.updateFixed({ monthlyHours: safeNum(value) || 160 });
  }
  protected updateFixedWorkDays(value: unknown): void {
    this.pricing.updateFixed({ workDaysPerMonth: safeNum(value) || 22 });
  }
  protected updateFixedLaborHourly(value: unknown): void {
    this.pricing.updateFixed({ laborHourly: safeNum(value) });
  }
  protected saveFixedSettings(): void {}
  protected updateFixedItemName(it: FixedCostItem, event: Event): void {
    this.pricing.updateFixedItem(it.id, { name: (event.target as HTMLInputElement)?.value ?? '' });
  }
  protected updateFixedItemValue(it: FixedCostItem, event: Event): void {
    this.pricing.updateFixedItem(it.id, { value: safeNum((event.target as HTMLInputElement)?.value) });
  }
}
