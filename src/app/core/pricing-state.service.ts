import { Injectable, inject, signal, computed } from '@angular/core';
import { StorageService } from './storage.service';

const LS_KEY = 'pricing.v1';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export type YieldLabel = 'unidade' | 'fatia';

export interface Category {
  id: string;
  name: string;
}

export interface RecipeItem {
  id: string;
  name: string;
  pricePaid: number;
  qtdTotal: number;
  qtdUsed: number;
  type: 'ingrediente' | 'embalagem';
}

export interface Recipe {
  id: string;
  name: string;
  yieldUnits: number;
  yieldLabel: YieldLabel;
  minutes: number;
  notes: string;
  items: RecipeItem[];
  categoryId?: string | null;
}

export interface FixedCostItem {
  id: string;
  name: string;
  value: number;
}

export interface FeePctItem {
  id: string;
  name: string;
  pct: number;
}

export interface VarFixedItem {
  id: string;
  name: string;
  value: number;
}

export interface DatabaseItem {
  id: string;
  name: string;
  pricePaid: number;
  qtdTotal: number;
}

export interface PricingState {
  fixed: {
    monthlyHours: number;
    workDaysPerMonth: number;
    laborHourly: number;
    items: FixedCostItem[];
  };
  fees: {
    pct: FeePctItem[];
    fixedPerUnit: VarFixedItem[];
  };
  recipes: Recipe[];
  categories: Category[];
  selectedRecipeId: string | null;
  pricing: {
    mode: 'byMargin' | 'byMarket';
    desiredMargin: number;
    marketPrice: number;
  };
  database: {
    ingredients: DatabaseItem[];
    packaging: DatabaseItem[];
  };
}

export interface RecipeTotals {
  cmvTotal: number;
  packTotal: number;
  cmvUnit: number;
  packUnit: number;
  laborUnit: number;
}

export interface UnitCostParts {
  cmvUnit: number;
  packUnit: number;
  laborUnit: number;
  fixedUnit: number;
  varUnit: number;
}

export interface PricingResult {
  unitCost: number;
  suggestedPrice: number;
  markup: number;
  netProfitUnit: number;
  realMargin: number;
  feesPct: number;
  ok: boolean;
  reason: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(2, 8);
}

function safeNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const DEFAULT_STATE: PricingState = {
  fixed: { monthlyHours: 160, workDaysPerMonth: 22, laborHourly: 0, items: [] },
  fees: { pct: [], fixedPerUnit: [] },
  recipes: [],
  categories: [],
  selectedRecipeId: null,
  pricing: { mode: 'byMargin', desiredMargin: 30, marketPrice: 0 },
  database: { ingredients: [], packaging: [] },
};

function mergeState(base: PricingState, incoming: Partial<PricingState>): PricingState {
  if (!incoming || typeof incoming !== 'object') return base;
  const out = { ...base };
  for (const k of Object.keys(incoming) as (keyof PricingState)[]) {
    const val = incoming[k];
    if (val == null) continue;
    if (k === 'fixed' && typeof val === 'object') {
      out.fixed = { ...base.fixed, ...val };
      out.fixed.items = Array.isArray((val as PricingState['fixed']).items) ? (val as PricingState['fixed']).items : base.fixed.items;
    } else if (k === 'fees' && typeof val === 'object') {
      out.fees = { ...base.fees, ...val };
      out.fees.pct = Array.isArray((val as PricingState['fees']).pct) ? (val as PricingState['fees']).pct : base.fees.pct;
      out.fees.fixedPerUnit = Array.isArray((val as PricingState['fees']).fixedPerUnit) ? (val as PricingState['fees']).fixedPerUnit : base.fees.fixedPerUnit;
    } else if (k === 'recipes' && Array.isArray(val)) {
      out.recipes = val as Recipe[];
    } else if (k === 'categories' && Array.isArray(val)) {
      out.categories = val as Category[];
    } else if (k === 'database' && typeof val === 'object') {
      out.database = { ...base.database, ...val };
      out.database.ingredients = Array.isArray((val as PricingState['database']).ingredients) ? (val as PricingState['database']).ingredients : base.database.ingredients;
      out.database.packaging = Array.isArray((val as PricingState['database']).packaging) ? (val as PricingState['database']).packaging : base.database.packaging;
    } else {
      (out as Record<string, unknown>)[k] = val;
    }
  }
  return out;
}

