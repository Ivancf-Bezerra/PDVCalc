declare global {
  interface Window {
    HSStaticMethods?: {
      autoInit(collection?: string | string[]): void;
      getClassProperty(el: HTMLElement, prop: string, val?: string): string;
      afterTransition(el: HTMLElement, callback: Function): void;
      cleanCollection(name?: string | string[]): void;
    };
  }
}

export {};
