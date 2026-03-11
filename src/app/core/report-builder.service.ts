import { Injectable, inject } from '@angular/core';
import type { CartLineItem, PaymentMethod } from './pdv-cart.service';
import type { Recipe } from './pricing-state.service';
import { PricingStateService } from './pricing-state.service';

export interface OrderSnapshotForPrintLike {
  lines: CartLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  orderNumber: number;
  payments?: Array<{ method: PaymentMethod | string; amount: number }>;
  dinheiroReceived?: number | null;
}

@Injectable({ providedIn: 'root' })
export class ReportBuilderService {
  buildPdvCupomText(
    data: OrderSnapshotForPrintLike,
    money: (v: number) => string,
    now: () => string = () => new Date().toLocaleString('pt-BR'),
  ): string {
    const PAYMENT_LABELS: Record<string, string> = {
      dinheiro: 'Dinheiro',
      debito: 'Débito',
      credito: 'Crédito',
      pix: 'PIX',
      outros: 'Outros',
    };

    const payments = data.payments ?? [];
    const pagamentoLines: string[] = [];
    let dinheiroTotal = 0;
    if (payments.length > 0) {
      pagamentoLines.push('---');
      pagamentoLines.push('Pagamentos:');
      for (const p of payments) {
        const label = PAYMENT_LABELS[p.method] ?? p.method;
        pagamentoLines.push(`- ${label}: ${money(p.amount)}`);
        if (p.method === 'dinheiro') dinheiroTotal += p.amount;
      }
      if (dinheiroTotal > 0 && data.dinheiroReceived != null) {
        const troco = data.dinheiroReceived - dinheiroTotal;
        pagamentoLines.push(`Recebido em dinheiro: ${money(data.dinheiroReceived)}`);
        if (troco > 0) pagamentoLines.push(`Troco: ${money(troco)}`);
      }
    }

    return [
      `Pedido #${data.orderNumber}`,
      now(),
      '---',
      ...data.lines.map(
        (l) =>
          `${l.name} ${l.quantity}x ${money(l.unitPrice)} = ${money(l.subtotal)}${
            l.note ? ` (${l.note})` : ''
          }`,
      ),
      '---',
      `Subtotal: ${money(data.subtotal)}`,
      `Desconto: ${money(data.discount)}`,
      `Total: ${money(data.total)}`,
      ...pagamentoLines,
    ].join('\n');
  }

  private readonly pricing = inject(PricingStateService);

  buildFichaTecnicaHtml(recipe: Recipe | null): string {
    if (!recipe) {
      return '<div class="ft-print-layout"><div class="ft-page"><p>Nenhuma receita selecionada.</p></div></div>';
    }

    const t = this.pricing.calcRecipeTotals(recipe);
    const result = this.pricing.getPricingResult();
    const unitLabel = this.pricing.getUnitLabel(recipe);
    const unitLabelPlural = recipe.yieldLabel === 'fatia' ? 'fatias' : 'unidades';
    const totalReceita = t.cmvTotal + t.packTotal;
    const custoDiretoPorUnidade = recipe.yieldUnits > 0 ? totalReceita / recipe.yieldUnits : 0;
    const categoryName = recipe.categoryId
      ? this.pricing.categories().find((c) => c.id === recipe.categoryId)?.name ?? null
      : null;
    const unidadeMedida = recipe.yieldLabel === 'fatia' ? 'Fatia' : 'Unidade';

    const rows = (recipe.items || []).map((i) => {
      const cost = this.pricing.itemCost(i);
      const pct = totalReceita > 0 ? (cost / totalReceita) * 100 : 0;
      return `<tr><td>${this.escapeHtml(i.name)}</td><td class="ft-num">${this.pricing.money(
        i.pricePaid ?? 0,
      )}</td><td class="ft-num">${i.qtdTotal ?? 0}</td><td class="ft-num">${
        i.qtdUsed ?? 0
      }</td><td class="ft-num">${this.pricing.money(
        cost,
      )}</td><td class="ft-num">${this.pricing.fx(pct)}%</td><td>${
        i.type === 'embalagem' ? 'Embalagem' : 'Ingrediente'
      }</td></tr>`;
    });

    const notesBlock = recipe.notes?.trim()
      ? `<section class="ft-section"><h2 class="ft-section-title">Observações / Modo de preparo</h2><div class="ft-notes">${this.escapeHtml(
          recipe.notes,
        )}</div></section>`
      : '';

    const categoriaRow = categoryName
      ? `<tr><th>Categoria</th><td>${this.escapeHtml(categoryName)}</td></tr>`
      : '';

    return `
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
                <tr class="ft-total"><td colspan="4">Subtotal ingredientes (CMV)</td><td class="ft-num">${this.pricing.money(
                  t.cmvTotal,
                )}</td><td></td><td></td></tr>
                <tr class="ft-total"><td colspan="4">Subtotal embalagens</td><td class="ft-num">${this.pricing.money(
                  t.packTotal,
                )}</td><td></td><td></td></tr>
                <tr class="ft-total"><td colspan="4">Total (CMV + Embalagem)</td><td class="ft-num">${this.pricing.money(
                  totalReceita,
                )}</td><td class="ft-num">100%</td><td></td></tr>
              </tfoot>
            </table>
          </section>
          <section class="ft-section">
            <h2 class="ft-section-title">Custos da receita</h2>
            <table class="ft-table-inline">
              <tbody>
                <tr><th>CMV total (ingredientes)</th><td class="ft-num">${this.pricing.money(
                  t.cmvTotal,
                )}</td></tr>
                <tr><th>Embalagem total</th><td class="ft-num">${this.pricing.money(
                  t.packTotal,
                )}</td></tr>
                <tr><th>Total custo direto</th><td class="ft-num">${this.pricing.money(
                  totalReceita,
                )}</td></tr>
                <tr><th>Custo direto por ${unitLabel}</th><td class="ft-num">${this.pricing.money(
                  custoDiretoPorUnidade,
                )}</td></tr>
              </tbody>
            </table>
          </section>
          <section class="ft-section">
            <h2 class="ft-section-title">Precificação sugerida</h2>
            <table class="ft-table-inline">
              <tbody>
                <tr><th>Preço sugerido (venda)</th><td class="ft-num">${this.pricing.money(
                  result.suggestedPrice,
                )}</td></tr>
                <tr><th>Margem líquida</th><td class="ft-num">${this.pricing.fx(
                  result.realMargin,
                )}%</td></tr>
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
}