@Injectable({ providedIn: 'root' })
export class PricingStateService {
  private readonly storage = inject(StorageService);
  private readonly stateSignal = signal<PricingState>(this.loadState());

  readonly state = this.stateSignal.asReadonly();

  readonly recipes = computed(() => this.stateSignal().recipes);
  readonly categories = computed(() => this.stateSignal().categories ?? []);
  readonly selectedRecipeId = computed(() => this.stateSignal().selectedRecipeId);
  readonly selectedRecipe = computed(() => {
    const s = this.stateSignal();
    return s.recipes.find((r) => r.id === s.selectedRecipeId) ?? null;
  });
  readonly fixed = computed(() => this.stateSignal().fixed);
  readonly fees = computed(() => this.stateSignal().fees);
  readonly pricing = computed(() => this.stateSignal().pricing);
  readonly database = computed(() => this.stateSignal().database);

  private loadState(): PricingState {
    const parsed = this.storage.get<Partial<PricingState>>(LS_KEY);
    if (!parsed) return structuredClone(DEFAULT_STATE);
    return mergeState(structuredClone(DEFAULT_STATE), parsed);
  }

  private persist(): void {
    this.storage.set(LS_KEY, this.stateSignal());
  }

  reload(): void {
    this.stateSignal.set(this.loadState());
  }

  private update(partial: Partial<PricingState>): void {
    this.stateSignal.update((s) => ({ ...s, ...partial }));
    this.persist();
  }

  private updateNested<K extends keyof PricingState>(key: K, value: PricingState[K]): void {
    this.stateSignal.update((s) => ({ ...s, [key]: value }));
    this.persist();
  }

