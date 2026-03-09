import { Injectable, signal } from '@angular/core';

export interface SidebarSubmenuItem {
  id: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class SidebarSubmenuService {
  /** Itens do submenu da rota atual (abas PDV ou Calculadora). */
  readonly submenuItems = signal<SidebarSubmenuItem[]>([]);
  /** Id da aba/submenu atualmente ativa. */
  readonly activeSubmenuId = signal<string | null>(null);

  setSubmenuItems(items: SidebarSubmenuItem[]): void {
    this.submenuItems.set(items);
  }

  /** Limpa apenas os itens; mantém activeSubmenuId para a próxima rota usar ao montar. */
  clearSubmenuItems(): void {
    this.submenuItems.set([]);
  }

  setActiveSubmenuId(id: string | null): void {
    this.activeSubmenuId.set(id);
  }
}
