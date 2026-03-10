import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PricingStateService } from '../../core/pricing-state.service';
import { safeNum } from '../../core/safe-num';

@Component({
  selector: 'app-pricing-pricing-tab',
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './pricing-pricing-tab.component.html',
  styleUrl: './precificacao.component.scss',
})
export class PricingPricingTabComponent {
  protected readonly pricing = inject(PricingStateService);

  protected readonly unitLabel = computed(() => this.pricing.getUnitLabel(this.pricing.selectedRecipe()));
  protected readonly pricingResult = computed(() => this.pricing.getPricingResult());

  protected readonly hasMarketAnalysis = computed(() => {
    const r = this.pricingResult();
    return r.ok && this.pricing.pricing().marketPrice > 0;
  });

  protected updateMarketPrice(value: unknown): void {
    this.pricing.updatePricing({ marketPrice: safeNum(value) });
  }

  protected pricingResumoPreco(): string {
    const res = this.pricingResult();
    if (res.unitCost <= 0) return '-';
    return `R$ ${res.prePackPrice.toFixed(2)} (base) + R$ ${(res.unitCost / (1 - res.feesPct / 100) - res.prePackPrice).toFixed(2)} (emb. c/ taxas) = R$ ${res.suggestedPrice.toFixed(2)}`;
  }

  protected marketPriceLabel(): string {
    const res = this.pricingResult();
    const mp = this.pricing.pricing().marketPrice;
    if (mp <= 0 || !res.ok) return '';
    const diff = mp - res.suggestedPrice;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}R$ ${diff.toFixed(2)} em relação ao preço sugerido`;
  }
}
