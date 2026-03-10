import { Component, effect, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { PricingStateService } from '../../core/pricing-state.service';
import { HeaderActionsService } from '../../core/header-actions.service';
import { SidebarSubmenuService } from '../../core/sidebar-submenu.service';
import { PrintService } from '../../core/print.service';
import { ReportBuilderService } from '../../core/report-builder.service';
import { PricingRecipesTabComponent } from './pricing-recipes-tab.component';
import { PricingFixedCostsTabComponent } from './pricing-fixed-costs-tab.component';
import { PricingFeesTabComponent } from './pricing-fees-tab.component';
import { PricingPricingTabComponent } from './pricing-pricing-tab.component';
import { PricingReportsTabComponent } from './pricing-reports-tab.component';
import { PricingDatabaseTabComponent } from './pricing-database-tab.component';

@Component({
  selector: 'app-precificacao',
  standalone: true,
  imports: [
    PricingRecipesTabComponent,
    PricingFixedCostsTabComponent,
    PricingFeesTabComponent,
    PricingPricingTabComponent,
    PricingReportsTabComponent,
    PricingDatabaseTabComponent,
  ],
  templateUrl: './precificacao.component.html',
  styleUrl: './precificacao.component.scss',
})
export class PrecificacaoComponent implements OnInit, OnDestroy {
  private readonly pricing = inject(PricingStateService);
  private readonly headerActions = inject(HeaderActionsService);
  private readonly sidebarSubmenu = inject(SidebarSubmenuService);
  private readonly printService = inject(PrintService);
  private readonly reportBuilder = inject(ReportBuilderService);

  protected readonly activeTab = signal<string>('tab-recipes');

  protected readonly tabs = [
    { id: 'tab-recipes', label: 'Receitas', title: 'Receitas e ingredientes', desc: 'Cadastre receitas e seus ingredientes.' },
    { id: 'tab-fixed', label: 'Custos fixos', title: 'Custos fixos', desc: 'Aluguel, luz, mão de obra e rateio.' },
    { id: 'tab-fees', label: 'Taxas', title: 'Taxas e variáveis', desc: 'Taxas percentuais e custos por unidade.' },
    { id: 'tab-pricing', label: 'Precificação', title: 'Precificação', desc: 'Markup e preço sugerido.' },
    { id: 'tab-reports', label: 'Relatórios', title: 'Relatórios', desc: 'Visão consolidada.' },
    { id: 'tab-database', label: 'Banco de dados', title: 'Banco de dados', desc: 'Ingredientes e embalagens predefinidos.' },
  ];

  constructor() {
    effect(() => {
      const id = this.sidebarSubmenu.activeSubmenuId();
      if (id && this.tabs.some((t) => t.id === id)) {
        this.activeTab.set(id);
      }
    });
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
      loadMock: () => this.pricing.loadMock(),
      reset: () => this.pricing.reset(),
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

  private printFicha(): void {
    const container = document.getElementById('ficha-tecnica-print');
    if (!container) return;
    container.innerHTML = this.reportBuilder.buildFichaTecnicaHtml(this.pricing.selectedRecipe());
    this.printService.printWithBodyClass(container, { bodyClass: 'ficha-tecnica-print-active' });
  }
}
