import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PricingStateService } from './pricing-state.service';
import { StorageService } from './storage.service';

const mockStorage = (): StorageService =>
  ({ get: () => null, set: () => {}, remove: () => {} }) as unknown as StorageService;

describe('PricingStateService', () => {
  let service: PricingStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PricingStateService,
        { provide: StorageService, useValue: mockStorage() },
      ],
    });
    service = TestBed.inject(PricingStateService);
  });

  // --- itemCost ---

  it('deve calcular custo do item corretamente', () => {
    const item = { id: '1', name: 'Farinha', pricePaid: 10, qtdTotal: 1000, qtdUsed: 200, type: 'ingrediente' as const };
    expect(service.itemCost(item)).toBeCloseTo(2, 5);
  });

  it('deve retornar 0 para item com qtdTotal zerado', () => {
    const item = { id: '1', name: 'X', pricePaid: 10, qtdTotal: 0, qtdUsed: 100, type: 'ingrediente' as const };
    expect(service.itemCost(item)).toBe(0);
  });

  // --- calcRecipeTotals ---

  it('deve calcular totais da receita separando CMV de embalagem', () => {
    const recipe = {
      id: 'r1',
      name: 'Bolo',
      yieldUnits: 10,
      yieldLabel: 'unidade' as const,
      minutes: 60,
      notes: '',
      items: [
        { id: 'i1', name: 'Farinha', pricePaid: 10, qtdTotal: 1000, qtdUsed: 500, type: 'ingrediente' as const },
        { id: 'i2', name: 'Caixinha', pricePaid: 5, qtdTotal: 10, qtdUsed: 10, type: 'embalagem' as const },
      ],
    };
    const totals = service.calcRecipeTotals(recipe);
    expect(totals.cmvTotal).toBeCloseTo(5, 5);
    expect(totals.packTotal).toBeCloseTo(5, 5);
    expect(totals.cmvUnit).toBeCloseTo(0.5, 5);
    expect(totals.packUnit).toBeCloseTo(0.5, 5);
  });

  it('deve calcular mão de obra por unidade', () => {
    service.updateFixed({ laborHourly: 60 });
    const recipe = {
      id: 'r1', name: 'Bolo', yieldUnits: 10, yieldLabel: 'unidade' as const,
      minutes: 120, notes: '', items: [],
    };
    const totals = service.calcRecipeTotals(recipe);
    // ((60/h ÷ 60min) × 120min) ÷ 10unid = (1 × 120) ÷ 10 = 12
    expect(totals.laborUnit).toBeCloseTo(12, 5);
  });

  // --- feesPctTotal / varFixedTotal ---

  it('deve somar taxas percentuais', () => {
    service.addFeePct();
    const feeId = service.fees().pct[0].id;
    service.updateFeePct(feeId, { pct: 5 });
    service.addFeePct();
    const feeId2 = service.fees().pct[0].id;
    service.updateFeePct(feeId2, { pct: 3 });
    expect(service.feesPctTotal()).toBeCloseTo(8, 5);
  });

  it('deve somar variáveis fixas por unidade', () => {
    service.addVarFixed();
    const id = service.fees().fixedPerUnit[0].id;
    service.updateVarFixed(id, { value: 0.5 });
    expect(service.varFixedTotal()).toBeCloseTo(0.5, 5);
  });

  // --- getPricingResult ---

  it('deve retornar ok=false quando não há receita selecionada', () => {
    const result = service.getPricingResult();
    expect(result.ok).toBe(false);
  });

  it('deve calcular preço sugerido pelo markup com margem 30%', () => {
    service.addRecipe();
    const recipeId = service.recipes()[0].id;
    service.selectRecipe(recipeId);
    service.updateRecipe(recipeId, { yieldUnits: 10, minutes: 0 });
    service.addRecipeItem(recipeId);
    const itemId = service.selectedRecipe()!.items[0].id;
    service.updateRecipeItem(recipeId, itemId, { pricePaid: 10, qtdTotal: 100, qtdUsed: 100 });
    service.updatePricing({ mode: 'byMargin', desiredMargin: 30 });
    const result = service.getPricingResult();
    expect(result.ok).toBe(true);
    expect(result.suggestedPrice).toBeGreaterThan(result.unitCost);
    expect(result.realMargin).toBeCloseTo(30, 1);
  });

  it('deve calcular margem real ao usar modo byMarket', () => {
    service.addRecipe();
    const recipeId = service.recipes()[0].id;
    service.selectRecipe(recipeId);
    service.updateRecipe(recipeId, { yieldUnits: 10, minutes: 0 });
    service.addRecipeItem(recipeId);
    const itemId = service.selectedRecipe()!.items[0].id;
    service.updateRecipeItem(recipeId, itemId, { pricePaid: 10, qtdTotal: 100, qtdUsed: 100 });
    service.updatePricing({ mode: 'byMarket', marketPrice: 5 });
    const result = service.getPricingResult();
    expect(result.ok).toBe(true);
    expect(result.suggestedPrice).toBe(5);
    expect(result.realMargin).toBeGreaterThan(0);
  });

  // --- CRUD de receitas ---

  it('deve adicionar e deletar receita', () => {
    service.addRecipe();
    expect(service.recipes().length).toBe(1);
    const id = service.recipes()[0].id;
    service.deleteRecipe(id);
    expect(service.recipes().length).toBe(0);
  });

  it('deve atualizar nome da receita', () => {
    service.addRecipe();
    const id = service.recipes()[0].id;
    service.updateRecipe(id, { name: 'Brigadeiro' });
    expect(service.recipes()[0].name).toBe('Brigadeiro');
  });

  // --- fixedMonthlyTotal ---

  it('deve calcular total de custos fixos mensais', () => {
    service.addFixedItem();
    const id = service.fixed().items[0].id;
    service.updateFixedItem(id, { value: 500 });
    service.addFixedItem();
    const id2 = service.fixed().items[0].id;
    service.updateFixedItem(id2, { value: 300 });
    expect(service.fixedMonthlyTotal()).toBe(800);
  });
});
