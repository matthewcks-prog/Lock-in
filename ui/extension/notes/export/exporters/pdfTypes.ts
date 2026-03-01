export interface JsPDFInstance {
  setFont(fontName: string, fontStyle: string): void;
  setFontSize(size: number): void;
  setTextColor(r: number, g: number, b: number): void;
  setFillColor(r: number, g: number, b: number): void;
  setDrawColor(r: number, g: number, b: number): void;
  setLineWidth(width: number): void;
  text(text: string, x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number, style?: string): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  addPage(): void;
  splitTextToSize(text: string, maxWidth: number): string[];
  getTextWidth(text: string): number;
  output(type: 'blob'): Blob;
}

export interface JsPDFConstructor {
  new (options: { orientation: string; unit: string; format: string }): JsPDFInstance;
}
