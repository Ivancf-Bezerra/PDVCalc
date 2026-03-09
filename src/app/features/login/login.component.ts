import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService, type AppUser, AVATAR_COLORS } from '../../core/auth.service';

interface SelectorItem {
  type: 'user' | 'add';
  user?: AppUser;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly Math = Math;
  protected readonly users = this.auth.users;
  protected readonly avatarColors = AVATAR_COLORS;
  protected readonly showNewUserForm = signal(false);
  protected readonly newUserName = signal('');
  protected readonly newUserColor = signal(AVATAR_COLORS[0]);
  protected readonly focusedIndex = signal(0);

  protected readonly selectorItems = computed<SelectorItem[]>(() => {
    const items: SelectorItem[] = this.users().map(u => ({ type: 'user' as const, user: u }));
    items.push({ type: 'add' });
    return items;
  });

  protected readonly previewInitials = computed(() => {
    const name = this.newUserName().trim();
    return name ? this.auth.getInitials(name) : '?';
  });

  protected getInitials(name: string): string {
    return this.auth.getInitials(name);
  }

  protected getOffset(index: number): number {
    return index - this.focusedIndex();
  }

  protected focusItem(index: number): void {
    this.focusedIndex.set(index);
  }

  protected confirmFocused(): void {
    const items = this.selectorItems();
    const item = items[this.focusedIndex()];
    if (!item) return;
    if (item.type === 'user' && item.user) {
      this.auth.login(item.user.id);
      this.router.navigate(['/pdv']);
    } else if (item.type === 'add') {
      this.openNewUserForm();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.showNewUserForm()) return;
    const items = this.selectorItems();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusedIndex.update(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusedIndex.update(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.confirmFocused();
    }
  }

  protected selectColor(color: string): void {
    this.newUserColor.set(color);
  }

  protected openNewUserForm(): void {
    this.newUserName.set('');
    const nextIdx = this.users().length % AVATAR_COLORS.length;
    this.newUserColor.set(AVATAR_COLORS[nextIdx]);
    this.showNewUserForm.set(true);
  }

  protected cancelNewUser(): void {
    this.showNewUserForm.set(false);
    this.newUserName.set('');
  }

  protected confirmNewUser(): void {
    const name = this.newUserName().trim();
    if (!name) return;
    const color = this.newUserColor();
    const user = this.auth.addUser(name, color);
    this.showNewUserForm.set(false);
    this.newUserName.set('');
    this.auth.login(user.id);
    this.router.navigate(['/pdv']);
  }
}
