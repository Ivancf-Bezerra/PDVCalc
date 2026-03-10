import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ItemsCatalogService, type CatalogItem } from '../../core/items-catalog.service';
import { createTablePagination } from '../../core/pagination';

@Component({
  selector: 'app-pdv-ifood-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './pdv-ifood-calculator.component.html',
  styleUrl: './pdv.component.scss',
})
export class PdvIfoodCalculatorComponent {
  protected readonly catalog = inject(ItemsCatalogService);

  // Plano iFood: 'basic' (12%) ou 'delivery' (24%)
  protected readonly plan = signal<'basic' | 'delivery'>('basic');
  // Se o pedido é pago online (acrescenta 3,5%)
  protected readonly paidOnline = signal(true);

  /** Percentual efetivo da taxa iFood (plano + pagamento online). */
  protected readonly effectivePct = computed(() => {
    const base = this.plan() === 'basic' ? 12 : 24;
    const extra = this.paidOnline() ? 3.5 : 0;
    return base + extra;
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

  // Seleção de item (similar ao seletor de receitas da calculadora)
  protected readonly selectedItemId = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly itemSearchModalOpen = signal(false);

  protected readonly itemsWithCalc = computed(() => {
    const pct = Math.max(0, this.effectivePct()) / 100;
    return this.catalog.items().map((item) => {
      // Valor que você quer receber = exatamente o preço do item no BD ITEMS
      const liquidTarget = this.effectivePrice(item);
      // Preço a cobrar no iFood: P = L / (1 - taxa). Arredondado a 2 decimais.
      const grossPriceRaw = pct >= 1 ? liquidTarget : liquidTarget / (1 - pct);
      const grossPrice = Math.round(grossPriceRaw * 100) / 100;
      // Taxa e líquido derivados para que o líquido seja exatamente liquidTarget (evita drift por float)
      const fee = Math.round((grossPrice - liquidTarget) * 100) / 100;
      const net = liquidTarget;
      return {
        item,
        itemId: item.id,
        liquidTarget,
        grossPrice,
        fee,
        net,
      };
    });
  });

  protected effectivePrice(item: CatalogItem): number {
    return this.catalog.effectivePrice(item);
  }

  protected readonly filteredItemsWithCalc = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const all = this.itemsWithCalc();
    if (!query) return all;
    return all.filter((row) => (row.item.name || '').toLowerCase().includes(query));
  });

  protected readonly selectedRow = computed(() => {
    const id = this.selectedItemId();
    if (!id) return null;
    return this.itemsWithCalc().find((row) => row.itemId === id) ?? null;
  });

  protected setPlan(value: 'basic' | 'delivery'): void {
    this.plan.set(value);
  }

  protected setPaidOnline(value: boolean): void {
    this.paidOnline.set(value);
  }

  protected openItemSearchModal(): void {
    this.itemSearchModalOpen.set(true);
    this.searchQuery.set('');
  }

  protected closeItemSearchModal(): void {
    this.itemSearchModalOpen.set(false);
  }

  protected selectItemAndClose(id: string): void {
    this.selectedItemId.set(id);
    this.closeItemSearchModal();
  }
}

