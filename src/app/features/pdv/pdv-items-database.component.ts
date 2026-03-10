import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ItemsCatalogService, type CatalogItem } from '../../core/items-catalog.service';
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

