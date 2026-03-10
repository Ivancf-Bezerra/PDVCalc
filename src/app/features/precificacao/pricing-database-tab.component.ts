import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PricingStateService, type DatabaseItem } from '../../core/pricing-state.service';
import { createTablePagination } from '../../core/pagination';
import { safeNum } from '../../core/safe-num';

@Component({
  selector: 'app-pricing-database-tab',
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './pricing-database-tab.component.html',
  styleUrl: './precificacao.component.scss',
})
export class PricingDatabaseTabComponent {
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

  protected updateDbIngredientName(it: DatabaseItem, event: Event): void {
    this.pricing.updateDbIngredient(it.id, { name: (event.target as HTMLInputElement)?.value ?? '' });
  }
  protected updateDbIngredientPrice(it: DatabaseItem, event: Event): void {
    this.pricing.updateDbIngredient(it.id, { pricePaid: safeNum((event.target as HTMLInputElement)?.value) });
  }
  protected updateDbIngredientQtd(it: DatabaseItem, event: Event): void {
    this.pricing.updateDbIngredient(it.id, { qtdTotal: safeNum((event.target as HTMLInputElement)?.value) });
  }
  protected updateDbPackagingName(it: DatabaseItem, event: Event): void {
    this.pricing.updateDbPackaging(it.id, { name: (event.target as HTMLInputElement)?.value ?? '' });
  }
  protected updateDbPackagingPrice(it: DatabaseItem, event: Event): void {
    this.pricing.updateDbPackaging(it.id, { pricePaid: safeNum((event.target as HTMLInputElement)?.value) });
  }
  protected updateDbPackagingQtd(it: DatabaseItem, event: Event): void {
    this.pricing.updateDbPackaging(it.id, { qtdTotal: safeNum((event.target as HTMLInputElement)?.value) });
  }
}