  // --- Formatação (uso em templates) ---
  money(v: number): string {
    return BRL.format(Number.isFinite(v) ? v : 0);
  }
  pct(v: number): string {
    return (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }
  fx(v: number): string {
    return (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  formatQtd(v: unknown): string {
    if (v === undefined || v === null || v === '') return '-';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : '-';
  }

  getUnitLabel(r: Recipe | null): 'fatia' | 'unidade' {
    return r?.yieldLabel === 'fatia' ? 'fatia' : 'unidade';
  }

  itemCost(item: RecipeItem): number {
    const pricePaid = safeNum(item.pricePaid);
    const qtdTotal = safeNum(item.qtdTotal);
    const qtdUsed = safeNum(item.qtdUsed);
    if (pricePaid <= 0 || qtdTotal <= 0 || qtdUsed <= 0) return 0;
    return (pricePaid / qtdTotal) * qtdUsed;
  }

  calcRecipeTotals(r: Recipe): RecipeTotals {
    const yieldUnits = clamp(safeNum(r.yieldUnits), 1, 999999);
    let cmvTotal = 0;
    let packTotal = 0;
    for (const it of r.items) {
      const c = this.itemCost(it);
      if (it.type === 'embalagem') packTotal += c;
      else cmvTotal += c;
    }
    const laborHourly = safeNum(this.stateSignal().fixed.laborHourly);
    const minutes = clamp(safeNum(r.minutes), 0, 999999);
    const laborUnit = ((laborHourly / 60) * minutes) / yieldUnits;
    return {
      cmvTotal,
      packTotal,
      cmvUnit: cmvTotal / yieldUnits,
      packUnit: packTotal / yieldUnits,
      laborUnit,
    };
  }

  fixedMonthlyTotal(): number {
    return this.stateSignal().fixed.items.reduce((sum, it) => sum + safeNum(it.value), 0);
  }
  fixedPerHour(): number {
    const total = this.fixedMonthlyTotal();
    const mh = clamp(safeNum(this.stateSignal().fixed.monthlyHours), 1, 999999);
    return total / mh;
  }
  fixedPerUnitForRecipe(r: Recipe): number {
    const perHour = this.fixedPerHour();
    const minutes = clamp(safeNum(r.minutes), 0, 999999);
    const yieldUnits = clamp(safeNum(r.yieldUnits), 1, 999999);
    return ((perHour / 60) * minutes) / yieldUnits;
  }

  feesPctTotal(): number {
    return this.stateSignal().fees.pct.reduce((sum, it) => sum + safeNum(it.pct), 0);
  }
  varFixedTotal(): number {
    return this.stateSignal().fees.fixedPerUnit.reduce((sum, it) => sum + safeNum(it.value), 0);
  }

  computeUnitCost(): { unitCost: number; parts: UnitCostParts | null } {
    const r = this.selectedRecipe();
    if (!r) return { unitCost: 0, parts: null };
    const t = this.calcRecipeTotals(r);
    const fixedUnit = this.fixedPerUnitForRecipe(r);
    const varUnit = this.varFixedTotal();
    const unitCost = t.cmvUnit + t.packUnit + t.laborUnit + fixedUnit + varUnit;
    return {
      unitCost,
      parts: {
        cmvUnit: t.cmvUnit,
        packUnit: t.packUnit,
        laborUnit: t.laborUnit,
        fixedUnit,
        varUnit,
      },
    };
  }

  getPricingResult(): PricingResult {
    const { unitCost } = this.computeUnitCost();
    const fees = clamp(this.feesPctTotal() / 100, 0, 0.95);
    const mode = this.stateSignal().pricing.mode || 'byMargin';
    const out: PricingResult = {
      unitCost,
      suggestedPrice: 0,
      markup: 0,
      netProfitUnit: 0,
      realMargin: 0,
      feesPct: fees * 100,
      ok: true,
      reason: '',
    };
    if (unitCost <= 0) {
      out.ok = false;
      out.reason = 'Preencha uma receita e custos para calcular.';
      return out;
    }
    if (mode === 'byMargin') {
      const desired = clamp(safeNum(this.stateSignal().pricing.desiredMargin) / 100, 0, 0.95);
      const denom = 1 - fees - desired;
      if (denom <= 0) {
        out.ok = false;
        out.reason = 'Taxas + margem ≥ 100%. Impossível precificar.';
        return out;
      }
      out.suggestedPrice = unitCost / denom;
      out.realMargin = desired * 100;
    } else {
      const market = clamp(safeNum(this.stateSignal().pricing.marketPrice), 0, 999999);
      out.suggestedPrice = market;
      out.realMargin = market > 0 ? ((market * (1 - fees) - unitCost) / market) * 100 : 0;
    }
    if (out.suggestedPrice > 0) {
      out.markup = out.suggestedPrice / unitCost;
      out.netProfitUnit = out.suggestedPrice * (1 - fees) - unitCost;
    }
    out.ok = out.netProfitUnit >= 0;
    out.reason = out.ok
      ? 'Números coerentes. Você tem uma base sólida para precificar e vender.'
      : 'A margem está negativa ou muito baixa. Vale revisar custos, preço ou margem desejada.';
    return out;
  }

  // --- Ações de estado ---
  setActiveTab(_tabId: string): void {}

  selectRecipe(id: string | null): void {
    this.stateSignal.update((s) => ({ ...s, selectedRecipeId: id }));
    this.persist();
  }

  addRecipe(): Recipe {
    const r: Recipe = {
      id: uid(),
      name: 'Nova receita',
      yieldUnits: 1,
      yieldLabel: 'unidade',
      minutes: 0,
      notes: '',
      items: [],
    };
    this.stateSignal.update((s) => ({
      ...s,
      recipes: [r, ...s.recipes],
      selectedRecipeId: r.id,
    }));
    this.persist();
    return r;
  }

  deleteRecipe(id: string): void {
    const s = this.stateSignal();
    const next = s.recipes.filter((x) => x.id !== id);
    const nextSelected = s.selectedRecipeId === id ? (next[0]?.id ?? null) : s.selectedRecipeId;
    this.stateSignal.set({ ...s, recipes: next, selectedRecipeId: nextSelected });
    this.persist();
  }

  updateRecipe(id: string, patch: Partial<Recipe>): void {
    this.stateSignal.update((s) => ({
      ...s,
      recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    this.persist();
  }

  // --- Categorias ---
  addCategory(name: string): Category {
    const trimmed = (name || '').trim();
    if (!trimmed) return { id: '', name: '' };
    const s = this.stateSignal();
    const existing = (s.categories || []).find(
      (c) => c.name.toLocaleLowerCase('pt-BR') === trimmed.toLocaleLowerCase('pt-BR')
    );
    if (existing) return existing;
    const cat: Category = { id: uid(), name: trimmed };
    this.stateSignal.update((state) => ({
      ...state,
      categories: [cat, ...(state.categories || [])],
    }));
    this.persist();
    return cat;
  }

  updateCategory(id: string, patch: Partial<Category>): void {
    this.stateSignal.update((s) => ({
      ...s,
      categories: (s.categories || []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    this.persist();
  }

  removeCategory(id: string): void {
    this.stateSignal.update((s) => ({
      ...s,
      categories: (s.categories || []).filter((c) => c.id !== id),
      recipes: s.recipes.map((r) =>
        r.categoryId === id ? { ...r, categoryId: null } : r
      ),
    }));
    this.persist();
  }

  addRecipeItem(recipeId: string): RecipeItem {
    const item: RecipeItem = {
      id: uid(),
      name: '',
      pricePaid: 0,
      qtdTotal: 0,
      qtdUsed: 0,
      type: 'ingrediente',
    };
    this.stateSignal.update((s) => ({
      ...s,
      recipes: s.recipes.map((r) =>
        r.id === recipeId ? { ...r, items: [item, ...r.items] } : r
      ),
    }));
    this.persist();
    return item;
  }

  removeRecipeItem(recipeId: string, itemId: string): void {
    this.stateSignal.update((s) => ({
      ...s,
      recipes: s.recipes.map((r) =>
        r.id === recipeId ? { ...r, items: r.items.filter((i) => i.id !== itemId) } : r
      ),
    }));
    this.persist();
  }

  updateRecipeItem(recipeId: string, itemId: string, patch: Partial<RecipeItem>): void {
    this.stateSignal.update((s) => ({
      ...s,
      recipes: s.recipes.map((r) =>
        r.id === recipeId
          ? { ...r, items: r.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : r
      ),
    }));
    this.persist();
  }

  setFromBank(recipeId: string, itemId: string, type: 'ingrediente' | 'embalagem', name: string): void {
    const s = this.stateSignal();
    const list = type === 'embalagem' ? s.database.packaging : s.database.ingredients;
    const bank = list.find((x) => (x.name || '').trim() === name.trim());
    if (!bank) return;
    this.updateRecipeItem(recipeId, itemId, {
      name: bank.name,
      pricePaid: safeNum(bank.pricePaid),
      qtdTotal: safeNum(bank.qtdTotal),
      type,
    });
  }

  /** Adiciona um novo item à receita já preenchido com dados do banco. */
  addRecipeItemFromBank(recipeId: string, type: 'ingrediente' | 'embalagem', bankName: string): void {
    const item = this.addRecipeItem(recipeId);
    this.setFromBank(recipeId, item.id, type, bankName);
  }

  updateFixed(patch: Partial<PricingState['fixed']>): void {
    this.stateSignal.update((s) => ({ ...s, fixed: { ...s.fixed, ...patch } }));
    this.persist();
  }

  addFixedItem(): void {
    const item: FixedCostItem = { id: uid(), name: '', value: 0 };
    this.stateSignal.update((s) => ({ ...s, fixed: { ...s.fixed, items: [item, ...s.fixed.items] } }));
    this.persist();
  }

  removeFixedItem(id: string): void {
    this.stateSignal.update((s) => ({ ...s, fixed: { ...s.fixed, items: s.fixed.items.filter((i) => i.id !== id) } }));
    this.persist();
  }

  updateFixedItem(id: string, patch: Partial<FixedCostItem>): void {
    this.stateSignal.update((s) => ({
      ...s,
      fixed: { ...s.fixed, items: s.fixed.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) },
    }));
    this.persist();
  }

  addFeePct(): void {
    const item: FeePctItem = { id: uid(), name: '', pct: 0 };
    this.stateSignal.update((s) => ({ ...s, fees: { ...s.fees, pct: [item, ...s.fees.pct] } }));
    this.persist();
  }

  removeFeePct(id: string): void {
    this.stateSignal.update((s) => ({ ...s, fees: { ...s.fees, pct: s.fees.pct.filter((i) => i.id !== id) } }));
    this.persist();
  }

  updateFeePct(id: string, patch: Partial<FeePctItem>): void {
    this.stateSignal.update((s) => ({
      ...s,
      fees: { ...s.fees, pct: s.fees.pct.map((i) => (i.id === id ? { ...i, ...patch } : i)) },
    }));
    this.persist();
  }

  addVarFixed(): void {
    const item: VarFixedItem = { id: uid(), name: '', value: 0 };
    this.stateSignal.update((s) => ({ ...s, fees: { ...s.fees, fixedPerUnit: [item, ...s.fees.fixedPerUnit] } }));
    this.persist();
  }

  removeVarFixed(id: string): void {
    this.stateSignal.update((s) => ({ ...s, fees: { ...s.fees, fixedPerUnit: s.fees.fixedPerUnit.filter((i) => i.id !== id) } }));
    this.persist();
  }

  updateVarFixed(id: string, patch: Partial<VarFixedItem>): void {
    this.stateSignal.update((s) => ({
      ...s,
      fees: { ...s.fees, fixedPerUnit: s.fees.fixedPerUnit.map((i) => (i.id === id ? { ...i, ...patch } : i)) },
    }));
    this.persist();
  }

  updatePricing(patch: Partial<PricingState['pricing']>): void {
    this.stateSignal.update((s) => ({ ...s, pricing: { ...s.pricing, ...patch } }));
    this.persist();
  }

  addDbIngredient(): void {
    const item: DatabaseItem = { id: uid(), name: '', pricePaid: 0, qtdTotal: 0 };
    this.stateSignal.update((s) => ({ ...s, database: { ...s.database, ingredients: [item, ...s.database.ingredients] } }));
    this.persist();
  }

  addDbPackaging(): void {
    const item: DatabaseItem = { id: uid(), name: '', pricePaid: 0, qtdTotal: 0 };
    this.stateSignal.update((s) => ({ ...s, database: { ...s.database, packaging: [item, ...s.database.packaging] } }));
    this.persist();
  }

  removeDbIngredient(id: string): void {
    this.stateSignal.update((s) => ({ ...s, database: { ...s.database, ingredients: s.database.ingredients.filter((i) => i.id !== id) } }));
    this.persist();
  }

  removeDbPackaging(id: string): void {
    this.stateSignal.update((s) => ({ ...s, database: { ...s.database, packaging: s.database.packaging.filter((i) => i.id !== id) } }));
    this.persist();
  }

  updateDbIngredient(id: string, patch: Partial<DatabaseItem>): void {
    this.stateSignal.update((s) => ({
      ...s,
      database: { ...s.database, ingredients: s.database.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)) },
    }));
    this.persist();
  }

  updateDbPackaging(id: string, patch: Partial<DatabaseItem>): void {
    this.stateSignal.update((s) => ({
      ...s,
      database: { ...s.database, packaging: s.database.packaging.map((i) => (i.id === id ? { ...i, ...patch } : i)) },
    }));
    this.persist();
  }

  loadMock(): void {
    const mock = this.getMockState();
    this.stateSignal.set(mergeState(structuredClone(DEFAULT_STATE), mock));
    this.persist();
  }

  reset(): void {
    this.stateSignal.set(structuredClone(DEFAULT_STATE));
    this.persist();
  }

  getMockState(): Partial<PricingState> {
    const r1 = uid();
    const r2 = uid();
    const catBolos = uid();
    const catDoces = uid();
    return {
      fixed: {
        monthlyHours: 160,
        workDaysPerMonth: 22,
        laborHourly: 28,
        items: [
          { id: uid(), name: 'Aluguel (kitchen/point)', value: 850 },
          { id: uid(), name: 'Luz', value: 220 },
          { id: uid(), name: 'Gás', value: 95 },
          { id: uid(), name: 'Internet + celular', value: 120 },
          { id: uid(), name: 'MEI / licenças', value: 67 },
          { id: uid(), name: 'Material de limpeza', value: 75 },
          { id: uid(), name: 'Embalagens gerais (estoque)', value: 150 },
        ],
      },
      fees: {
        pct: [
          { id: uid(), name: 'Cartão (débito/crédito)', pct: 3.5 },
          { id: uid(), name: 'iFood / delivery', pct: 12 },
          { id: uid(), name: 'Imposto (Simples)', pct: 6 },
        ],
        fixedPerUnit: [
          { id: uid(), name: 'Etiqueta', value: 0.12 },
          { id: uid(), name: 'Saco / laço', value: 0.25 },
        ],
      },
      categories: [
        { id: catBolos, name: 'Bolos' },
        { id: catDoces, name: 'Doces de festa' },
      ],
      recipes: [
        {
          id: r1,
          name: 'Bolo de cenoura (formato 12 fatias)',
          yieldUnits: 12,
          yieldLabel: 'fatia',
          minutes: 85,
          notes: 'Assar 35–40 min 180 °C. Forma 24 cm. Conservar em geladeira.',
          categoryId: catBolos,
          items: [
            { id: uid(), name: 'Farinha de trigo', pricePaid: 4.8, qtdTotal: 1000, qtdUsed: 320, type: 'ingrediente' },
            { id: uid(), name: 'Açúcar refinado', pricePaid: 5.2, qtdTotal: 1000, qtdUsed: 280, type: 'ingrediente' },
            { id: uid(), name: 'Óleo de soja', pricePaid: 11, qtdTotal: 900, qtdUsed: 120, type: 'ingrediente' },
            { id: uid(), name: 'Cenoura', pricePaid: 4.5, qtdTotal: 1000, qtdUsed: 350, type: 'ingrediente' },
            { id: uid(), name: 'Ovos (un)', pricePaid: 18, qtdTotal: 30, qtdUsed: 4, type: 'ingrediente' },
            { id: uid(), name: 'Fermento químico', pricePaid: 4.2, qtdTotal: 100, qtdUsed: 12, type: 'ingrediente' },
            { id: uid(), name: 'Forminha/caixa bolo 12 fatias', pricePaid: 14, qtdTotal: 50, qtdUsed: 1, type: 'embalagem' },
          ],
        },
        {
          id: r2,
          name: 'Brigadeiro (30 unidades)',
          yieldUnits: 30,
          yieldLabel: 'unidade',
          minutes: 50,
          notes: 'Fazer bolinhas e passar no granulado. Embalar em forminhas.',
          categoryId: catDoces,
          items: [
            { id: uid(), name: 'Leite condensado', pricePaid: 8.5, qtdTotal: 395, qtdUsed: 395, type: 'ingrediente' },
            { id: uid(), name: 'Chocolate em pó 50%', pricePaid: 14, qtdTotal: 400, qtdUsed: 200, type: 'ingrediente' },
            { id: uid(), name: 'Manteiga', pricePaid: 12, qtdTotal: 200, qtdUsed: 50, type: 'ingrediente' },
            { id: uid(), name: 'Forminha brigadeiro (un)', pricePaid: 7.5, qtdTotal: 100, qtdUsed: 30, type: 'embalagem' },
          ],
        },
      ],
      selectedRecipeId: r1,
      pricing: { mode: 'byMargin', desiredMargin: 32, marketPrice: 0 },
      database: {
        ingredients: [
          { id: uid(), name: 'Farinha de trigo', pricePaid: 4.8, qtdTotal: 1000 },
          { id: uid(), name: 'Açúcar refinado', pricePaid: 5.2, qtdTotal: 1000 },
          { id: uid(), name: 'Óleo de soja', pricePaid: 11, qtdTotal: 900 },
          { id: uid(), name: 'Leite condensado', pricePaid: 8.5, qtdTotal: 395 },
          { id: uid(), name: 'Chocolate em pó 50%', pricePaid: 14, qtdTotal: 400 },
          { id: uid(), name: 'Manteiga', pricePaid: 12, qtdTotal: 200 },
          { id: uid(), name: 'Ovos (un)', pricePaid: 18, qtdTotal: 30 },
          { id: uid(), name: 'Fermento químico', pricePaid: 4.2, qtdTotal: 100 },
          { id: uid(), name: 'Cenoura', pricePaid: 4.5, qtdTotal: 1000 },
        ],
        packaging: [
          { id: uid(), name: 'Forminha brigadeiro (un)', pricePaid: 7.5, qtdTotal: 100 },
          { id: uid(), name: 'Forminha/caixa bolo 12 fatias', pricePaid: 14, qtdTotal: 50 },
          { id: uid(), name: 'Saco para bolo', pricePaid: 3, qtdTotal: 20 },
        ],
      },
    };
  }
}
