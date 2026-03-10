import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PdvCartService } from './pdv-cart.service';
import { PdvStateService } from './pdv-state.service';
import { ItemsCatalogService } from './items-catalog.service';
import { StorageService } from './storage.service';
import type { CatalogItem } from './items-catalog.service';

const mockStorage = (): StorageService =>
  ({ get: () => null, set: () => {}, remove: () => {} }) as unknown as StorageService;

function makeCatalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'p1',
    name: 'Brigadeiro',
    cmv: 1.5,
    feesPct: 0,
    suggestedPrice: 5,
    manualPrice: 0,
    useManualPrice: false,
    recipeId: null,
    ...overrides,
  };
}

describe('PdvCartService', () => {
  let cart: PdvCartService;
  let catalogService: ItemsCatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PdvCartService,
        PdvStateService,
        ItemsCatalogService,
        { provide: StorageService, useValue: mockStorage() },
      ],
    });
    cart = TestBed.inject(PdvCartService);
    catalogService = TestBed.inject(ItemsCatalogService);
  });

  // --- addItem ---

  it('deve adicionar item ao carrinho', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 2);
    expect(cart.lines().length).toBe(1);
    expect(cart.lines()[0].quantity).toBe(2);
    expect(cart.lines()[0].subtotal).toBeCloseTo(10, 5);
  });

  it('deve incrementar quantidade ao adicionar produto já existente', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 1);
    cart.addItem(product, 2);
    expect(cart.lines().length).toBe(1);
    expect(cart.lines()[0].quantity).toBe(3);
  });

  it('deve tratar produto com nota diferente como linha separada', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 1, 'sem açúcar');
    cart.addItem(product, 1);
    expect(cart.lines().length).toBe(2);
  });

  // --- addCustomItem ---

  it('deve adicionar item avulso', () => {
    cart.addCustomItem('Torta', 1, 25);
    expect(cart.lines().length).toBe(1);
    expect(cart.lines()[0].name).toBe('Torta');
    expect(cart.lines()[0].unitPrice).toBe(25);
  });

  // --- updateQty ---

  it('deve atualizar quantidade da linha', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 1);
    const lineId = cart.lines()[0].id;
    cart.updateQty(lineId, 3);
    expect(cart.lines()[0].quantity).toBe(4);
    expect(cart.lines()[0].subtotal).toBeCloseTo(20, 5);
  });

  it('deve remover linha quando quantidade cai para zero', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 1);
    const lineId = cart.lines()[0].id;
    cart.updateQty(lineId, -1);
    expect(cart.lines().length).toBe(0);
  });

  // --- removeLine ---

  it('deve remover linha do carrinho', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 1);
    const lineId = cart.lines()[0].id;
    cart.removeLine(lineId);
    expect(cart.lines().length).toBe(0);
  });

  // --- setDiscount ---

  it('deve aplicar desconto no total', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 2);
    cart.setDiscount(3);
    expect(cart.total()).toBeCloseTo(7, 5);
    expect(cart.orderDiscount()).toBe(3);
  });

  it('não deve deixar total ficar negativo com desconto excessivo', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 1);
    cart.setDiscount(999);
    expect(cart.total()).toBe(0);
  });

  // --- finishOrder ---

  it('deve retornar erro ao finalizar pedido vazio', () => {
    const result = cart.finishOrder('pix');
    expect(result.success).toBe(false);
  });

  it('deve finalizar pedido e limpar carrinho', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 1);
    const result = cart.finishOrder('pix');
    expect(result.success).toBe(true);
    expect(cart.lines().length).toBe(0);
  });

  it('deve recusar dinheiro insuficiente', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 1);
    const result = cart.finishOrder('dinheiro', 1);
    expect(result.success).toBe(false);
  });

  it('deve calcular troco para pagamento em dinheiro', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 1);
    const result = cart.finishOrder('dinheiro', 10);
    expect(result.success).toBe(true);
    expect(result.change).toBeCloseTo(5, 5);
  });

  // --- clearCart ---

  it('deve limpar carrinho e desconto', () => {
    const product = makeCatalogItem();
    cart.addItem(product, 1);
    cart.setDiscount(2);
    cart.clearCart();
    expect(cart.lines().length).toBe(0);
    expect(cart.orderDiscount()).toBe(0);
  });
});
