import {
  Component,
  computed,
  effect,
  inject,
  signal,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PricingStateService } from '../../core/pricing-state.service';
import { ItemsCatalogService } from '../../core/items-catalog.service';
import { HeaderActionsService } from '../../core/header-actions.service';
import { SidebarSubmenuService } from '../../core/sidebar-submenu.service';
import type {
  Recipe,
  RecipeItem,
  RecipeTotals,
  FixedCostItem,
  FeePctItem,
  VarFixedItem,
  DatabaseItem,
  Category,
} from '../../core/pricing-state.service';

@Component({
  selector: 'app-precificacao',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, LucideAngularModule],
  templateUrl: './precificacao.component.html',
  styleUrl: './precificacao.component.scss',
})
export class PrecificacaoComponent implements OnInit, OnDestroy {
  @ViewChild('fichaPrint') fichaPrintRef?: ElementRef<HTMLDivElement>;
  @ViewChild('helpTooltipRef') helpTooltipRef?: ElementRef<HTMLDivElement>;

  protected readonly pricing = inject(PricingStateService);
  private readonly catalog = inject(ItemsCatalogService);
  private readonly headerActions = inject(HeaderActionsService);
  private readonly sidebarSubmenu = inject(SidebarSubmenuService);
  protected readonly activeTab = signal<string>('tab-recipes');

  protected readonly tabs = [
    { id: 'tab-recipes', label: 'Receitas', title: 'Receitas e ingredientes', desc: 'Cadastre receitas e seus ingredientes.' },
    { id: 'tab-fixed', label: 'Custos fixos', title: 'Custos fixos', desc: 'Aluguel, luz, mão de obra e rateio.' },
    { id: 'tab-fees', label: 'Taxas', title: 'Taxas e variáveis', desc: 'Taxas percentuais e custos por unidade.' },
    { id: 'tab-pricing', label: 'Precificação', title: 'Precificação', desc: 'Markup e preço sugerido.' },
    { id: 'tab-reports', label: 'Relatórios', title: 'Relatórios', desc: 'Visão consolidada.' },
    { id: 'tab-database', label: 'Banco de dados', title: 'Banco de dados', desc: 'Ingredientes e embalagens predefinidos.' },
  ];

