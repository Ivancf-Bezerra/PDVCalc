import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, Event, NavigationEnd } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { HeaderActionsService } from './core/header-actions.service';
import { SidebarSubmenuService } from './core/sidebar-submenu.service';
import { AuthService } from './core/auth.service';
import { PdvStateService } from './core/pdv-state.service';
import { ItemsCatalogService } from './core/items-catalog.service';
import { PdvCartService } from './core/pdv-cart.service';
import { PricingStateService } from './core/pricing-state.service';

const THEME_KEY = 'pricing-theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  @ViewChild('menuWrap') menuWrapRef!: ElementRef<HTMLElement>;

  private readonly router = inject(Router);
  private readonly headerActions = inject(HeaderActionsService);
  protected readonly sidebarSubmenu = inject(SidebarSubmenuService);
  protected readonly auth = inject(AuthService);
  private readonly pdvState = inject(PdvStateService);
  private readonly catalog = inject(ItemsCatalogService);
  private readonly cart = inject(PdvCartService);
  private readonly pricing = inject(PricingStateService);

  protected readonly isLoginRoute = signal(false);
  protected readonly userName = computed(() => this.auth.activeUser()?.name ?? 'Usuário');
  protected readonly userInitials = computed(() => {
    const user = this.auth.activeUser();
    return user ? this.auth.getInitials(user.name) : 'U';
  });
  protected readonly userColor = computed(() => this.auth.activeUser()?.avatarColor ?? '#999');

  protected readonly pdvSubmenuItems: Array<{ id: string; label: string; icon: string }> = [
    { id: 'tab-pdv', label: 'PDV', icon: 'shopping-cart' },
    { id: 'tab-daily', label: 'Vendas Diárias', icon: 'file-text' },
    { id: 'tab-monthly', label: 'Relatório mensal', icon: 'calendar' },
    { id: 'tab-yearly', label: 'Relatório anual', icon: 'bar-chart-2' },
    { id: 'tab-bd-items', label: 'BD ITEMS', icon: 'database' },
    { id: 'tab-cadastro-produtos', label: 'Cadastro de Produtos', icon: 'package' },
    { id: 'tab-ifood', label: 'Calculadora iFood', icon: 'percent' },
  ];
  protected readonly precificacaoSubmenuItems: Array<{ id: string; label: string; icon: string }> = [
    { id: 'tab-recipes', label: 'Receitas', icon: 'book-open' },
    { id: 'tab-fixed', label: 'Custos fixos', icon: 'dollar-sign' },
    { id: 'tab-fees', label: 'Taxas', icon: 'percent' },
    { id: 'tab-pricing', label: 'Precificação', icon: 'tag' },
    { id: 'tab-reports', label: 'Relatórios', icon: 'bar-chart-2' },
    { id: 'tab-database', label: 'Banco de dados', icon: 'database' },
  ];

  protected readonly menuOpen = signal(false);
  protected readonly theme = signal<'light' | 'dark' | 'green-light' | 'green-dark'>(this.readStoredTheme());

  protected readonly themeOptions: Array<{ id: 'light' | 'dark' | 'green-light' | 'green-dark'; label: string; icon: string }> = [
    { id: 'light', label: 'Rosa (claro)', icon: 'sun' },
    { id: 'dark', label: 'Rosa (escuro)', icon: 'moon' },
    { id: 'green-light', label: 'Neutro (claro)', icon: 'circle' },
    { id: 'green-dark', label: 'Neutro (escuro)', icon: 'circle' },
  ];

  private readStoredTheme(): 'light' | 'dark' | 'green-light' | 'green-dark' {
    const stored = localStorage.getItem(THEME_KEY) as string | null;
    if (stored === 'light' || stored === 'dark' || stored === 'green-light' || stored === 'green-dark') return stored;
    if (stored === 'neutral-green' || stored === 'neutral') return 'green-light';
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  private lastUserId: string | null = null;

  ngOnInit(): void {
    this.applyTheme(this.theme());
    this.lastUserId = this.auth.activeUserId();
    this.isLoginRoute.set(this.router.url.startsWith('/login'));
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        this.closeMenu();
        this.isLoginRoute.set(event.urlAfterRedirects.startsWith('/login'));
        const currentUserId = this.auth.activeUserId();
        if (currentUserId && currentUserId !== this.lastUserId) {
          this.lastUserId = currentUserId;
          this.reloadAllServices();
        }
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const wrap = this.menuWrapRef?.nativeElement;
    if (wrap && !wrap.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  protected toggleMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected isPdvRoute(): boolean {
    const url = this.router.url;
    return url.startsWith('/pdv') || url === '/pdv';
  }

  protected isPrecificacaoRoute(): boolean {
    const url = this.router.url;
    return url.startsWith('/precificacao') || url === '/precificacao';
  }

  protected onSubmenuSelect(route: 'pdv' | 'precificacao', id: string): void {
    const path = route === 'pdv' ? '/pdv' : '/precificacao';
    if (!this.router.url.startsWith(path)) {
      this.router.navigate([path]);
    }
    this.sidebarSubmenu.setActiveSubmenuId(id);
  }

  protected setTheme(id: 'light' | 'dark' | 'green-light' | 'green-dark'): void {
    this.theme.set(id);
    this.applyTheme(id);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      // ignore
    }
  }

  protected onLoadMock(): void {
    this.headerActions.triggerLoadMock();
  }

  protected onPrintFicha(): void {
    this.headerActions.triggerPrintFicha();
  }

  protected onLogout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private reloadAllServices(): void {
    this.pdvState.reload();
    this.catalog.reload();
    this.cart.reload();
    this.pricing.reload();
  }

  private applyTheme(theme: 'light' | 'dark' | 'green-light' | 'green-dark'): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
}
