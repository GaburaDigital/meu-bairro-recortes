// Editor de recorte: mostra a imagem escaneada e deixa desenhar contornos (como uma tesoura)
// e marcar pivôs. Funciona com mouse; o desenho é feito clicando ponto a ponto.
//   - Roda do mouse: zoom.  - Botão direito ou do meio arrastando (ou Espaço + arrastar): mover a imagem.
//   - Desenhar: clique para pôr pontos; clique no primeiro ponto, dê duplo clique ou aperte Enter para fechar.
//   - Backspace desfaz o último ponto; Esc cancela o contorno que está sendo desenhado.
//   - Arraste os pontos ou o pivô para ajustar. Shift + clique num ponto apaga o ponto.
import type { Contorno, Ponto } from './tipos';
import { distancia } from './util';

export interface FormaVisivel {
  id: string;
  nome: string;
  cor: string;
  contorno: Contorno | null;
  pivo: Ponto | null;
  encaixe?: Ponto | null;
}

export interface FonteDoEditor {
  formas(): FormaVisivel[];
  selecionada(): string | null;
  selecionar(id: string): void;
  definirContorno(id: string, contorno: Contorno): void;
  definirPivo(id: string, pivo: Ponto): void;
  definirEncaixe?(id: string, ponto: Ponto): void;
  /** Chamado quando um contorno é fechado (para sugerir o pivô, por exemplo). */
  aoFecharContorno(id: string): void;
  aoMudar(): void;
}

export type ModoEditor = 'editar' | 'desenhar' | 'pivo' | 'encaixe';

const RAIO_PONTO = 7;

