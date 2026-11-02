// A "tesoura": recorta cada contorno da imagem escaneada e calcula pivôs e encaixes
// no mesmo formato que o jogo lê (personagem.json e cenario.json).
import type { Contorno, ElementoCenario, Ponto, ProjetoCenario, ProjetoPersonagem } from './tipos';
import { PECAS, PECA_POR_ID, type IdPeca } from './pecas';
import { caixaDe } from './util';

const MARGEM = 2; // pixels de folga em volta de cada peça exportada

export interface PecaPronta {
  canvas: HTMLCanvasElement;
  /** Pivô dentro da imagem exportada (pixels da arte). */
  pivo: Ponto;
}

/** Recorta o contorno, já na escala final, com fundo transparente fora do contorno. */
export function recortar(img: CanvasImageSource, contorno: Contorno, escala: number, limparPapel: number, pivoScan: Ponto | null) : PecaPronta {
  const caixa = caixaDe(contorno.pontos);
  const largura = Math.max(1, Math.ceil(caixa.largura * escala) + MARGEM * 2);
  const altura = Math.max(1, Math.ceil(caixa.altura * escala) + MARGEM * 2);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const c = canvas.getContext('2d', { willReadFrequently: limparPapel > 0 })!;
  const paraSaida = (p: Ponto): Ponto => [(p[0] - caixa.x) * escala + MARGEM, (p[1] - caixa.y) * escala + MARGEM];
  c.beginPath();
  contorno.pontos.forEach((p, i) => {
    const [x, y] = paraSaida(p);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  });
  c.closePath();
  c.save();
  c.clip();
  c.imageSmoothingQuality = 'high';
  c.setTransform(escala, 0, 0, escala, (-caixa.x) * escala + MARGEM, (-caixa.y) * escala + MARGEM);
  c.drawImage(img, 0, 0);
  c.restore();
  if (limparPapel > 0) tirarBrancoDoPapel(c, largura, altura, limparPapel);
  return { canvas, pivo: pivoScan ? paraSaida(pivoScan) : [largura / 2, altura / 2] };
}

/** Deixa transparente o branco/cinza claro do papel (não mexe nas cores do desenho). */
function tirarBrancoDoPapel(c: CanvasRenderingContext2D, largura: number, altura: number, forca: number): void {
  const dados = c.getImageData(0, 0, largura, altura);
  const px = dados.data;
  const limite = 255 - forca * 2; // força 1..60 -> limite 253..135
  const suave = 18;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const claro = Math.min(r, g, b);
    const cor = Math.max(r, g, b) - claro;
    if (cor > 40) continue; // é cor do desenho
    if (claro >= limite) px[i + 3] = 0;
    else if (claro >= limite - suave) px[i + 3] = Math.round(px[i + 3] * (limite - claro) / suave);
  }
  c.putImageData(dados, 0, 0);
}

// ---------- Personagem ----------

export interface MontagemPersonagem {
  /** Pixels da arte por pixel do escaneado. */
  escala: number;
  /** Encaixe de cada peça (pixels da arte), igual ao personagem.json. */
  encaixes: Record<IdPeca, Ponto>;
  faltando: IdPeca[];
}

/** Peças que já têm contorno fechado e pivô. */
export function pecaPronta(projeto: ProjetoPersonagem, id: IdPeca): boolean {
  const p = projeto.pecas[id];
  return !!p.contorno?.fechado && !!p.pivo;
}

/**
 * Monta o boneco "em pé" (sem animação) para descobrir a altura total e o encaixe de cada peça.
 * Boneco desenhado inteiro: cada peça fica onde foi desenhada.
 * Peças desenhadas separadas: o "encaixe" marcado no desenho do pai diz onde a peça se prende.
 */
export function montarPersonagem(projeto: ProjetoPersonagem): MontagemPersonagem {
  const faltando = PECAS.filter((p) => !pecaPronta(projeto, p.id)).map((p) => p.id);
  const encaixes = Object.fromEntries(PECAS.map((p) => [p.id, [0, 0]])) as Record<IdPeca, Ponto>;
  if (faltando.length > 0) return { escala: 1, encaixes, faltando };

  // Posição de cada pivô no boneco montado, em pixels do escaneado.
  const mundo = {} as Record<IdPeca, Ponto>;
  const posicao = (id: IdPeca): Ponto => {
    if (mundo[id]) return mundo[id];
    const def = PECA_POR_ID[id];
    const peca = projeto.pecas[id];
    if (!def.pai) return (mundo[id] = peca.pivo!);
    const pai = projeto.pecas[def.pai];
    const noPai = peca.encaixe ?? peca.pivo!;
    const p = posicao(def.pai);
    return (mundo[id] = [p[0] + noPai[0] - pai.pivo![0], p[1] + noPai[1] - pai.pivo![1]]);
  };
  let topo = Infinity, pes = -Infinity;
  for (const def of PECAS) {
    const peca = projeto.pecas[def.id];
    const m = posicao(def.id);
    for (const q of peca.contorno!.pontos) {
      const y = m[1] + q[1] - peca.pivo![1];
      topo = Math.min(topo, y);
      pes = Math.max(pes, y);
    }
  }
  const escala = projeto.alturaDaArte / Math.max(pes - topo, 1);
  for (const def of PECAS) {
    const peca = projeto.pecas[def.id];
    const m = posicao(def.id);
    let e: Ponto;
    if (!def.pai) e = [0, (m[1] - pes) * escala]; // a base se prende aos pés (origem do boneco)
    else {
      const p = posicao(def.pai);
      e = [(m[0] - p[0]) * escala, (m[1] - p[1]) * escala];
    }
    encaixes[def.id] = [Math.round(e[0] + peca.ajuste[0]), Math.round(e[1] + peca.ajuste[1])];
  }
  return { escala, encaixes, faltando };
}

