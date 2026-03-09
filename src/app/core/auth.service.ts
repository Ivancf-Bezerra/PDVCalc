import { Injectable, signal, computed } from '@angular/core';

const LS_USERS_KEY = 'pricingApp.users';
const LS_ACTIVE_USER_KEY = 'pricingApp.activeUserId';

export const AVATAR_COLORS = [
  '#e8a0bf', '#a0c4e8', '#a0e8c4', '#e8d4a0', '#c4a0e8',
  '#e8a0a0', '#a0e8e8', '#d4e8a0', '#e8bca0', '#bca0e8',
] as const;

export interface AppUser {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(2, 8);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly usersSignal = signal<AppUser[]>(this.loadUsers());
  private readonly activeUserIdSignal = signal<string | null>(this.loadActiveUserId());

  readonly users = this.usersSignal.asReadonly();
  readonly activeUserId = this.activeUserIdSignal.asReadonly();

  readonly activeUser = computed<AppUser | null>(() => {
    const id = this.activeUserIdSignal();
    if (!id) return null;
    return this.usersSignal().find(u => u.id === id) ?? null;
  });

  readonly isLoggedIn = computed(() => this.activeUser() !== null);

  readonly storagePrefix = computed(() => {
    const user = this.activeUser();
    return user ? `u.${user.id}.` : 'guest.';
  });

  storageKey(base: string): string {
    return `${this.storagePrefix()}${base}`;
  }

  private loadUsers(): AppUser[] {
    try {
      const raw = localStorage.getItem(LS_USERS_KEY);
      if (!raw) return this.createDefaultUsers();
      const parsed = JSON.parse(raw) as AppUser[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : this.createDefaultUsers();
    } catch {
      return this.createDefaultUsers();
    }
  }

  private createDefaultUsers(): AppUser[] {
    const users: AppUser[] = [
      { id: uid(), name: 'Talita', avatarColor: AVATAR_COLORS[0], createdAt: new Date().toISOString() },
    ];
    this.persistUsers(users);
    return users;
  }

  private loadActiveUserId(): string | null {
    try {
      return localStorage.getItem(LS_ACTIVE_USER_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private persistUsers(users?: AppUser[]): void {
    try {
      localStorage.setItem(LS_USERS_KEY, JSON.stringify(users ?? this.usersSignal()));
    } catch { /* ignore */ }
  }

  private persistActiveUser(): void {
    try {
      const id = this.activeUserIdSignal();
      if (id) {
        localStorage.setItem(LS_ACTIVE_USER_KEY, id);
      } else {
        localStorage.removeItem(LS_ACTIVE_USER_KEY);
      }
    } catch { /* ignore */ }
  }

  login(userId: string): void {
    const exists = this.usersSignal().some(u => u.id === userId);
    if (!exists) return;
    this.activeUserIdSignal.set(userId);
    this.persistActiveUser();
  }

  logout(): void {
    this.activeUserIdSignal.set(null);
    this.persistActiveUser();
  }

  addUser(name: string, color?: string): AppUser {
    const trimmed = name.trim();
    const colorIndex = this.usersSignal().length % AVATAR_COLORS.length;
    const user: AppUser = {
      id: uid(),
      name: trimmed || 'Novo Usuário',
      avatarColor: color || AVATAR_COLORS[colorIndex],
      createdAt: new Date().toISOString(),
    };
    this.usersSignal.update(list => [...list, user]);
    this.persistUsers();
    return user;
  }

  removeUser(userId: string): void {
    if (this.activeUserIdSignal() === userId) {
      this.logout();
    }
    this.usersSignal.update(list => list.filter(u => u.id !== userId));
    this.persistUsers();
  }

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
}
