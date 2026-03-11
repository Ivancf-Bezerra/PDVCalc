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
  selector: 'app-pdv-cadastro-produtos',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './pdv-cadastro-produtos.component.html',
  styleUrl: './pdv.component.scss',
})
export class PdvCadastroProdutosComponent {
  protected readonly catalog = inject(ItemsCatalogService);

  protected readonly PDV_CATEGORIES = PDV_CATEGORIES;

  /** Itens de fornecedor (sem receita). */
  protected readonly supplierItems = computed(() =>
    this.catalog.items().filter((i) => i.recipeId === null)
  );

  protected readonly newSupplierName = signal('');
  protected readonly newSupplierCategory = signal<PdvCategoryId>('outros');
  protected readonly newSupplierCmv = signal<number | ''>('');
  protected readonly newSupplierMarkupPct = signal<number | ''>(30);
  protected readonly newSupplierSizeOrVolume = signal('');
  protected readonly newSupplierNotes = signal('');
  protected readonly supplierFormError = signal('');
  protected readonly supplierFormSuccess = signal('');

  private readonly tablePagination = createTablePagination(10);
  protected readonly pageSizeOptions = this.tablePagination.pageSizeOptions;
  protected readonly getTablePage = this.tablePagination.getTablePage;
  protected readonly setTablePage = this.tablePagination.setTablePage;
  protected readonly getTablePageSize = this.tablePagination.getTablePageSize;
  protected readonly onPageSizeChange = this.tablePagination.onPageSizeChange;
  protected readonly paginate = this.tablePagination.paginate;
  protected readonly paginatedLength = this.tablePagination.paginatedLength;
  protected readonly paginationInfo = this.tablePagination.paginationInfo;

  /** Valor sugerido calculado no formulário (CMV × (1 + markup%/100)). */
  protected readonly computedSuggestedPrice = computed(() => {
    const cmvRaw = this.newSupplierCmv();
    const cmv = typeof cmvRaw === 'number' ? cmvRaw : parseFloat(String(cmvRaw ?? ''));
    const pctRaw = this.newSupplierMarkupPct();
    const pct = typeof pctRaw === 'number' ? pctRaw : parseFloat(String(pctRaw ?? ''));
    return this.catalog.suggestedPriceFromMarkup(
      Number.isFinite(cmv) && cmv >= 0 ? cmv : 0,
      Number.isFinite(pct) && pct >= 0 ? pct : 0
    );
  });

  protected effectivePrice(item: CatalogItem): number {
    return this.catalog.effectivePrice(item);
  }

  protected setCmv(item: CatalogItem, value: string | number | null): void {
    const n = value === '' || value === null ? 0 : Number(value);
    this.catalog.setCmv(item.id, Number.isFinite(n) && n >= 0 ? n : 0);
  }

  protected setMarkupPct(item: CatalogItem, value: string | number | null): void {
    const n = value === '' || value === null ? 0 : Number(value);
    this.catalog.setMarkupPct(item.id, Number.isFinite(n) && n >= 0 ? n : 0);
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

  protected getGlobalCode(item: CatalogItem): string {
    return this.catalog.getGlobalCode(item);
  }

  protected setSizeOrVolume(item: CatalogItem, value: string): void {
    this.catalog.setSizeOrVolume(item.id, value);
  }

  protected setNotes(item: CatalogItem, value: string): void {
    this.catalog.setNotes(item.id, value);
  }

  protected removeItem(id: string): void {
    this.catalog.removeItem(id);
  }

  protected submitSupplierItem(): void {
    this.supplierFormError.set('');
    this.supplierFormSuccess.set('');
    const name = this.newSupplierName().trim();
    if (!name) {
      this.supplierFormError.set('Informe o nome do produto.');
      return;
    }
    const cmvRaw = this.newSupplierCmv();
    const cmv = typeof cmvRaw === 'number' ? cmvRaw : parseFloat(String(cmvRaw ?? ''));
    if (!Number.isFinite(cmv) || cmv < 0) {
      this.supplierFormError.set('Informe o CMV (custo unitário).');
      return;
    }
    const markupRaw = this.newSupplierMarkupPct();
    const markupPct = typeof markupRaw === 'number' ? markupRaw : parseFloat(String(markupRaw ?? ''));
    const pct = Number.isFinite(markupPct) && markupPct >= 0 ? markupPct : 30;

    const added = this.catalog.addSupplierItem({
      name,
      categoryId: this.newSupplierCategory(),
      price: cmv,
      markupPct: pct,
      sizeOrVolume: this.newSupplierSizeOrVolume().trim() || undefined,
      notes: this.newSupplierNotes().trim() || undefined,
    });
    if (added) {
      this.newSupplierName.set('');
      this.newSupplierCategory.set('outros');
      this.newSupplierCmv.set('');
      this.newSupplierMarkupPct.set(30);
      this.newSupplierSizeOrVolume.set('');
      this.newSupplierNotes.set('');
      this.supplierFormSuccess.set('Produto adicionado.');
    }
  }
}