export class Editor {
  imagem: HTMLImageElement | null = null;
  modo: ModoEditor = 'editar';
  /** Filtro CSS para mostrar a imagem com o ajuste de cor. */
  filtro = 'none';
  private escala = 1;
  private origem: Ponto = [0, 0];
  private arrastando: { tipo: 'mover' | 'ponto' | 'pivo' | 'encaixe'; indice?: number; ultimo: Ponto } | null = null;
  private espacoApertado = false;
  private mouse: Ponto = [0, 0];
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement, private fonte: FonteDoEditor) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.desenhar()).observe(canvas);
    canvas.addEventListener('wheel', (e) => this.aoRodar(e), { passive: false });
    canvas.addEventListener('pointerdown', (e) => this.aoApertar(e));
    canvas.addEventListener('pointermove', (e) => this.aoMover(e));
    canvas.addEventListener('pointerup', () => { this.arrastando = null; });
    canvas.addEventListener('dblclick', () => this.fecharContorno());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.aoTeclar(e));
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.espacoApertado = false; });
  }

  definirImagem(img: HTMLImageElement | null): void {
    this.imagem = img;
    this.enquadrar();
  }

  definirModo(modo: ModoEditor): void {
    this.modo = modo;
    this.canvas.style.cursor = modo === 'editar' ? 'default' : 'crosshair';
    this.desenhar();
  }

  /** Ajusta o zoom para a imagem inteira caber na tela. */
  enquadrar(): void {
    const { width, height } = this.tamanho();
    if (!this.imagem) return this.desenhar();
    this.escala = Math.min(width / this.imagem.width, height / this.imagem.height) * 0.95;
    this.origem = [(width - this.imagem.width * this.escala) / 2, (height - this.imagem.height * this.escala) / 2];
    this.desenhar();
  }

  zoom(fator: number): void {
    const { width, height } = this.tamanho();
    this.zoomEm([width / 2, height / 2], fator);
  }

  private tamanho() {
    const r = this.canvas.getBoundingClientRect();
    return { width: Math.max(r.width, 1), height: Math.max(r.height, 1) };
  }

  private paraImagem(p: Ponto): Ponto {
    return [(p[0] - this.origem[0]) / this.escala, (p[1] - this.origem[1]) / this.escala];
  }

  private paraTela(p: Ponto): Ponto {
    return [p[0] * this.escala + this.origem[0], p[1] * this.escala + this.origem[1]];
  }

  private posicao(e: MouseEvent): Ponto {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private zoomEm(tela: Ponto, fator: number): void {
    const antes = this.paraImagem(tela);
    this.escala = Math.min(Math.max(this.escala * fator, 0.02), 20);
    this.origem = [tela[0] - antes[0] * this.escala, tela[1] - antes[1] * this.escala];
    this.desenhar();
  }

  private aoRodar(e: WheelEvent): void {
    e.preventDefault();
    this.zoomEm(this.posicao(e), e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }

  private formaSelecionada(): FormaVisivel | undefined {
    const id = this.fonte.selecionada();
    return this.fonte.formas().find((f) => f.id === id);
  }

  private aoApertar(e: PointerEvent): void {
    const tela = this.posicao(e);
    const ponto = this.paraImagem(tela);
    this.canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || this.espacoApertado) {
      this.arrastando = { tipo: 'mover', ultimo: tela };
      return;
    }
    const forma = this.formaSelecionada();
    if (!forma) return;
    if (this.modo === 'pivo' || this.modo === 'encaixe') {
      if (this.modo === 'pivo') this.fonte.definirPivo(forma.id, ponto);
      else this.fonte.definirEncaixe?.(forma.id, ponto);
      this.definirModo('editar');
      this.fonte.aoMudar();
      return;
    }
    if (this.modo === 'desenhar') {
      const c: Contorno = forma.contorno && !forma.contorno.fechado ? forma.contorno : { pontos: [], fechado: false };
      if (c.pontos.length >= 3 && distancia(this.paraTela(c.pontos[0]), tela) < RAIO_PONTO * 1.5) {
        this.fecharContorno();
        return;
      }
      c.pontos.push(ponto);
      this.fonte.definirContorno(forma.id, c);
      this.fonte.aoMudar();
      return;
    }
    // Modo editar: pivô, pontos ou seleção de outra forma.
    if (forma.pivo && distancia(this.paraTela(forma.pivo), tela) < RAIO_PONTO * 1.6) {
      this.arrastando = { tipo: 'pivo', ultimo: tela };
      return;
    }
    if (forma.encaixe && distancia(this.paraTela(forma.encaixe), tela) < RAIO_PONTO * 1.6) {
      this.arrastando = { tipo: 'encaixe', ultimo: tela };
      return;
    }
    if (forma.contorno) {
      const i = forma.contorno.pontos.findIndex((p) => distancia(this.paraTela(p), tela) < RAIO_PONTO * 1.4);
      if (i >= 0) {
        if (e.shiftKey && forma.contorno.pontos.length > 3) {
          forma.contorno.pontos.splice(i, 1);
          this.fonte.aoMudar();
          return;
        }
        this.arrastando = { tipo: 'ponto', indice: i, ultimo: tela };
        return;
      }
    }
    const clicada = [...this.fonte.formas()].reverse().find((f) => f.contorno?.fechado && dentro(ponto, f.contorno.pontos));
    if (clicada) {
      this.fonte.selecionar(clicada.id);
      this.fonte.aoMudar();
    }
  }

  private aoMover(e: PointerEvent): void {
    const tela = this.posicao(e);
    this.mouse = tela;
    const a = this.arrastando;
    if (!a) {
      if (this.modo !== 'editar') this.desenhar();
      return;
    }
    if (a.tipo === 'mover') {
      this.origem = [this.origem[0] + tela[0] - a.ultimo[0], this.origem[1] + tela[1] - a.ultimo[1]];
      a.ultimo = tela;
      this.desenhar();
      return;
    }
    const forma = this.formaSelecionada();
    if (!forma) return;
    const ponto = this.paraImagem(tela);
    if (a.tipo === 'pivo') this.fonte.definirPivo(forma.id, ponto);
    if (a.tipo === 'encaixe') this.fonte.definirEncaixe?.(forma.id, ponto);
    if (a.tipo === 'ponto' && forma.contorno && a.indice !== undefined) forma.contorno.pontos[a.indice] = ponto;
    this.fonte.aoMudar();
  }

  private aoTeclar(e: KeyboardEvent): void {
    const alvo = e.target as HTMLElement;
    if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
    if (e.code === 'Space') { this.espacoApertado = true; e.preventDefault(); return; }
    const forma = this.formaSelecionada();
    if (e.key === 'Enter') this.fecharContorno();
    if (e.key === 'Escape') {
      if (forma?.contorno && !forma.contorno.fechado) this.fonte.definirContorno(forma.id, { pontos: [], fechado: false });
      this.definirModo('editar');
      this.fonte.aoMudar();
    }
    if (e.key === 'Backspace' && forma?.contorno && !forma.contorno.fechado) {
      forma.contorno.pontos.pop();
      this.fonte.aoMudar();
      e.preventDefault();
    }
    if (e.key === '+' || e.key === '=') this.zoom(1.2);
    if (e.key === '-') this.zoom(1 / 1.2);
    if (e.key === '0') this.enquadrar();
  }

  fecharContorno(): void {
    const forma = this.formaSelecionada();
    if (!forma?.contorno || forma.contorno.fechado || forma.contorno.pontos.length < 3) return;
    forma.contorno.fechado = true;
    this.fonte.definirContorno(forma.id, forma.contorno);
    this.fonte.aoFecharContorno(forma.id);
    this.definirModo('editar');
    this.fonte.aoMudar();
  }

  desenhar(): void {
    const { width, height } = this.tamanho();
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, width, height);
    if (!this.imagem) {
      c.fillStyle = '#555';
      c.font = '18px "Atkinson Hyperlegible", sans-serif';
      c.textAlign = 'center';
      c.fillText('Abra a imagem escaneada para começar.', width / 2, height / 2);
      return;
    }
    c.imageSmoothingQuality = 'high';
    c.filter = this.filtro;
    c.drawImage(this.imagem, this.origem[0], this.origem[1], this.imagem.width * this.escala, this.imagem.height * this.escala);
    c.filter = 'none';
    const selecionada = this.fonte.selecionada();
    for (const f of this.fonte.formas()) this.desenharForma(f, f.id === selecionada);
  }

  private desenharForma(f: FormaVisivel, selecionada: boolean): void {
    const c = this.ctx;
    if (f.contorno && f.contorno.pontos.length > 0) {
      const pts = f.contorno.pontos.map((p) => this.paraTela(p));
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
      if (f.contorno.fechado) c.closePath();
      else if (selecionada && this.modo === 'desenhar') c.lineTo(this.mouse[0], this.mouse[1]);
      c.lineWidth = selecionada ? 3 : 2;
      c.strokeStyle = f.cor;
      c.setLineDash(f.contorno.fechado ? [] : [6, 4]);
      c.stroke();
      c.setLineDash([]);
      if (f.contorno.fechado) {
        c.globalAlpha = selecionada ? 0.22 : 0.12;
        c.fillStyle = f.cor;
        c.fill();
        c.globalAlpha = 1;
        const centro = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
        c.font = 'bold 13px "Atkinson Hyperlegible", sans-serif';
        c.textAlign = 'center';
        c.lineWidth = 4;
        c.strokeStyle = '#fff';
        c.strokeText(f.nome, centro[0], centro[1]);
        c.fillStyle = f.cor;
        c.fillText(f.nome, centro[0], centro[1]);
      }
      if (selecionada) {
        for (const [i, p] of pts.entries()) {
          c.beginPath();
          c.arc(p[0], p[1], i === 0 && !f.contorno.fechado ? RAIO_PONTO + 2 : RAIO_PONTO * 0.7, 0, Math.PI * 2);
          c.fillStyle = '#fff';
          c.fill();
          c.lineWidth = 2;
          c.strokeStyle = f.cor;
          c.stroke();
        }
      }
    }
    if (f.encaixe && selecionada) {
      const [x, y] = this.paraTela(f.encaixe);
      c.beginPath();
      c.moveTo(x, y - 10); c.lineTo(x + 10, y); c.lineTo(x, y + 10); c.lineTo(x - 10, y); c.closePath();
      c.fillStyle = '#ffffff';
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = f.cor;
      c.stroke();
      if (f.pivo) {
        const [px, py] = this.paraTela(f.pivo);
        c.setLineDash([4, 4]);
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke();
        c.setLineDash([]);
      }
    }
    if (f.pivo) {
      const [x, y] = this.paraTela(f.pivo);
      c.lineWidth = selecionada ? 3 : 2;
      c.strokeStyle = '#000';
      c.beginPath();
      c.arc(x, y, RAIO_PONTO * (selecionada ? 1.3 : 0.9), 0, Math.PI * 2);
      c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.moveTo(x, y - 12); c.lineTo(x, y + 12);
      c.stroke();
      c.fillStyle = '#ffd166';
      c.beginPath();
      c.arc(x, y, 4, 0, Math.PI * 2);
      c.fill();
    }
  }
}

/** O ponto está dentro do polígono? (regra do "raio que cruza as bordas") */
export function dentro(p: Ponto, poligono: Ponto[]): boolean {
  let resultado = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) resultado = !resultado;
  }
  return resultado;
}
