import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PricingStateService, type Recipe, type RecipeItem, type RecipeTotals } from '../../core/pricing-state.service';
import { ItemsCatalogService } from '../../core/items-catalog.service';
import { PrintService } from '../../core/print.service';
import { ReportBuilderService } from '../../core/report-builder.service';
import { createTablePagination } from '../../core/pagination';
import { safeNum } from '../../core/safe-num';

@Component({
  selector: 'app-pricing-recipes-tab',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, LucideAngularModule],
  templateUrl: './pricing-recipes-tab.component.html',
  styleUrl: './precificacao.component.scss',
})
export class PricingRecipesTabComponent {
  protected readonly pricing = inject(PricingStateService);
  private readonly catalog = inject(ItemsCatalogService);
  private readonly printService = inject(PrintService);
  private readonly reportBuilder = inject(ReportBuilderService);

  protected readonly selectedRecipeId = this.pricing.selectedRecipeId;
  protected readonly selectedRecipe = this.pricing.selectedRecipe;
  protected readonly categories = this.pricing.categories;

  protected readonly recipeSearchModalOpen = signal(false);
  protected readonly bankDropdownOpen = signal(false);
  protected readonly recipeSearchQuery = signal('');

  protected readonly filteredRecipes = computed(() => {
    const list = this.pricing.recipes();
    const q = this.recipeSearchQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.name.toLowerCase().includes(q));
  });

  protected readonly currentRecipeName = computed(() => this.pricing.selectedRecipe()?.name ?? 'Nenhuma');

  protected readonly selectedRecipeTotals = computed(() => {
    const r = this.pricing.selectedRecipe();
    return r ? this.pricing.calcRecipeTotals(r) : null;
  });

  protected readonly unitLabel = computed(() => this.pricing.getUnitLabel(this.pricing.selectedRecipe()));
  protected readonly pricingResult = computed(() => this.pricing.getPricingResult());
  protected readonly unitCostParts = computed(() => this.pricing.computeUnitCost().parts);

  private readonly tablePagination = createTablePagination(5);
  protected readonly pageSizeOptions = this.tablePagination.pageSizeOptions;
  protected readonly getTablePage = this.tablePagination.getTablePage;
  protected readonly setTablePage = this.tablePagination.setTablePage;
  protected readonly getTablePageSize = this.tablePagination.getTablePageSize;
  protected readonly onPageSizeChange = this.tablePagination.onPageSizeChange;
  protected readonly paginate = this.tablePagination.paginate;
  protected readonly paginatedLength = this.tablePagination.paginatedLength;
  protected readonly paginationInfo = this.tablePagination.paginationInfo;

  protected recipeTotals(r: Recipe): RecipeTotals {
    return this.pricing.calcRecipeTotals(r);
  }

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

  protected printFichaForRecipe(recipeId: string): void {
    const r = this.pricing.recipes().find((x) => x.id === recipeId) ?? null;
    const container = document.getElementById('ficha-tecnica-print');
    if (!container) return;
    container.innerHTML = this.reportBuilder.buildFichaTecnicaHtml(r);
    this.printService.printWithBodyClass(container, { bodyClass: 'ficha-tecnica-print-active' });
  }

  protected openRecipeSearchModal(): void {
    this.recipeSearchQuery.set('');
    this.recipeSearchModalOpen.set(true);
  }

  protected closeRecipeSearchModal(): void {
    this.recipeSearchModalOpen.set(false);
  }

  protected selectRecipeAndCloseModal(id: string): void {
    this.pricing.selectRecipe(id);
    this.closeRecipeSearchModal();
  }

  protected addRecipe(): void { this.pricing.addRecipe(); }
  protected deleteRecipe(id: string): void { this.pricing.deleteRecipe(id); }

  protected toggleBankDropdown(): void { this.bankDropdownOpen.update((v) => !v); }
  protected addFromBankAndClose(type: 'ingrediente' | 'embalagem', name: string): void {
    const id = this.pricing.selectedRecipeId();
    if (id && name) this.pricing.addRecipeItemFromBank(id, type, name);
    this.bankDropdownOpen.set(false);
  }

  protected removeIngredient(item: RecipeItem): void {
    const rid = this.pricing.selectedRecipeId();
    if (rid) this.pricing.removeRecipeItem(rid, item.id);
  }

  protected updateItemQtdUsed(item: RecipeItem, event: Event): void {
    const rid = this.pricing.selectedRecipeId();
    if (!rid) return;
    const input = event.target as HTMLInputElement;
    this.pricing.updateRecipeItem(rid, item.id, { qtdUsed: safeNum(input?.value) });
  }

  protected updateRecipeName(value: string): void {
    const id = this.pricing.selectedRecipeId();
    if (id) this.pricing.updateRecipe(id, { name: value ?? '' });
  }
  protected updateRecipeYield(value: unknown): void {
    const id = this.pricing.selectedRecipeId();
    if (id) this.pricing.updateRecipe(id, { yieldUnits: safeNum(value) || 1 });
  }
  protected updateRecipeYieldLabel(value: 'unidade' | 'fatia'): void {
    const id = this.pricing.selectedRecipeId();
    if (id) this.pricing.updateRecipe(id, { yieldLabel: value ?? 'unidade' });
  }
  protected updateRecipeMinutes(value: unknown): void {
    const id = this.pricing.selectedRecipeId();
    if (id) this.pricing.updateRecipe(id, { minutes: safeNum(value) || 0 });
  }
  protected updateRecipeNotes(value: string): void {
    const id = this.pricing.selectedRecipeId();
    if (id) this.pricing.updateRecipe(id, { notes: value ?? '' });
  }
  protected onRecipeCategoryChange(categoryId: string | null | undefined): void {
    const id = this.pricing.selectedRecipeId();
    if (!id) return;
    const value = categoryId && categoryId !== '' ? categoryId : null;
    this.pricing.updateRecipe(id, { categoryId: value });
  }
  protected addCategoryFromInput(name: string): void {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const cat = this.pricing.addCategory(trimmed);
    const rid = this.pricing.selectedRecipeId();
    if (rid && cat.id) this.pricing.updateRecipe(rid, { categoryId: cat.id });
  }

  protected saveRecipeData(): void {
    const r = this.pricing.selectedRecipe();
    if (!r) return;
    const result = this.pricing.getPricingResult();
    const t = this.pricing.calcRecipeTotals(r);
    const unitCost = t.cmvUnit + t.packUnit + t.laborUnit;
    this.catalog.syncFromRecipe({
      recipeId: r.id,
      name: r.name,
      cmv: unitCost,
      feesPct: result.feesPct,
      suggestedPrice: result.suggestedPrice,
    });
  }
}
