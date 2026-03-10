import { Component, effect, inject, OnInit, OnDestroy, signal, computed, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PdvStateService } from '../../core/pdv-state.service';
import { ItemsCatalogService, type CatalogItem, PDV_CATEGORIES, type PdvCategoryId } from '../../core/items-catalog.service';
import { PdvCartService, type CartLineItem } from '../../core/pdv-cart.service';
import { SidebarSubmenuService } from '../../core/sidebar-submenu.service';
import { StorageService } from '../../core/storage.service';
import { PrintService } from '../../core/print.service';
import { ReportBuilderService } from '../../core/report-builder.service';
import { PdvDailyReportComponent } from './pdv-daily-report.component';
import { PdvMonthlyReportComponent } from './pdv-monthly-report.component';
import { PdvYearlyReportComponent } from './pdv-yearly-report.component';
import { PdvItemsDatabaseComponent } from './pdv-items-database.component';

export interface OrderSnapshotForPrint {
  lines: CartLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  orderNumber: number;
}

const LS_CATEGORIES_ORDER = 'pdv.categoriesOrder.v1';

@Component({
  selector: 'app-pdv',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    PdvDailyReportComponent,
    PdvMonthlyReportComponent,
    PdvYearlyReportComponent,
    PdvItemsDatabaseComponent,
  ],
  templateUrl: './pdv.component.html',
  styleUrl: './pdv.component.scss',
})
export class PdvComponent implements OnInit, OnDestroy {
  protected readonly pdv = inject(PdvStateService);
  protected readonly catalog = inject(ItemsCatalogService);
  protected readonly cart = inject(PdvCartService);
  private readonly sidebarSubmenu = inject(SidebarSubmenuService);
  private readonly storage = inject(StorageService);
  private readonly printService = inject(PrintService);
  private readonly reportBuilder = inject(ReportBuilderService);

  protected readonly Math = Math;

  protected readonly pdvCategories = PDV_CATEGORIES;
  protected readonly categoriesOrder = signal<PdvCategoryId[]>(PDV_CATEGORIES.map(c => c.id));
  protected readonly orderedCategories = computed(() => {
    const map = new Map(PDV_CATEGORIES.map(c => [c.id, c]));
    const seen = new Set<PdvCategoryId>();
    const result: { id: PdvCategoryId; label: string; icon: string }[] = [];
    for (const id of this.categoriesOrder()) {
      const cat = map.get(id);
      if (cat) {
        result.push(cat);
        seen.add(id);
      }
    }
    for (const cat of PDV_CATEGORIES) {
      if (!seen.has(cat.id)) result.push(cat);
    }
    return result;
  });
  protected readonly draggingCategoryId = signal<PdvCategoryId | null>(null);
  protected readonly catStripScrollRef = viewChild<ElementRef<HTMLElement>>('catStripScroll');
  protected readonly activeTab = signal<string>('tab-pdv');
  /** Aba efetiva: segue o sidebar quando válido, senão o activeTab local (para conteúdo sempre alinhado ao menu). */
  protected readonly effectiveTab = computed(() => {
    const fromSidebar = this.sidebarSubmenu.activeSubmenuId();
    if (fromSidebar && this.tabs.some((t) => t.id === fromSidebar)) return fromSidebar;
    return this.activeTab();
  });
  protected readonly tabs = [
    { id: 'tab-pdv', label: 'PDV' },
    { id: 'tab-daily', label: 'Vendas Diárias' },
    { id: 'tab-monthly', label: 'Relatório mensal' },
    { id: 'tab-yearly', label: 'Relatório anual' },
    { id: 'tab-bd-items', label: 'BD ITEMS' },
  ];

