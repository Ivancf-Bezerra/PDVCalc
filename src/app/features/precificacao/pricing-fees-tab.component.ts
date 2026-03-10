import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PricingStateService, type FeePctItem, type VarFixedItem } from '../../core/pricing-state.service';
import { createTablePagination } from '../../core/pagination';
import { safeNum } from '../../core/safe-num';

@Component({
  selector: 'app-pricing-fees-tab',
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './pricing-fees-tab.component.html',
  styleUrl: './precificacao.component.scss',
})
export class PricingFeesTabComponent {
  protected readonly pricing = inject(PricingStateService);

  private readonly tablePagination = createTablePagination(5);
  protected readonly pageSizeOptions = this.tablePagination.pageSizeOptions;
  protected readonly getTablePage = this.tablePagination.getTablePage;
  protected readonly setTablePage = this.tablePagination.setTablePage;
  protected readonly getTablePageSize = this.tablePagination.getTablePageSize;
  protected readonly onPageSizeChange = this.tablePagination.onPageSizeChange;
  protected readonly paginate = this.tablePagination.paginate;
  protected readonly paginatedLength = this.tablePagination.paginatedLength;
  protected readonly paginationInfo = this.tablePagination.paginationInfo;

  protected updateFeePctName(it: FeePctItem, event: Event): void {
    this.pricing.updateFeePct(it.id, { name: (event.target as HTMLInputElement)?.value ?? '' });
  }
  protected updateFeePctValue(it: FeePctItem, event: Event): void {
    this.pricing.updateFeePct(it.id, { pct: safeNum((event.target as HTMLInputElement)?.value) });
  }
  protected updateVarFixedName(it: VarFixedItem, event: Event): void {
    this.pricing.updateVarFixed(it.id, { name: (event.target as HTMLInputElement)?.value ?? '' });
  }
  protected updateVarFixedValue(it: VarFixedItem, event: Event): void {
    this.pricing.updateVarFixed(it.id, { value: safeNum((event.target as HTMLInputElement)?.value) });
  }
}