  protected readonly recipesCount = computed(() => this.pricing.recipes().length);
  protected readonly currentRecipeName = computed(() => this.pricing.selectedRecipe()?.name ?? 'Nenhuma');
  protected readonly recipeSearchModalOpen = signal(false);
  protected readonly bankDropdownOpen = signal(false);
  protected readonly recipeSearchQuery = signal('');
  protected readonly filteredRecipes = computed(() => {
    const list = this.pricing.recipes();
    const q = this.recipeSearchQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.name.toLowerCase().includes(q));
  });
  protected readonly selectedRecipeId = this.pricing.selectedRecipeId;
  protected readonly selectedRecipe = this.pricing.selectedRecipe;
  protected readonly recipes = this.pricing.recipes;
  protected readonly categories = this.pricing.categories;
  protected readonly selectedRecipeTotals = computed(() => {
    const r = this.pricing.selectedRecipe();
    return r ? this.pricing.calcRecipeTotals(r) : null;
  });
  protected readonly unitLabel = computed(() => this.pricing.getUnitLabel(this.pricing.selectedRecipe()));
  protected readonly pricingResult = computed(() => this.pricing.getPricingResult());
  protected readonly unitCostParts = computed(() => this.pricing.computeUnitCost().parts);

  /** Paginação: seleção de itens por página é por tabela */
  protected readonly pageSizeOptions = [5, 10, 25, 50] as const;
  protected readonly tablePageSize = signal<Record<string, number>>({});
  protected readonly tablePage = signal<Record<string, number>>({});

  protected getTablePage(tableId: string): number {
    return this.tablePage()[tableId] ?? 1;
  }

  protected setTablePage(tableId: string, page: number): void {
    this.tablePage.update((m) => ({ ...m, [tableId]: Math.max(1, page) }));
  }

  protected getTablePageSize(tableId: string): number {
    return this.tablePageSize()[tableId] ?? 5;
  }

  protected setTablePageSize(tableId: string, size: number): void {
    this.tablePageSize.update((m) => ({ ...m, [tableId]: size }));
    this.setTablePage(tableId, 1);
  }

  protected onPageSizeChange(tableId: string, size: number | string): void {
    this.setTablePageSize(tableId, Number(size));
  }

  protected paginate<T>(items: T[], tableId: string): T[] {
    const size = this.getTablePageSize(tableId);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const page = Math.min(this.getTablePage(tableId), totalPages);
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  }

  /** Quantidade de itens na página atual (para altura mínima de 5 linhas quando &lt; 5). */
  protected paginatedLength(items: unknown[] | undefined | null, tableId: string): number {
    return this.paginate(items ?? [], tableId).length;
  }

  protected paginationInfo(
    items: unknown[],
    tableId: string
  ): { start: number; end: number; total: number; totalPages: number; currentPage: number } {
    const total = items.length;
    const size = this.getTablePageSize(tableId);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.min(this.getTablePage(tableId), totalPages);
    const start = total === 0 ? 0 : (currentPage - 1) * size + 1;
    const end = total === 0 ? 0 : Math.min(currentPage * size, total);
    return { start, end, total, totalPages, currentPage };
  }

  constructor() {
    effect(() => {
      const id = this.sidebarSubmenu.activeSubmenuId();
      if (id && this.tabs.some((t) => t.id === id)) {
        this.activeTab.set(id);
      }
    });
  }

  protected recipeTotals(r: Recipe): RecipeTotals {
    return this.pricing.calcRecipeTotals(r);
  }

  ngOnInit(): void {
    const recipes = this.pricing.recipes();
    if (recipes.length > 0 && !this.pricing.selectedRecipeId()) {
      this.pricing.selectRecipe(recipes[0].id);
    }
    this.sidebarSubmenu.setSubmenuItems(this.tabs.map((t) => ({ id: t.id, label: t.label })));
    const fromSidebar = this.sidebarSubmenu.activeSubmenuId();
    if (fromSidebar && this.tabs.some((t) => t.id === fromSidebar)) {
      this.activeTab.set(fromSidebar);
    } else {
      this.sidebarSubmenu.setActiveSubmenuId(this.activeTab());
    }
    this.headerActions.registerPrecificacao({
      loadMock: () => this.loadMock(),
      reset: () => this.reset(),
      printFicha: () => this.printFicha(),
    });
  }

  ngOnDestroy(): void {
    this.sidebarSubmenu.clearSubmenuItems();
    this.headerActions.unregisterPrecificacao();
  }

  protected setActiveTab(tabId: string): void {
    this.activeTab.set(tabId);
    this.sidebarSubmenu.setActiveSubmenuId(tabId);
  }

  private helpTooltipClose: (() => void) | null = null;
  protected showHelp(event: Event): void {
    const btn = event.currentTarget as HTMLElement;
    const text = btn.getAttribute('data-help');
    const el = this.helpTooltipRef?.nativeElement ?? document.getElementById('helpTooltip');
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

  protected loadMock(): void {
    this.pricing.loadMock();
  }
  protected reset(): void {
    this.pricing.reset();
  }
  protected printFicha(): void {
    this.renderFichaTecnica(this.pricing.selectedRecipe());
    this.runPrintWithBodyClass();
  }
  protected printFichaForRecipe(recipeId: string): void {
    const r = this.pricing.recipes().find((x) => x.id === recipeId) ?? null;
    this.renderFichaTecnica(r);
    this.runPrintWithBodyClass();
  }

  private runPrintWithBodyClass(): void {
    document.body.classList.add('ficha-tecnica-print-active');
    const removeClass = (): void => {
      document.body.classList.remove('ficha-tecnica-print-active');
      window.removeEventListener('afterprint', removeClass);
    };
    window.addEventListener('afterprint', removeClass);
    setTimeout(() => window.print(), 150);
  }

  private renderFichaTecnica(recipe: Recipe | null): void {
    const el = this.fichaPrintRef?.nativeElement ?? document.getElementById('ficha-tecnica-print');
    if (!el) return;
    if (!recipe) {
      el.innerHTML = '<div class="ft-print-layout"><div class="ft-page"><p>Nenhuma receita selecionada.</p></div></div>';
      return;
    }
    const t = this.pricing.calcRecipeTotals(recipe);
    const result = this.pricing.getPricingResult();
    const unitLabel = this.pricing.getUnitLabel(recipe);
    const unitLabelPlural = recipe.yieldLabel === 'fatia' ? 'fatias' : 'unidades';
    const totalReceita = t.cmvTotal + t.packTotal;
    const custoDiretoPorUnidade = recipe.yieldUnits > 0 ? totalReceita / recipe.yieldUnits : 0;
    const categoryName = recipe.categoryId
      ? (this.pricing.categories().find((c) => c.id === recipe.categoryId)?.name ?? null)
      : null;
    const unidadeMedida = recipe.yieldLabel === 'fatia' ? 'Fatia' : 'Unidade';

    const rows = (recipe.items || []).map((i) => {
      const cost = this.pricing.itemCost(i);
      const pct = totalReceita > 0 ? (cost / totalReceita) * 100 : 0;
      return `<tr><td>${this.escapeHtml(i.name)}</td><td class="ft-num">${this.pricing.money(i.pricePaid ?? 0)}</td><td class="ft-num">${i.qtdTotal ?? 0}</td><td class="ft-num">${i.qtdUsed ?? 0}</td><td class="ft-num">${this.pricing.money(cost)}</td><td class="ft-num">${this.pricing.fx(pct)}%</td><td>${i.type === 'embalagem' ? 'Embalagem' : 'Ingrediente'}</td></tr>`;
    });

    const notesBlock = recipe.notes?.trim()
      ? `<section class="ft-section"><h2 class="ft-section-title">Observações / Modo de preparo</h2><div class="ft-notes">${this.escapeHtml(recipe.notes)}</div></section>`
      : '';

    const categoriaRow = categoryName
      ? `<tr><th>Categoria</th><td>${this.escapeHtml(categoryName)}</td></tr>`
      : '';

    el.innerHTML = `
      <div class="ft-print-layout">
        <div class="ft-page">
          <header class="ft-doc-header">
            <p class="ft-doc-title">Ficha técnica</p>
            <p class="ft-recipe-name">${this.escapeHtml(recipe.name)}</p>
          </header>
          <section class="ft-section">
            <h2 class="ft-section-title">Identificação</h2>
            <table class="ft-table-inline">
              <tbody>
                ${categoriaRow}
                <tr><th>Rendimento</th><td class="ft-num">${recipe.yieldUnits} ${unitLabelPlural}</td></tr>
                <tr><th>Unidade de medida</th><td>${unidadeMedida}</td></tr>
                <tr><th>Tempo de preparo</th><td class="ft-num">${recipe.minutes} min</td></tr>
              </tbody>
            </table>
          </section>
          <section class="ft-section">
            <h2 class="ft-section-title">Ingredientes e embalagens</h2>
            <table class="ft-table">
              <thead><tr><th>Item</th><th class="ft-num">Preço pago (R$)</th><th class="ft-num">Qtd total</th><th class="ft-num">Qtd usada</th><th class="ft-num">Custo real (R$)</th><th class="ft-num">%</th><th>Tipo</th></tr></thead>
              <tbody>${rows.join('')}</tbody>
              <tfoot>
                <tr class="ft-total"><td colspan="4">Subtotal ingredientes (CMV)</td><td class="ft-num">${this.pricing.money(t.cmvTotal)}</td><td></td><td></td></tr>
                <tr class="ft-total"><td colspan="4">Subtotal embalagens</td><td class="ft-num">${this.pricing.money(t.packTotal)}</td><td></td><td></td></tr>
                <tr class="ft-total"><td colspan="4">Total (CMV + Embalagem)</td><td class="ft-num">${this.pricing.money(totalReceita)}</td><td class="ft-num">100%</td><td></td></tr>
              </tfoot>
            </table>
          </section>
          <section class="ft-section">
            <h2 class="ft-section-title">Custos da receita</h2>
            <table class="ft-table-inline">
              <tbody>
                <tr><th>CMV total (ingredientes)</th><td class="ft-num">${this.pricing.money(t.cmvTotal)}</td></tr>
                <tr><th>Embalagem total</th><td class="ft-num">${this.pricing.money(t.packTotal)}</td></tr>
                <tr><th>Total custo direto</th><td class="ft-num">${this.pricing.money(totalReceita)}</td></tr>
                <tr><th>Custo direto por ${unitLabel}</th><td class="ft-num">${this.pricing.money(custoDiretoPorUnidade)}</td></tr>
              </tbody>
            </table>
          </section>
          <section class="ft-section">
            <h2 class="ft-section-title">Precificação sugerida</h2>
            <table class="ft-table-inline">
              <tbody>
                <tr><th>Preço sugerido (venda)</th><td class="ft-num">${this.pricing.money(result.suggestedPrice)}</td></tr>
                <tr><th>Margem líquida</th><td class="ft-num">${this.pricing.fx(result.realMargin)}%</td></tr>
              </tbody>
            </table>
          </section>
          ${notesBlock}
          <footer class="ft-doc-footer">Documento de controle — Ficha técnica</footer>
        </div>
      </div>`;
  }
  private escapeHtml(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
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
  protected selectRecipe(id: string): void {
    this.pricing.selectRecipe(id);
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
  protected addRecipe(): void {
    this.pricing.addRecipe();
  }
  protected deleteRecipe(id: string): void {
    this.pricing.deleteRecipe(id);
  }
  protected addIngredient(): void {
    const id = this.pricing.selectedRecipeId();
    if (id) this.pricing.addRecipeItem(id);
  }

  protected addIngredientFromBank(type: 'ingrediente' | 'embalagem', bankName: string): void {
    const id = this.pricing.selectedRecipeId();
    if (id && bankName) this.pricing.addRecipeItemFromBank(id, type, bankName);
  }

  protected toggleBankDropdown(): void {
    this.bankDropdownOpen.update((v) => !v);
  }

  protected addFromBankAndClose(type: 'ingrediente' | 'embalagem', name: string): void {
    this.addIngredientFromBank(type, name);
    this.bankDropdownOpen.set(false);
  }

  protected removeIngredient(item: RecipeItem): void {
    const rid = this.pricing.selectedRecipeId();
    if (rid) this.pricing.removeRecipeItem(rid, item.id);
  }
  protected updateItemQtdUsed(item: RecipeItem, event: Event): void {
    const rid = this.pricing.selectedRecipeId();
    if (!rid) return;
    const input = (event.target as HTMLInputElement);
    this.pricing.updateRecipeItem(rid, item.id, { qtdUsed: safeNum(input?.value) });
  }
  protected onIngredientFromBank(event: Event, item: RecipeItem): void {
    const rid = this.pricing.selectedRecipeId();
    if (!rid) return;
    const select = (event.target as HTMLSelectElement);
    const raw = select?.value ?? '';
    if (!raw) return;
    const [typeStr, name] = raw.split('|');
    const type = typeStr === 'embalagem' ? 'embalagem' : 'ingrediente';
    this.pricing.setFromBank(rid, item.id, type, name ?? '');
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

  protected updatePricingMode(value: 'byMargin' | 'byMarket'): void {
    this.pricing.updatePricing({ mode: value ?? 'byMargin' });
  }
  protected updateDesiredMargin(value: unknown): void {
    this.pricing.updatePricing({ desiredMargin: safeNum(value) });
  }
  protected updateMarketPrice(value: unknown): void {
    this.pricing.updatePricing({ marketPrice: safeNum(value) });
  }
  protected pricingResumoPreco(): string {
    const u = this.pricingResult().unitCost;
    const p = this.pricingResult().suggestedPrice;
    if (u <= 0) return '-';
    if (this.pricing.pricing().mode === 'byMarket') return `R$ ${p.toFixed(2)} (preço informado)`;
    return `R$ ${p.toFixed(2)} (custo ÷ denominador)`;
  }

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

function safeNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
