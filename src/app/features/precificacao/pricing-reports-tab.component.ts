import { Component, computed, inject } from '@angular/core';
import { PricingStateService } from '../../core/pricing-state.service';

@Component({
  selector: 'app-pricing-reports-tab',
  standalone: true,
  imports: [],
  templateUrl: './pricing-reports-tab.component.html',
  styleUrl: './precificacao.component.scss',
})
export class PricingReportsTabComponent {
  protected readonly pricing = inject(PricingStateService);

  protected readonly recipesCount = computed(() => this.pricing.recipes().length);
  protected readonly unitLabel = computed(() => this.pricing.getUnitLabel(this.pricing.selectedRecipe()));
  protected readonly pricingResult = computed(() => this.pricing.getPricingResult());
  protected readonly selectedRecipeTotals = computed(() => {
    const r = this.pricing.selectedRecipe();
    return r ? this.pricing.calcRecipeTotals(r) : null;
  });
}
