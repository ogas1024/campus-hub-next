declare module "@toast-ui/editor" {
  export type EditorOptions = Record<string, unknown>;

  export default class Editor {
    constructor(options: EditorOptions);
    on(eventName: string, handler: () => void): void;
    getMarkdown(): string;
    setMarkdown(markdown: string, cursorToEnd?: boolean): void;
    destroy(): void;
  }
}

