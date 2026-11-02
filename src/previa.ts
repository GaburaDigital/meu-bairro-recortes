// Prévia animada do boneco, com as MESMAS animações e a mesma ordem das peças do jogo.
// Na pose "Parado (arrumar peças)" dá para arrastar cada peça com o mouse para ajustar o encaixe.
import dadosAnimacoes from './animacoes.json';
import { filhos, type IdPeca } from './pecas';
import type { Ponto } from './tipos';
import type { PecaPronta } from './recorte';

interface Animacao { duracao: number; repetir: boolean; trilhas: Record<string, [number, number][]> }
const ANIMACOES = (dadosAnimacoes as unknown as { animacoes: Record<string, Animacao> }).animacoes;
const COM_BRACO_POR_CIMA = ['andar', 'pular', 'flutuar'];
export const NOMES_ANIMACOES: Record<string, string> = {
  parado: 'Parado (arrumar peças)',
  idle: 'Respirando',
  andar: 'Andando',
  pular: 'Pulando',
  flutuar: 'Flutuando (Tia)',
  interacao: 'Interagindo',
};
const ALTURA_NO_JOGO = 190;

export interface DadosPrevia {
  imagens: Record<IdPeca, PecaPronta>;
  encaixes: Record<IdPeca, Ponto>;
  alturaDaArte: number;
  afastarBracos: number;
  afastarPernas: number;
}

export class PreviaPersonagem {
  dados: DadosPrevia | null = null;
  animacao = 'idle';
  paraEsquerda = false;
  /** Chamado quando uma peça é arrastada: deslocamento em pixels da arte. */
  aoAjustar: (id: IdPeca, dx: number, dy: number) => void = () => {};
  private inicio = performance.now();
  private ctx: CanvasRenderingContext2D;
  private escalaTela = 1;
  private pes: Ponto = [0, 0];
  private caixas: { id: IdPeca; x: number; y: number; l: number; a: number }[] = [];
  private arrastando: { id: IdPeca; ultimo: Ponto } | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('pointerdown', (e) => this.aoApertar(e));
    canvas.addEventListener('pointermove', (e) => this.aoMover(e));
    canvas.addEventListener('pointerup', () => { this.arrastando = null; });
    const quadro = () => { this.desenhar(); requestAnimationFrame(quadro); };
    requestAnimationFrame(quadro);
  }

  tocar(nome: string): void {
    this.animacao = nome;
    this.inicio = performance.now();
    this.canvas.style.cursor = nome === 'parado' ? 'grab' : 'default';
  }

  private posicao(e: PointerEvent): Ponto {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private aoApertar(e: PointerEvent): void {
    if (this.animacao !== 'parado') return;
    const [x, y] = this.posicao(e);
    const peca = [...this.caixas].reverse().find((c) => x >= c.x && x <= c.x + c.l && y >= c.y && y <= c.y + c.a);
    if (!peca) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.arrastando = { id: peca.id, ultimo: [x, y] };
  }

  private aoMover(e: PointerEvent): void {
    if (!this.arrastando || !this.dados) return;
    const p = this.posicao(e);
    const porArte = this.escalaTela * (ALTURA_NO_JOGO / this.dados.alturaDaArte);
    const lado = this.paraEsquerda ? -1 : 1;
    const dx = ((p[0] - this.arrastando.ultimo[0]) / porArte) * lado;
    const dy = (p[1] - this.arrastando.ultimo[1]) / porArte;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      this.aoAjustar(this.arrastando.id, Math.round(dx), Math.round(dy));
      this.arrastando.ultimo = p;
    }
  }

  private desenhar(): void {
    const r = this.canvas.getBoundingClientRect();
    if (r.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(r.width * dpr) || this.canvas.height !== Math.round(r.height * dpr)) {
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
    }
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, r.width, r.height);
    this.escalaTela = (r.height * 0.78) / ALTURA_NO_JOGO;
    this.pes = [r.width / 2, r.height * 0.9];
    // chão
    c.strokeStyle = '#c9b98a';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(16, this.pes[1]); c.lineTo(r.width - 16, this.pes[1]); c.stroke();
    if (!this.dados) {
      c.fillStyle = '#555';
      c.font = '16px "Atkinson Hyperlegible", sans-serif';
      c.textAlign = 'center';
      c.fillText('Recorte as 11 peças para ver o boneco.', r.width / 2, r.height / 2);
      return;
    }
    const t = (performance.now() - this.inicio) / 1000;
    const anim = ANIMACOES[this.animacao];
    let tempo = 0;
    if (anim) tempo = anim.repetir ? t % anim.duracao : Math.min(t % (anim.duracao + 0.8), anim.duracao);
    const valor = (trilha: string): number => (anim ? amostrar(anim.trilhas[trilha], tempo, anim.duracao, anim.repetir) : 0);

    this.caixas = [];
    c.save();
    c.translate(this.pes[0], this.pes[1] + valor('balanco_y') * this.escalaTela);
    c.scale(this.paraEsquerda ? -1 : 1, 1);
    const escalaArte = this.escalaTela * (ALTURA_NO_JOGO / this.dados.alturaDaArte);
    c.scale(escalaArte, escalaArte);
    const bracoPorCima = COM_BRACO_POR_CIMA.includes(this.animacao);
    const d = this.dados;
    const desenharPeca = (id: IdPeca) => {
      const peca = d.imagens[id];
      const e = d.encaixes[id];
      const lado = id.endsWith('_esq') ? -1 : 1;
      let ax = 0;
      if (id.startsWith('braco_')) ax = lado * d.afastarBracos;
      if (id.startsWith('coxa_')) ax = lado * d.afastarPernas;
      c.save();
      c.translate(e[0] + ax, e[1]);
      c.rotate(valor(id));
      c.drawImage(peca.canvas, -peca.pivo[0], -peca.pivo[1]);
      if (this.animacao === 'parado') {
        const m = c.getTransform();
        const x = m.e / dpr - peca.pivo[0] * escalaArte * (this.paraEsquerda ? -1 : 1);
        const l = peca.canvas.width * escalaArte;
        this.caixas.push({ id, x: this.paraEsquerda ? x - l : x, y: m.f / dpr - peca.pivo[1] * escalaArte, l, a: peca.canvas.height * escalaArte });
      }
      for (const f of filhos(id, bracoPorCima)) desenharPeca(f);
      c.restore();
    };
    for (const f of filhos(null, bracoPorCima)) desenharPeca(f);
    c.restore();
  }
}

/** Valor da trilha no tempo t (interpolação suave, como a "cúbica" da Godot). */
function amostrar(chaves: [number, number][] | undefined, t: number, duracao: number, repetir: boolean): number {
  if (!chaves || chaves.length === 0) return 0;
  if (chaves.length === 1) return chaves[0][1];
  const n = chaves.length;
  let i = n - 1;
  for (let k = 0; k < n - 1; k++) if (t < chaves[k + 1][0]) { i = k; break; }
  const pega = (k: number): number => {
    if (repetir) return chaves[((k % n) + n) % n][1];
    return chaves[Math.min(Math.max(k, 0), n - 1)][1];
  };
  const t0 = chaves[i][0];
  const t1 = i + 1 < n ? chaves[i + 1][0] : (repetir ? duracao + chaves[0][0] : t0);
  if (t1 <= t0) return chaves[i][1];
  const u = (t - t0) / (t1 - t0);
  const p0 = pega(i - 1), p1 = pega(i), p2 = pega(i + 1), p3 = pega(i + 2);
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