export interface PersonagemExportado {
  json: Record<string, unknown>;
  imagens: Record<IdPeca, PecaPronta>;
}

export function exportarPersonagem(img: CanvasImageSource, projeto: ProjetoPersonagem, audio: string | null): PersonagemExportado {
  const m = montarPersonagem(projeto);
  if (m.faltando.length > 0) throw new Error('Faltam peças: ' + m.faltando.map((id) => PECA_POR_ID[id].nome).join(', ') + '.');
  const imagens = {} as Record<IdPeca, PecaPronta>;
  const pecas: Record<string, unknown> = {};
  for (const def of PECAS) {
    const p = projeto.pecas[def.id];
    const pronta = recortar(img, p.contorno!, m.escala, projeto.limparPapel, p.pivo);
    imagens[def.id] = pronta;
    pecas[def.id] = {
      arquivo: def.id + '.png',
      pivo: [Math.round(pronta.pivo[0]), Math.round(pronta.pivo[1])],
      encaixe: m.encaixes[def.id],
    };
  }
  const json: Record<string, unknown> = {
    versao_formato: 1,
    id: projeto.id,
    nome: projeto.nome,
    autoria: projeto.autoria,
    provisorio: false,
    altura_da_arte: projeto.alturaDaArte,
    afastar_bracos: projeto.afastarBracos,
    afastar_pernas: projeto.afastarPernas,
    pecas,
    apresentacao: { audio: audio ?? '', texto: projeto.apresentacao, trechos: [] },
  };
  return { json, imagens };
}

// ---------- Cenário ----------

export function escalaDaFolha(projeto: ProjetoCenario, alturaImagem: number): number {
  return projeto.alturaDaFolha / Math.max(alturaImagem, 1);
}

/** Posição do elemento no jogo: meio de baixo do desenho, em pixels do jogo (a partir do canto de cima da folha). */
export function posicaoDoElemento(e: ElementoCenario, escalaFolha: number): Ponto {
  const caixa = caixaDe(e.contorno.pontos);
  return [
    Math.round((caixa.x + caixa.largura / 2) * escalaFolha + e.deslocamento[0]),
    Math.round((caixa.y + caixa.altura) * escalaFolha + e.deslocamento[1] + MARGEM), // a folga de baixo fica abaixo do chão
  ];
}

export interface CenarioExportado {
  json: Record<string, unknown>;
  imagens: Record<string, HTMLCanvasElement>;
}

export function exportarCenario(img: HTMLImageElement, projeto: ProjetoCenario, audio: string | null): CenarioExportado {
  const elementos = projeto.elementos.filter((e) => e.contorno.fechado);
  if (elementos.length === 0 && !projeto.exportarFundo) throw new Error('Recorte pelo menos um elemento (ou marque "exportar a folha inteira").');
  const ids = new Set<string>();
  for (const e of elementos) {
    if (!e.id) throw new Error('Todo elemento precisa de um nome.');
    if (ids.has(e.id)) throw new Error('Dois elementos com o mesmo nome: ' + e.id);
    ids.add(e.id);
  }
  const escalaFolha = escalaDaFolha(projeto, img.height);
  const imagens: Record<string, HTMLCanvasElement> = {};
  const lista = elementos.map((e) => {
    imagens[e.id + '.png'] = recortar(img, e.contorno, escalaFolha * e.escala, projeto.limparPapel, null).canvas;
    return { id: e.id, arquivo: e.id + '.png', posicao: posicaoDoElemento(e, escalaFolha), camada: e.camada, espelhar: e.espelhar };
  });
  let fundo = '';
  if (projeto.exportarFundo) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * escalaFolha);
    canvas.height = Math.round(img.height * escalaFolha);
    const c = canvas.getContext('2d')!;
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, canvas.width, canvas.height);
    imagens['fundo.png'] = canvas;
    fundo = 'fundo.png';
  }
  const json = {
    versao_formato: 1,
    id: projeto.id,
    nome: projeto.nome,
    autoria: projeto.autoria,
    tamanho_da_folha: [Math.round(img.width * escalaFolha), Math.round(img.height * escalaFolha)],
    fundo,
    elementos: lista,
    audiodescricao: { audio: audio ?? '', texto: projeto.audiodescricao, trechos: [] },
  };
  return { json, imagens };
}

export function paraBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'));
}
