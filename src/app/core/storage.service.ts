import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly auth = inject(AuthService);

  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.auth.storageKey(key));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(this.auth.storageKey(key), JSON.stringify(value));
    } catch { /* ignore */ }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.auth.storageKey(key));
    } catch { /* ignore */ }
  }
}
