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
}