  protected readonly selectedCategory = signal<PdvCategoryId>(PDV_CATEGORIES[0].id);
  protected readonly searchQuery = signal('');
  protected readonly barcodeInput = signal('');
  protected readonly showPaymentModal = signal(false);
  protected readonly showDiscountModal = signal(false);
  protected readonly paymentMethod = signal<'dinheiro' | 'debito' | 'credito' | 'pix' | 'outros'>('dinheiro');
  protected readonly amountReceived = signal<number>(0);
  protected readonly discountInput = signal<number>(0);
  protected readonly discountPctInput = signal<number>(0);
  protected readonly discountType = signal<'value' | 'pct'>('value');
  protected readonly paymentError = signal<string | null>(null);
  protected readonly showPrintPromptModal = signal(false);
  protected readonly orderDataForPrint = signal<OrderSnapshotForPrint | null>(null);
  protected readonly showAddQuantityModal = signal(false);
  protected readonly selectedProductForAdd = signal<CatalogItem | null>(null);
  protected readonly addQuantityModalQty = signal(1);
  protected readonly addQuantityModalNote = signal('');
  protected readonly showAddedFeedback = signal(false);
  private addedFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  protected readonly showCustomItemModal = signal(false);
  protected readonly customItemName = signal('');
  protected readonly customItemQty = signal(1);
  protected readonly customItemPrice = signal(0);

