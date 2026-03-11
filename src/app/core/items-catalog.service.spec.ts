import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ItemsCatalogService } from './items-catalog.service';
import { StorageService } from './storage.service';

const mockStorage = (): StorageService =>
  ({ get: () => null, set: () => {}, remove: () => {} }) as unknown as StorageService;

describe('ItemsCatalogService', () => {
  let service: ItemsCatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ItemsCatalogService,
        { provide: StorageService, useValue: mockStorage() },
      ],
    });
    service = TestBed.inject(ItemsCatalogService);
  });

  // --- syncFromRecipe ---

  it('deve criar item no catálogo a partir de uma receita', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 1.5, feesPct: 10, suggestedPrice: 5 });
    expect(service.items().length).toBe(1);
    const item = service.items()[0];
    expect(item.name).toBe('Brigadeiro');
    expect(item.recipeId).toBe('r1');
    expect(item.suggestedPrice).toBe(5);
    expect(item.cmv).toBe(1.5);
  });

  it('deve atualizar item existente ao sincronizar novamente', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 1.5, feesPct: 10, suggestedPrice: 5 });
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro de Morango', cmv: 2, feesPct: 10, suggestedPrice: 6 });
    expect(service.items().length).toBe(1);
    expect(service.items()[0].name).toBe('Brigadeiro de Morango');
    expect(service.items()[0].suggestedPrice).toBe(6);
  });

  it('deve preservar preço manual ao sincronizar receita', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 1.5, feesPct: 10, suggestedPrice: 5 });
    const id = service.items()[0].id;
    service.setManualPrice(id, 7);
    service.setUseManualPrice(id, true);
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 2, feesPct: 10, suggestedPrice: 6 });
    expect(service.items()[0].manualPrice).toBe(7);
    expect(service.items()[0].useManualPrice).toBe(true);
  });

  // --- effectivePrice ---

  it('deve retornar preço sugerido quando preço manual não está ativo', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 1, feesPct: 0, suggestedPrice: 5 });
    const item = service.items()[0];
    expect(service.effectivePrice(item)).toBe(5);
  });

  it('deve retornar preço manual quando habilitado', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 1, feesPct: 0, suggestedPrice: 5 });
    const id = service.items()[0].id;
    service.setManualPrice(id, 8);
    service.setUseManualPrice(id, true);
    expect(service.effectivePrice(service.items()[0])).toBe(8);
  });

  // --- setManualPrice ---

  it('não deve aceitar preço manual negativo', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'X', cmv: 1, feesPct: 0, suggestedPrice: 5 });
    const id = service.items()[0].id;
    service.setManualPrice(id, -10);
    expect(service.items()[0].manualPrice).toBe(0);
  });

  // --- removeItem ---

  it('deve remover item do catálogo', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 1, feesPct: 0, suggestedPrice: 5 });
    const id = service.items()[0].id;
    service.removeItem(id);
    expect(service.items().length).toBe(0);
  });

  // --- searchByName ---

  it('deve filtrar itens por nome', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 1, feesPct: 0, suggestedPrice: 5 });
    service.syncFromRecipe({ recipeId: 'r2', name: 'Torta de Limão', cmv: 2, feesPct: 0, suggestedPrice: 10 });
    const results = service.searchByName('briga');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Brigadeiro');
  });

  it('deve retornar todos os itens com query vazia', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'A', cmv: 1, feesPct: 0, suggestedPrice: 5 });
    service.syncFromRecipe({ recipeId: 'r2', name: 'B', cmv: 1, feesPct: 0, suggestedPrice: 5 });
    expect(service.searchByName('').length).toBe(2);
  });

  // --- getGlobalCode / findByGlobalCode ---

  it('deve atribuir código global REC0001 a item de receita (3 letras + 4 números)', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 1, feesPct: 0, suggestedPrice: 5 });
    const item = service.items()[0];
    const code = service.getGlobalCode(item);
    expect(code).toMatch(/^REC\d{4}$/);
    expect(code).toBe('REC0001');
  });

  it('deve localizar produto por código global', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 1, feesPct: 0, suggestedPrice: 5 });
    const item = service.items()[0];
    const code = service.getGlobalCode(item);
    const found = service.findByGlobalCode(code);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Brigadeiro');
  });

  it('deve retornar null para código global não encontrado', () => {
    expect(service.findByGlobalCode('REV9999')).toBeNull();
  });

  // --- setCategory ---

  it('deve alterar categoria do item', () => {
    service.syncFromRecipe({ recipeId: 'r1', name: 'Brigadeiro', cmv: 1, feesPct: 0, suggestedPrice: 5 });
    const id = service.items()[0].id;
    expect(service.items()[0].categoryId).toBe('outros');
    service.setCategory(id, 'doces');
    expect(service.items()[0].categoryId).toBe('doces');
    service.setCategory(id, null);
    expect(service.items()[0].categoryId).toBeUndefined();
  });

  // --- addSupplierItem ---

  it('deve adicionar produto de fornecedor (sem receita) com CMV, markup e valor sugerido', () => {
    const added = service.addSupplierItem({
      name: 'Refrigerante 350ml',
      categoryId: 'bebidas-geladas',
      price: 5.5,
      markupPct: 0,
    });
    expect(added).not.toBeNull();
    expect(service.items().length).toBe(1);
    expect(service.items()[0].name).toBe('Refrigerante 350ml');
    expect(service.items()[0].recipeId).toBeNull();
    expect(service.items()[0].categoryId).toBe('bebidas-geladas');
    expect(service.getGlobalCode(service.items()[0])).toMatch(/^REV\d{4}$/);
    expect(service.items()[0].cmv).toBe(5.5);
    expect(service.items()[0].feesPct).toBe(0);
    expect(service.items()[0].suggestedPrice).toBe(5.5);
    expect(service.items()[0].useManualPrice).toBe(false);
    expect(service.effectivePrice(service.items()[0])).toBe(5.5);
  });

  it('deve calcular valor sugerido com markup padrão (30%)', () => {
    const added = service.addSupplierItem({
      name: 'Suco',
      categoryId: 'bebidas-geladas',
      price: 10,
    });
    expect(added).not.toBeNull();
    expect(service.items()[0].cmv).toBe(10);
    expect(service.items()[0].feesPct).toBe(30);
    expect(service.items()[0].suggestedPrice).toBe(13);
    expect(service.effectivePrice(service.items()[0])).toBe(13);
  });

  it('não deve adicionar produto de fornecedor com nome vazio', () => {
    const added = service.addSupplierItem({
      name: '   ',
      categoryId: 'outros',
      price: 10,
    });
    expect(added).toBeNull();
    expect(service.items().length).toBe(0);
  });
});
