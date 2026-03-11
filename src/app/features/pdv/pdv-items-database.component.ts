import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  ItemsCatalogService,
  type CatalogItem,
  PDV_CATEGORIES,
  type PdvCategoryId,
} from '../../core/items-catalog.service';
import { createTablePagination } from '../../core/pagination';

@Component({
  selector: 'app-pdv-items-database',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './pdv-items-database.component.html',
  styleUrl: './pdv.component.scss',
})
export class PdvItemsDatabaseComponent {
  protected readonly catalog = inject(ItemsCatalogService);

  protected readonly PDV_CATEGORIES = PDV_CATEGORIES;
  protected readonly searchQuery = signal('');
  /** Filtro por categoria: null = todos, senão só itens da categoria. */
  protected readonly selectedCategoryFilter = signal<PdvCategoryId | null>(null);

  protected readonly filteredItems = computed(() => {
    let list = this.catalog.items();
    const cat = this.selectedCategoryFilter();
    if (cat) list = this.catalog.getByCategory(cat);
    const q = this.searchQuery().trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q));
    return list;
  });

  private readonly tablePagination = createTablePagination(5);
  protected readonly pageSizeOptions = this.tablePagination.pageSizeOptions;
  protected readonly getTablePage = this.tablePagination.getTablePage;
  protected readonly setTablePage = this.tablePagination.setTablePage;
  protected readonly getTablePageSize = this.tablePagination.getTablePageSize;
  protected readonly onPageSizeChange = this.tablePagination.onPageSizeChange;
  protected readonly paginate = this.tablePagination.paginate;
  protected readonly paginatedLength = this.tablePagination.paginatedLength;
  protected readonly paginationInfo = this.tablePagination.paginationInfo;

  protected effectivePrice(item: CatalogItem): number {
    return this.catalog.effectivePrice(item);
  }

  protected onManualPriceChange(item: CatalogItem, value: string | number | null): void {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (value === '' || value === null || num === null || !Number.isFinite(num)) {
      this.catalog.setUseManualPrice(item.id, false);
    } else {
      this.catalog.setManualPrice(item.id, Math.max(0, num));
      this.catalog.setUseManualPrice(item.id, true);
    }
  }

  protected setCategory(item: CatalogItem, categoryId: PdvCategoryId | ''): void {
    this.catalog.setCategory(item.id, categoryId || null);
  }

  protected removeItem(id: string): void {
    this.catalog.removeItem(id);
  }

  protected setCategoryFilter(cat: PdvCategoryId | null): void {
    this.selectedCategoryFilter.set(cat);
  }
}

