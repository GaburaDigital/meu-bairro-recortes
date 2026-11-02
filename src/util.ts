// Funções pequenas usadas em várias partes da ferramenta.
import type { Ponto } from './tipos';

/** "Maria Clara" -> "maria_clara" (sem acento, minúsculas, sem espaço), como pedem os padrões do projeto. */
export function paraId(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ç/gi, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export interface Caixa { x: number; y: number; largura: number; altura: number }

export function caixaDe(pontos: Ponto[]): Caixa {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pontos) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 };
}

export function distancia(a: Ponto, b: Ponto): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Lê um arquivo como "data URL" (texto que guarda a imagem inteira). */
export function lerComoDataUrl(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

export function carregarImagem(endereco: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
    img.src = endereco;
  });
}

export function baixar(blob: Blob, nome: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, atributos: Record<string, string> = {}, ...filhos: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, v);
  for (const f of filhos) e.append(f);
  return e;
}
