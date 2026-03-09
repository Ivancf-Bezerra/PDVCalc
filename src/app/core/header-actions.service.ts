import { Injectable } from '@angular/core';

export interface PrecificacaoActions {
  loadMock: () => void;
  reset: () => void;
  printFicha: () => void;
}

@Injectable({ providedIn: 'root' })
export class HeaderActionsService {
  private precificacaoActions: PrecificacaoActions | null = null;

  registerPrecificacao(actions: PrecificacaoActions): void {
    this.precificacaoActions = actions;
  }

  unregisterPrecificacao(): void {
    this.precificacaoActions = null;
  }

  triggerLoadMock(): void {
    this.precificacaoActions?.loadMock();
  }

  triggerReset(): void {
    this.precificacaoActions?.reset();
  }

  triggerPrintFicha(): void {
    this.precificacaoActions?.printFicha();
  }

  hasPrecificacaoActions(): boolean {
    return this.precificacaoActions != null;
  }
}