  protected readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const catId = this.selectedCategory();
    let list = query ? this.catalog.searchByName(this.searchQuery()) : this.catalog.getByCategory(catId);
    return list;
  });

  protected readonly favoriteProductIds = computed(() => {
    this.cart.favoritesVersionReadonly();
    return [...this.cart.getFavorites()];
  });

  protected readonly favoriteProducts = computed(() => {
    this.cart.favoritesVersionReadonly();
    const ids = this.cart.getFavorites();
    return this.catalog.items().filter((i) => ids.has(i.id));
  });

  protected readonly mostSoldProducts = computed(() => {
    const ids = this.cart.getMostSoldToday(8);
    const items = this.catalog.items();
    return ids
      .map((id) => items.find((i) => i.id === id) ?? items.find((i) => i.name === id))
      .filter((i): i is CatalogItem => i != null)
      .slice(0, 8);
  });

  protected readonly changeAmount = computed(() => {
    if (this.paymentMethod() !== 'dinheiro') return null;
    const received = Number(this.amountReceived()) || 0;
    const total = this.cart.total();
    return received >= total ? received - total : null;
  });

  protected currentDateTime(): string {
    return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected currentDate(): string {
    return new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected currentTime(): string {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  protected readonly newDescription = signal('');
  protected readonly newQuantity = signal(1);
  protected readonly newUnitPrice = signal(0);

  constructor() {
    effect(() => {
      const id = this.sidebarSubmenu.activeSubmenuId();
      if (id && this.tabs.some((t) => t.id === id)) {
        this.activeTab.set(id);
      }
    });
    effect(() => {
      if (this.effectiveTab() === 'tab-yearly') {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
      }
    });

    effect(() => {
      const order = this.categoriesOrder();
      this.storage.set(LS_CATEGORIES_ORDER, order);
    });

    const stored = this.storage.get<PdvCategoryId[]>(LS_CATEGORIES_ORDER);
    if (Array.isArray(stored) && stored.length > 0) {
      const validIds = new Set<PdvCategoryId>(PDV_CATEGORIES.map(c => c.id));
      const filtered = stored.filter((id): id is PdvCategoryId => validIds.has(id as PdvCategoryId));
      if (filtered.length > 0) {
        this.categoriesOrder.set(filtered);
      }
    }
  }

  ngOnInit(): void {
    this.sidebarSubmenu.setSubmenuItems(this.tabs);
    const fromSidebar = this.sidebarSubmenu.activeSubmenuId();
    if (fromSidebar && this.tabs.some((t) => t.id === fromSidebar)) {
      this.activeTab.set(fromSidebar);
    } else {
      this.sidebarSubmenu.setActiveSubmenuId(this.activeTab());
    }
  }

  ngOnDestroy(): void {
    if (this.addedFeedbackTimeout) clearTimeout(this.addedFeedbackTimeout);
    this.sidebarSubmenu.clearSubmenuItems();
  }

  protected setActiveTab(tabId: string): void {
    this.activeTab.set(tabId);
    this.sidebarSubmenu.setActiveSubmenuId(tabId);
  }

  protected selectCategory(catId: PdvCategoryId): void {
    this.selectedCategory.set(catId);
    this.searchQuery.set('');
  }

  protected selectCategoryAndCenter(catId: PdvCategoryId): void {
    this.selectCategory(catId);
    this.scheduleScrollSelectedIntoView();
  }

  protected onCategoryDragStart(event: DragEvent, catId: PdvCategoryId): void {
    this.draggingCategoryId.set(catId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', catId);
    }
  }

  protected onCategoryDragOver(event: DragEvent, targetId: PdvCategoryId): void {
    event.preventDefault();
    const sourceId = this.draggingCategoryId();
    if (!sourceId || sourceId === targetId) return;
    const order = [...this.categoriesOrder()];
    const fromIdx = order.indexOf(sourceId);
    const toIdx = order.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, sourceId);
    this.categoriesOrder.set(order);
  }

  protected onCategoryDragEnd(): void {
    this.draggingCategoryId.set(null);
  }

  protected scrollCategories(direction: number): void {
    const cats = this.pdvCategories;
    const n = Number(cats.length);
    if (n === 0) return;
    const currentId = this.selectedCategory();
    const idx = cats.findIndex((c) => c.id === currentId);
    const nextIdx = (idx < 0 ? 0 : idx + direction + n) % n;
    this.selectCategory(cats[nextIdx].id);
    this.scheduleScrollSelectedIntoView();
  }

  /** Agenda rolagem para centralizar o chip da categoria selecionada (após a view atualizar). */
  private scheduleScrollSelectedIntoView(): void {
    setTimeout(() => this.scrollSelectedCategoryIntoView(), 0);
  }

  private scrollSelectedCategoryIntoView(): void {
    const container = this.catStripScrollRef()?.nativeElement;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('.pdv-cat-chip--active');
    if (active) {
      active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }

  // Cancelamento, detalhes de pedido e banner de desfazer foram extraídos para o PdvDailyReportComponent.

  protected getCategoryLabel(catId: PdvCategoryId): string {
    return this.pdvCategories.find((c) => c.id === catId)?.label ?? catId;
  }

  protected highlightMatch(text: string): string {
    const query = this.searchQuery().trim();
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

  protected getCategoryCount(catId: PdvCategoryId): number {
    return this.catalog.getByCategory(catId).length;
  }

  protected openAddQuantityModal(product: CatalogItem): void {
    this.selectedProductForAdd.set(product);
    this.addQuantityModalQty.set(1);
    this.addQuantityModalNote.set('');
    this.showAddQuantityModal.set(true);
  }

  protected closeAddQuantityModal(): void {
    this.showAddQuantityModal.set(false);
    this.selectedProductForAdd.set(null);
  }

  protected incrementQty(): void {
    this.addQuantityModalQty.update(q => q + 1);
  }

  protected decrementQty(): void {
    this.addQuantityModalQty.update(q => Math.max(1, q - 1));
  }

  protected confirmAddQuantity(): void {
    const product = this.selectedProductForAdd();
    if (!product) return;
    const qty = Math.max(1, this.addQuantityModalQty());
    const note = this.addQuantityModalNote().trim() || undefined;
    this.cart.addItem(product, qty, note);
    this.closeAddQuantityModal();
    this.flashAddedFeedback();
  }

  protected openCustomItemModal(): void {
    this.customItemName.set('');
    this.customItemQty.set(1);
    this.customItemPrice.set(0);
    this.showCustomItemModal.set(true);
  }

  protected closeCustomItemModal(): void {
    this.showCustomItemModal.set(false);
  }

  protected incrementCustomQty(): void {
    this.customItemQty.update(q => q + 1);
  }

  protected decrementCustomQty(): void {
    this.customItemQty.update(q => Math.max(1, q - 1));
  }

  protected confirmCustomItem(): void {
    const name = this.customItemName().trim();
    const qty = Math.max(1, this.customItemQty());
    const price = Math.max(0, Number(this.customItemPrice()) || 0);
    if (!name || qty <= 0 || price <= 0) return;
    this.cart.addCustomItem(name, qty, price);
    this.closeCustomItemModal();
    this.flashAddedFeedback();
  }

  private flashAddedFeedback(): void {
    if (this.addedFeedbackTimeout) clearTimeout(this.addedFeedbackTimeout);
    this.showAddedFeedback.set(true);
    this.addedFeedbackTimeout = setTimeout(() => this.showAddedFeedback.set(false), 1500);
  }

  protected toggleFavorite(productId: string): void {
    this.cart.toggleFavorite(productId);
  }

  protected onBarcodeSubmit(): void {
    const value = this.barcodeInput().trim();
    if (!value) return;
    const product = this.catalog.findByBarcode(value);
    if (product) {
      this.cart.addItem(product, 1);
      this.barcodeInput.set('');
    }
  }

  protected openPaymentModal(): void {
    this.paymentError.set(null);
    this.amountReceived.set(this.cart.total());
    this.showPaymentModal.set(true);
  }

  protected closePaymentModal(): void {
    this.showPaymentModal.set(false);
    this.paymentError.set(null);
  }

  protected confirmPayment(): void {
    this.paymentError.set(null);
    const method = this.paymentMethod();
    const received = method === 'dinheiro' ? Number(this.amountReceived()) || 0 : undefined;
    const snapshot: OrderSnapshotForPrint = {
      lines: [...this.cart.lines()],
      subtotal: this.cart.subtotal(),
      discount: this.cart.orderDiscount(),
      total: this.cart.total(),
      orderNumber: this.cart.nextOrderNumber(),
    };
    const result = this.cart.finishOrder(method, received);
    if (result.success) {
      this.closePaymentModal();
      this.orderDataForPrint.set(snapshot);
      this.showPrintPromptModal.set(true);
    } else if (result.message) {
      this.paymentError.set(result.message);
    }
  }

  protected closePrintPromptModal(): void {
    this.showPrintPromptModal.set(false);
    this.orderDataForPrint.set(null);
  }

  protected printCupomAndClose(): void {
    const data = this.orderDataForPrint();
    if (data) {
      const content = this.reportBuilder.buildPdvCupomText(
        data,
        (v) => this.cart.money(v),
      );
      this.printService.printHtmlInNewWindow(content, { title: `Pedido #${data.orderNumber}` });
    }
    this.closePrintPromptModal();
  }

  protected openDiscountModal(): void {
    const current = this.cart.orderDiscount();
    this.discountInput.set(current);
    this.discountPctInput.set(0);
    this.discountType.set('value');
    this.showDiscountModal.set(true);
  }

  protected closeDiscountModal(): void {
    this.showDiscountModal.set(false);
  }

  protected onDiscountValueChange(value: number): void {
    this.discountInput.set(value);
    const sub = this.cart.subtotal();
    this.discountPctInput.set(sub > 0 ? Math.round((value / sub) * 10000) / 100 : 0);
    this.discountType.set('value');
  }

  protected onDiscountPctChange(pct: number): void {
    this.discountPctInput.set(pct);
    const sub = this.cart.subtotal();
    this.discountInput.set(Math.round(sub * pct) / 100);
    this.discountType.set('pct');
  }

  protected applyDiscount(): void {
    const val = Math.max(0, Number(this.discountInput()) || 0);
    this.cart.setDiscount(val);
    this.closeDiscountModal();
  }

  protected addSale(): void {
    const desc = this.newDescription().trim() || 'Venda';
    const qty = Math.max(0, this.newQuantity());
    const price = Math.max(0, this.newUnitPrice());
    if (qty <= 0 || price <= 0) return;
    this.pdv.addSale(desc, qty, price);
    this.newDescription.set('');
    this.newQuantity.set(1);
    this.newUnitPrice.set(0);
  }

  protected removeSale(id: string): void {
    this.pdv.removeSale(id);
  }

  protected clearToday(): void {
    this.pdv.clearToday();
  }

  protected clearAll(): void {
    this.pdv.clearAll();
  }

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
