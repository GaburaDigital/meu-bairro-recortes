// Montagem do cenário: mostra os elementos recortados no tamanho do jogo e deixa arrastar cada um.
import type { ElementoCenario, Ponto } from './tipos';
import { caixaDe } from './util';
import { posicaoDoElemento } from './recorte';

const TELA_JOGO: Ponto = [1280, 720];
const ALTURA_BONECO = 190;

export interface FonteMontagem {
  imagem(): HTMLImageElement | null;
  elementos(): ElementoCenario[];
  escalaFolha(): number;
  selecionado(): string | null;
  selecionar(id: string): void;
  mover(id: string, dx: number, dy: number): void;
  /** Recorte já pronto de cada elemento (na escala do jogo). */
  recorte(e: ElementoCenario): HTMLCanvasElement | null;
}

export class Montagem {
  private ctx: CanvasRenderingContext2D;
  private escalaTela = 1;
  private origem: Ponto = [0, 0];
  private caixas: { id: string; x: number; y: number; l: number; a: number }[] = [];
  private arrastando: { id: string; ultimo: Ponto } | null = null;

  constructor(private canvas: HTMLCanvasElement, private fonte: FonteMontagem) {
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('pointerdown', (e) => this.aoApertar(e));
    canvas.addEventListener('pointermove', (e) => this.aoMover(e));
    canvas.addEventListener('pointerup', () => { this.arrastando = null; });
    new ResizeObserver(() => this.desenhar()).observe(canvas);
  }

  private posicao(e: PointerEvent): Ponto {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private aoApertar(e: PointerEvent): void {
    const [x, y] = this.posicao(e);
    const alvo = [...this.caixas].reverse().find((c) => x >= c.x && x <= c.x + c.l && y >= c.y && y <= c.y + c.a);
    if (!alvo) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.fonte.selecionar(alvo.id);
    this.arrastando = { id: alvo.id, ultimo: [x, y] };
  }

  private aoMover(e: PointerEvent): void {
    if (!this.arrastando) return;
    const p = this.posicao(e);
    const dx = (p[0] - this.arrastando.ultimo[0]) / this.escalaTela;
    const dy = (p[1] - this.arrastando.ultimo[1]) / this.escalaTela;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      this.fonte.mover(this.arrastando.id, Math.round(dx), Math.round(dy));
      this.arrastando.ultimo = p;
    }
  }

  desenhar(): void {
    const r = this.canvas.getBoundingClientRect();
    if (r.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, r.width, r.height);
    const img = this.fonte.imagem();
    this.caixas = [];
    if (!img) return;
    const ef = this.fonte.escalaFolha();
    const folha: Ponto = [img.width * ef, img.height * ef];
    const largura = Math.max(folha[0], TELA_JOGO[0]);
    const altura = Math.max(folha[1], TELA_JOGO[1]);
    this.escalaTela = Math.min((r.width - 20) / largura, (r.height - 20) / altura);
    this.origem = [(r.width - folha[0] * this.escalaTela) / 2, (r.height - altura * this.escalaTela) / 2 + (altura - folha[1]) * this.escalaTela];
    const paraTela = (p: Ponto): Ponto => [this.origem[0] + p[0] * this.escalaTela, this.origem[1] + p[1] * this.escalaTela];

    // Folha (bem clarinha, só para referência)
    const [fx, fy] = paraTela([0, 0]);
    c.globalAlpha = 0.18;
    c.drawImage(img, fx, fy, folha[0] * this.escalaTela, folha[1] * this.escalaTela);
    c.globalAlpha = 1;
    // Tela do jogo (encostada no chão da folha)
    const [tx, ty] = paraTela([(folha[0] - TELA_JOGO[0]) / 2, folha[1] - TELA_JOGO[1]]);
    c.setLineDash([6, 5]);
    c.strokeStyle = '#1f5fc4';
    c.lineWidth = 1.5;
    c.strokeRect(tx, ty, TELA_JOGO[0] * this.escalaTela, TELA_JOGO[1] * this.escalaTela);
    c.setLineDash([]);

    const ordem = { fundo: 0, meio: 1, frente: 3 } as const;
    const lista = [...this.fonte.elementos()].filter((e) => e.contorno.fechado);
    const desenharLista = (filtro: (e: ElementoCenario) => boolean) => {
      for (const e of lista.filter(filtro).sort((a, b) => ordem[a.camada] - ordem[b.camada])) {
        const recorte = this.fonte.recorte(e);
        if (!recorte) continue;
        const pos = posicaoDoElemento(e, ef);
        const l = recorte.width * this.escalaTela;
        const a = recorte.height * this.escalaTela;
        const [px, py] = paraTela(pos);
        const x = px - l / 2;
        const y = py - a;
        c.save();
        if (e.espelhar) { c.translate(px, 0); c.scale(-1, 1); c.translate(-px, 0); }
        c.drawImage(recorte, x, y, l, a);
        c.restore();
        if (e.id === this.fonte.selecionado()) {
          c.strokeStyle = '#ffb000';
          c.lineWidth = 2;
          c.strokeRect(x, y, l, a);
        }
        this.caixas.push({ id: e.id, x, y, l, a });
      }
    };
    desenharLista((e) => e.camada !== 'frente');
    // Boneco de referência (no meio da tela do jogo, no chão)
    const [bx, by] = paraTela([folha[0] / 2, folha[1]]);
    const h = ALTURA_BONECO * this.escalaTela;
    c.fillStyle = '#8a8a8acc';
    c.beginPath();
    c.arc(bx, by - h * 0.86, h * 0.14, 0, Math.PI * 2);
    c.fill();
    c.fillRect(bx - h * 0.12, by - h * 0.72, h * 0.24, h * 0.36);
    c.fillRect(bx - h * 0.1, by - h * 0.36, h * 0.08, h * 0.36);
    c.fillRect(bx + h * 0.02, by - h * 0.36, h * 0.08, h * 0.36);
    desenharLista((e) => e.camada === 'frente');
  }
}

/** Caixa do elemento na folha (para mensagens e testes). */
export function tamanhoNoJogo(e: ElementoCenario, escalaFolha: number): Ponto {
  const caixa = caixaDe(e.contorno.pontos);
  return [Math.round(caixa.largura * escalaFolha * e.escala), Math.round(caixa.altura * escalaFolha * e.escala)];
}
