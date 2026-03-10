import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';

@Injectable({ providedIn: 'root' })
export class PrintService {
  printHtmlInNewWindow(content: string, options?: { title?: string; preStyles?: string }): void {
    const w = window.open('', '_blank');
    if (!w) return;

    const title = options?.title ?? 'Impressão';
    const preStyles =
      options?.preStyles ??
      'font-family:monospace;padding:16px;font-size:14px;white-space:pre-wrap;line-height:1.4;';

    w.document.write(
      `<!DOCTYPE html><html><head><title>${this.escapeHtml(title)}</title></head><body>` +
        `<pre style="${preStyles}">` +
        this.escapeHtml(content) +
        '</pre></body></html>',
    );
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  printWithBodyClass(container: HTMLElement, options: { bodyClass: string }): void {
    const { bodyClass } = options;
    document.body.classList.add(bodyClass);
    const removeClass = (): void => {
      document.body.classList.remove(bodyClass);
      window.removeEventListener('afterprint', removeClass);
    };
    window.addEventListener('afterprint', removeClass);
    setTimeout(() => window.print(), 150);
  }

  savePdf(docTitle: string, build: (doc: jsPDF) => void): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    build(doc);
    doc.save(`${docTitle.replace(/\s+/g, '_').toLowerCase()}.pdf`);
  }

  private escapeHtml(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}

