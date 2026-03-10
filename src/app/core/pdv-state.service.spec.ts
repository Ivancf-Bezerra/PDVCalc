import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PdvStateService } from './pdv-state.service';
import { StorageService } from './storage.service';

const mockStorage = (): StorageService =>
  ({ get: () => null, set: () => {}, remove: () => {} }) as unknown as StorageService;

describe('PdvStateService', () => {
  let service: PdvStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PdvStateService,
        { provide: StorageService, useValue: mockStorage() },
      ],
    });
    service = TestBed.inject(PdvStateService);
  });

  // --- addSale ---

  it('deve registrar uma venda simples', () => {
    service.addSale('Brigadeiro', 2, 5);
    expect(service.sales().length).toBe(1);
    expect(service.sales()[0].total).toBe(10);
  });

  it('deve calcular total diário excluindo cancelamentos', () => {
    service.addSale('Brigadeiro', 2, 5);
    service.addSale('Bolo', 1, 20);
    const id = service.sales().find((s) => s.description === 'Brigadeiro')!.id;
    service.cancelSale(id);
    expect(service.dailyTotal()).toBeCloseTo(20, 5);
  });

  // --- addSales (pedido com múltiplos itens) ---

  it('deve agrupar múltiplos itens como um único pedido', () => {
    service.addSales([
      { description: 'Brigadeiro', quantity: 2, unitPrice: 5 },
      { description: 'Truffa', quantity: 1, unitPrice: 8 },
    ], 'pix', 1);
    expect(service.sales().length).toBe(2);
    const orderId = service.sales()[0].orderId;
    expect(service.sales()[1].orderId).toBe(orderId);
  });

  // --- cancelOrder / restoreOrder ---

  it('deve cancelar todos os itens de um pedido', () => {
    service.addSales([
      { description: 'Brigadeiro', quantity: 1, unitPrice: 5 },
      { description: 'Bolo', quantity: 1, unitPrice: 10 },
    ], 'dinheiro', 1);
    const orderId = service.sales()[0].orderId!;
    service.cancelOrder(orderId);
    const orderItems = service.sales().filter((s) => s.orderId === orderId);
    expect(orderItems.every((s) => s.cancelled)).toBe(true);
  });

  it('deve restaurar pedido cancelado', () => {
    service.addSales([{ description: 'Truffa', quantity: 1, unitPrice: 12 }], 'pix', 1);
    const orderId = service.sales()[0].orderId!;
    service.cancelOrder(orderId);
    service.restoreOrder(orderId);
    const item = service.sales().find((s) => s.orderId === orderId);
    expect(item?.cancelled).toBe(false);
  });

  // --- todayOrders (agrupamento) ---

  it('deve agrupar vendas em pedidos para todayOrders', () => {
    service.addSales([
      { description: 'A', quantity: 1, unitPrice: 5 },
      { description: 'B', quantity: 1, unitPrice: 3 },
    ], 'pix', 1);
    service.addSale('C', 1, 8);
    expect(service.todayOrders().length).toBe(2);
  });

  // --- monthlySales ---

  it('deve excluir vendas canceladas do total mensal', () => {
    service.addSale('X', 1, 100);
    const id = service.sales()[0].id;
    service.cancelSale(id);
    service.addSale('Y', 1, 50);
    expect(service.monthlySales().length).toBeGreaterThan(0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const month = service.monthlySales().find((m) => m.monthKey === thisMonth);
    expect(month?.total).toBeCloseTo(50, 5);
  });

  // --- money (formatação) ---

  it('deve formatar valor monetário no formato pt-BR', () => {
    expect(service.money(10)).toContain('10');
  });
});
