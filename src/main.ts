// Ferramenta de recorte do Meu Bairro Vira Game.
// Liga a página (index.html) ao editor, à prévia do boneco, à montagem do cenário e à exportação.
import './estilo.css';
import JSZip from 'jszip';
import { Editor, type FonteDoEditor, type FormaVisivel } from './editor';
import { PreviaPersonagem, NOMES_ANIMACOES } from './previa';
import { Montagem } from './montagem';
import { PECAS, PECA_POR_ID, type IdPeca } from './pecas';
import { exportarCenario, exportarPersonagem, montarPersonagem, paraBlob, pecaPronta, recortar, escalaDaFolha, filtroCss } from './recorte';
import { guardar, recuperar } from './guardar';
import { lerZipDoEstudio, ouvir, pararSom, vozDaGravacao, wavParaJogo, type GravacaoImportada } from './gravacao';
import { COR_PADRAO } from './tipos';
import type { ArquivoProjeto, Contorno, ElementoCenario, Modo, Ponto, ProjetoCenario, ProjetoPersonagem, TipoPersonagem } from './tipos';
import { baixar, caixaDe, carregarImagem, el, lerComoDataUrl, paraId } from './util';

// ---------- Estado ----------

interface Midia {
  imagem: HTMLImageElement | null; imagemUrl: string | null;
  audio: { nome: string; dados: string } | null;
  /** Gravação do Estúdio Meu Bairro (tem prioridade sobre o arquivo de áudio solto). */
  gravacao: GravacaoImportada | null;
  /** Quando o ZIP da criança tem vários desenhos, ficam aqui para escolher. */
  opcoes: GravacaoImportada[];
}

function novoPersonagem(): ProjetoPersonagem {
  const pecas = Object.fromEntries(PECAS.map((p) => [p.id, { contorno: null, pivo: null, encaixe: null, ajuste: [0, 0] }]));
  return {
    tipo: 'personagem', nome: '', id: '', autoria: '', apresentacao: '',
    alturaDaArte: 460, afastarBracos: 0, afastarPernas: 0, limparPapel: 0, cor: { ...COR_PADRAO },
    pecas: pecas as ProjetoPersonagem['pecas'],
  };
}

function novoCenario(): ProjetoCenario {
  return { nome: '', id: '', autoria: '', audiodescricao: '', alturaDaFolha: 720, exportarFundo: false, limparPapel: 0, cor: { ...COR_PADRAO }, elementos: [] };
}

const estado = {
  modo: 'personagem' as Modo,
  personagem: novoPersonagem(),
  cenario: novoCenario(),
  midia: {
    personagem: { imagem: null, imagemUrl: null, audio: null, gravacao: null, opcoes: [] } as Midia,
    cenario: { imagem: null, imagemUrl: null, audio: null, gravacao: null, opcoes: [] } as Midia,
  },
  peca: 'cabeca' as IdPeca,
  elemento: null as string | null,
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const midiaAtual = () => estado.midia[estado.modo];

// ---------- Avisos ----------

let tempoAviso = 0;
function avisar(texto: string, erro = false): void {
  const a = $('aviso');
  a.textContent = texto;
  a.classList.toggle('erro', erro);
  a.hidden = false;
  clearTimeout(tempoAviso);
  tempoAviso = window.setTimeout(() => { a.hidden = true; }, erro ? 7000 : 3500);
}

// ---------- Editor (a imagem escaneada) ----------

const fonteEditor: FonteDoEditor = {
  formas(): FormaVisivel[] {
    if (estado.modo === 'personagem') {
      return PECAS.map((d) => {
        const p = estado.personagem.pecas[d.id];
        return { id: d.id, nome: d.nome, cor: d.cor, contorno: p.contorno, pivo: p.pivo, encaixe: p.encaixe };
      });
    }
    return estado.cenario.elementos.map((e, i) => ({
      id: e.chave, nome: e.id || `elemento ${i + 1}`, cor: CORES_CENARIO[i % CORES_CENARIO.length], contorno: e.contorno, pivo: null,
    }));
  },
  selecionada: () => (estado.modo === 'personagem' ? estado.peca : estado.elemento),
  selecionar(id) {
    if (estado.modo === 'personagem') estado.peca = id as IdPeca;
    else estado.elemento = id;
    atualizarTudo();
  },
  definirContorno(id, contorno) {
    if (estado.modo === 'personagem') estado.personagem.pecas[id as IdPeca].contorno = contorno;
    else { const e = elementoPorChave(id); if (e) e.contorno = contorno; }
  },
  definirPivo(id, pivo) {
    if (estado.modo === 'personagem') estado.personagem.pecas[id as IdPeca].pivo = pivo;
  },
  definirEncaixe(id, ponto) {
    if (estado.modo === 'personagem' && PECA_POR_ID[id as IdPeca].pai) estado.personagem.pecas[id as IdPeca].encaixe = ponto;
  },
  aoFecharContorno(id) {
    if (estado.modo !== 'personagem') return;
    const p = estado.personagem.pecas[id as IdPeca];
    if (!p.pivo && p.contorno) {
      const c = caixaDe(p.contorno.pontos);
      const f = PECA_POR_ID[id as IdPeca].pivoSugerido;
      p.pivo = [c.x + c.largura * f[0], c.y + c.altura * f[1]];
    }
    // Vai sozinho para a próxima peça sem contorno, para agilizar.
    const proxima = PECAS.find((d) => !estado.personagem.pecas[d.id].contorno?.fechado);
    if (proxima) avisar(`${PECA_POR_ID[id as IdPeca].nome} pronta. Confira o pivô. Próxima: ${proxima.nome}.`);
  },
  aoMudar: () => atualizarTudo(),
};

const CORES_CENARIO = ['#e8590c', '#1f5fc4', '#2b8a3e', '#c2255c', '#7048e8', '#1098ad', '#f08c00', '#5c940d'];
const editor = new Editor($('tela-editor'), fonteEditor);

function elementoPorChave(chave: string | null): ElementoCenario | undefined {
  return estado.cenario.elementos.find((e) => e.chave === chave);
}

// ---------- Prévia do boneco ----------

const previa = new PreviaPersonagem($('tela-previa'));
const seletorAnimacao = $<HTMLSelectElement>('p-animacao');
for (const [id, nome] of Object.entries(NOMES_ANIMACOES)) seletorAnimacao.append(el('option', { value: id }, nome));
seletorAnimacao.value = 'parado';
previa.tocar('parado');
seletorAnimacao.addEventListener('change', () => previa.tocar(seletorAnimacao.value));
$('p-virar').addEventListener('click', () => { previa.paraEsquerda = !previa.paraEsquerda; });
previa.aoAjustar = (id, dx, dy) => {
  const a = estado.personagem.pecas[id].ajuste;
  a[0] += dx; a[1] += dy;
  estado.peca = id;
  atualizarEncaixes();
  atualizarTudo(false);
};

let tempoPrevia = 0;
function atualizarPreviaDepois(): void {
  clearTimeout(tempoPrevia);
  tempoPrevia = window.setTimeout(atualizarPrevia, 150);
}

function atualizarPrevia(): void {
  const img = estado.midia.personagem.imagem;
  const p = estado.personagem;
  const m = montarPersonagem(p);
  if (!img || m.faltando.length > 0) { previa.dados = null; return; }
  const imagens = Object.fromEntries(PECAS.map((d) => {
    const peca = p.pecas[d.id];
    return [d.id, recortar(img, peca.contorno!, m.escala, p.limparPapel, peca.pivo, p.cor)];
  }));
  previa.dados = {
    imagens: imagens as never, encaixes: m.encaixes, alturaDaArte: p.alturaDaArte,
    afastarBracos: p.afastarBracos, afastarPernas: p.afastarPernas,
  };
}

function atualizarEncaixes(): void {
  if (!previa.dados) return;
  const p = estado.personagem;
  previa.dados.encaixes = montarPersonagem(p).encaixes;
  previa.dados.afastarBracos = p.afastarBracos;
  previa.dados.afastarPernas = p.afastarPernas;
}

// ---------- Montagem do cenário ----------

const cacheRecortes = new Map<string, { assinatura: string; canvas: HTMLCanvasElement }>();
const montagem = new Montagem($('tela-montagem'), {
  imagem: () => estado.midia.cenario.imagem,
  elementos: () => estado.cenario.elementos,
  escalaFolha: () => escalaDaFolha(estado.cenario, estado.midia.cenario.imagem?.height ?? 1),
  selecionado: () => estado.elemento,
  selecionar: (chave) => { estado.elemento = chave; atualizarTudo(false); },
  mover: (chave, dx, dy) => {
    const e = elementoPorChave(chave);
    if (!e) return;
    e.deslocamento = [e.deslocamento[0] + dx, e.deslocamento[1] + dy];
    atualizarTudo(false);
  },
  recorte: (e) => {
    const img = estado.midia.cenario.imagem;
    if (!img) return null;
    const escala = escalaDaFolha(estado.cenario, img.height) * e.escala;
    const assinatura = JSON.stringify([e.contorno.pontos, escala, estado.cenario.limparPapel, estado.cenario.cor]);
    const guardado = cacheRecortes.get(e.chave);
    if (guardado?.assinatura === assinatura) return guardado.canvas;
    const canvas = recortar(img, e.contorno, escala, estado.cenario.limparPapel, null, estado.cenario.cor).canvas;
    cacheRecortes.set(e.chave, { assinatura, canvas });
    return canvas;
  },
});

// ---------- Formulários ----------

function ligarTexto(id: string, ler: () => string, gravar: (v: string) => void): void {
  const campo = $<HTMLInputElement>(id);
  campo.addEventListener('input', () => { gravar(campo.value); atualizarTudo(false); });
  campos.push(() => { if (document.activeElement !== campo) campo.value = ler(); });
}
function ligarNumero(id: string, ler: () => number, gravar: (v: number) => void, saida?: string, formato = (v: number) => String(v)): void {
  const campo = $<HTMLInputElement>(id);
  campo.addEventListener('input', () => {
    const v = Number(campo.value);
    if (Number.isFinite(v)) { gravar(v); atualizarTudo(false); }
  });
  campos.push(() => {
    if (document.activeElement !== campo) campo.value = String(ler());
    if (saida) $(saida).textContent = formato(ler());
  });
}
const campos: (() => void)[] = [];

// Personagem
const P = () => estado.personagem;
let idManualP = false;
$<HTMLSelectElement>('p-tipo').addEventListener('change', (e) => {
  P().tipo = (e.target as HTMLSelectElement).value as TipoPersonagem;
  if (P().tipo === 'tia') { P().id = 'tia'; if (!P().nome) P().nome = 'Tia'; }
  atualizarTudo(false);
});
campos.push(() => { $<HTMLSelectElement>('p-tipo').value = P().tipo; });
ligarTexto('p-nome', () => P().nome, (v) => { P().nome = v; if (!idManualP && P().tipo !== 'tia') P().id = paraId(v); });
ligarTexto('p-id', () => P().id, (v) => { P().id = paraId(v); idManualP = v !== ''; });
ligarTexto('p-autoria', () => P().autoria, (v) => { P().autoria = v; });
ligarTexto('p-apresentacao', () => P().apresentacao, (v) => { P().apresentacao = v; });
ligarNumero('p-bracos', () => P().afastarBracos, (v) => { P().afastarBracos = v; atualizarEncaixes(); }, 'p-bracos-valor');
ligarNumero('p-pernas', () => P().afastarPernas, (v) => { P().afastarPernas = v; atualizarEncaixes(); }, 'p-pernas-valor');
ligarNumero('p-papel', () => P().limparPapel, (v) => { P().limparPapel = v; atualizarPreviaDepois(); }, 'p-papel-valor', (v) => (v === 0 ? 'desligado' : String(v)));
ligarNumero('p-altura', () => P().alturaDaArte, (v) => { if (v >= 100) { P().alturaDaArte = v; atualizarPreviaDepois(); } });
ligarNumero('p-ajuste-x', () => P().pecas[estado.peca].ajuste[0], (v) => { P().pecas[estado.peca].ajuste[0] = v; atualizarEncaixes(); });
ligarNumero('p-ajuste-y', () => P().pecas[estado.peca].ajuste[1], (v) => { P().pecas[estado.peca].ajuste[1] = v; atualizarEncaixes(); });
$('p-zerar-peca').addEventListener('click', () => { P().pecas[estado.peca].ajuste = [0, 0]; atualizarEncaixes(); atualizarTudo(false); });
$('p-zerar-tudo').addEventListener('click', () => {
  if (!confirm('Zerar o ajuste fino de todas as peças e o afastamento de braços e pernas?')) return;
  for (const d of PECAS) P().pecas[d.id].ajuste = [0, 0];
  P().afastarBracos = 0; P().afastarPernas = 0;
  atualizarEncaixes();
  atualizarTudo(false);
});

// Cenário
const C = () => estado.cenario;
let idManualC = false;
ligarTexto('c-nome', () => C().nome, (v) => { C().nome = v; if (!idManualC) C().id = paraId(v); });
ligarTexto('c-id', () => C().id, (v) => { C().id = paraId(v); idManualC = v !== ''; });
ligarTexto('c-autoria', () => C().autoria, (v) => { C().autoria = v; });
ligarTexto('c-audiodescricao', () => C().audiodescricao, (v) => { C().audiodescricao = v; });
ligarNumero('c-altura', () => C().alturaDaFolha, (v) => { if (v >= 100) C().alturaDaFolha = v; });
const porcento = (v: number) => `${v}%`;
for (const [campo, chave] of [['brilho', 'brilho'], ['contraste', 'contraste'], ['saturacao', 'saturacao']] as const) {
  ligarNumero(`p-${campo}`, () => P().cor[chave], (v) => { P().cor[chave] = v; atualizarPreviaDepois(); }, `p-${campo}-valor`, porcento);
  ligarNumero(`c-${campo}`, () => C().cor[chave], (v) => { C().cor[chave] = v; }, `c-${campo}-valor`, porcento);
}
for (const modo of ['p', 'c'] as const) {
  $(`${modo}-cor-zerar`).addEventListener('click', () => {
    (modo === 'p' ? P() : C()).cor = { ...COR_PADRAO };
    atualizarPreviaDepois();
    atualizarTudo(false);
  });
}
ligarNumero('c-papel', () => C().limparPapel, (v) => { C().limparPapel = v; }, 'c-papel-valor', (v) => (v === 0 ? 'desligado' : String(v)));
const caixaFundo = $<HTMLInputElement>('c-fundo');
caixaFundo.addEventListener('change', () => { C().exportarFundo = caixaFundo.checked; });
campos.push(() => { caixaFundo.checked = C().exportarFundo; });

const El = () => elementoPorChave(estado.elemento);
ligarTexto('c-el-nome', () => El()?.id ?? '', (v) => { const e = El(); if (e) e.id = paraId(v); });
ligarNumero('c-el-escala', () => El()?.escala ?? 1, (v) => { const e = El(); if (e) e.escala = v; }, 'c-el-escala-valor', (v) => `${Math.round(v * 100)}%`);
$<HTMLSelectElement>('c-el-camada').addEventListener('change', (ev) => {
  const e = El(); if (e) e.camada = (ev.target as HTMLSelectElement).value as ElementoCenario['camada'];
  atualizarTudo(false);
});
$<HTMLInputElement>('c-el-espelhar').addEventListener('change', (ev) => {
  const e = El(); if (e) e.espelhar = (ev.target as HTMLInputElement).checked;
  atualizarTudo(false);
});
campos.push(() => {
  const e = El();
  $('c-elemento').hidden = !e;
  if (e) {
    $<HTMLSelectElement>('c-el-camada').value = e.camada;
    $<HTMLInputElement>('c-el-espelhar').checked = e.espelhar;
  }
});
$('c-el-lugar').addEventListener('click', () => { const e = El(); if (e) e.deslocamento = [0, 0]; atualizarTudo(false); });
$('c-el-apagar').addEventListener('click', () => {
  const e = El();
  if (!e || !confirm(`Apagar o elemento "${e.id || 'sem nome'}"?`)) return;
  C().elementos = C().elementos.filter((x) => x !== e);
  estado.elemento = C().elementos.at(-1)?.chave ?? null;
  atualizarTudo();
});
let contadorElementos = 0;
function novoElemento(): ElementoCenario {
  const numero = C().elementos.length + 1;
  const e: ElementoCenario = {
    chave: `e${Date.now()}_${contadorElementos++}`, id: `elemento_${numero}`,
    contorno: { pontos: [], fechado: false }, camada: 'meio', espelhar: false, escala: 1, deslocamento: [0, 0],
  };
  C().elementos.push(e);
  estado.elemento = e.chave;
  return e;
}
$('c-novo').addEventListener('click', () => {
  novoElemento();
  editor.definirModo('desenhar');
  atualizarTudo();
});

// Áudios
async function lerAudio(entrada: HTMLInputElement, modo: Modo): Promise<void> {
  const arquivo = entrada.files?.[0];
  if (!arquivo) return;
  estado.midia[modo].audio = { nome: arquivo.name, dados: await lerComoDataUrl(arquivo) };
  estado.midia[modo].gravacao = null;
  estado.midia[modo].opcoes = [];
  const ext = extensao(arquivo.name);
  if (!['wav', 'ogg', 'mp3'].includes(ext)) avisar('A Godot abre áudio .wav, .ogg (Vorbis) ou .mp3. Converta este arquivo antes.', true);
  else if (ext === 'ogg') avisar('Atenção: se este .ogg for Opus (do estúdio de dublagem), a Godot não abre. Prefira .wav.');
  entrada.value = '';
  atualizarTudo(false);
}
$<HTMLInputElement>('p-audio').addEventListener('change', (e) => lerAudio(e.target as HTMLInputElement, 'personagem'));
$<HTMLInputElement>('c-audio').addEventListener('change', (e) => lerAudio(e.target as HTMLInputElement, 'cenario'));
campos.push(() => {
  for (const [modo, id] of [['personagem', 'p-audio-nome'], ['cenario', 'c-audio-nome']] as const) {
    const m = estado.midia[modo];
    $(id).textContent = m.gravacao ? '' : m.audio ? `Áudio escolhido: ${m.audio.nome}` : 'Sem áudio: o jogo usa a voz do aparelho para ler a legenda.';
  }
});

// Gravação do Estúdio Meu Bairro: ouvir as tomadas, escolher uma e escrever a legenda.
async function importarGravacao(entrada: HTMLInputElement, modo: Modo): Promise<void> {
  const arquivo = entrada.files?.[0];
  entrada.value = '';
  if (!arquivo) return;
  try {
    const lista = await lerZipDoEstudio(arquivo);
    const m = estado.midia[modo];
    m.opcoes = lista.length > 1 ? lista : [];
    const preferidos = modo === 'personagem' ? (P().tipo === 'npc' ? ['npc', 'personagem'] : ['personagem', 'npc']) : ['cenario', 'extra'];
    const g = preferidos.map((t) => lista.find((x) => x.tipo === t)).find(Boolean) ?? lista[0];
    usarGravacao(modo, g);
    avisar(`Gravação de ${g.apelido} (${g.titulo}) importada. Ouça, escolha a tomada e escreva a legenda.`);
  } catch (erro) {
    avisar('Não foi possível abrir a gravação: ' + String((erro as Error).message ?? erro), true);
  }
}

function usarGravacao(modo: Modo, g: GravacaoImportada): void {
  const m = estado.midia[modo];
  m.gravacao = g;
  m.audio = null;
  const projeto = modo === 'personagem' ? P() : C();
  if (!projeto.autoria.trim()) projeto.autoria = g.apelido;
  atualizarTudo(false);
}

$<HTMLInputElement>('p-gravacao').addEventListener('change', (e) => importarGravacao(e.target as HTMLInputElement, 'personagem'));
$<HTMLInputElement>('c-gravacao').addEventListener('change', (e) => importarGravacao(e.target as HTMLInputElement, 'cenario'));

function desenharGravacao(modo: Modo): void {
  const caixa = $(modo === 'personagem' ? 'p-gravacao-info' : 'c-gravacao-info');
  const m = estado.midia[modo];
  const g = m.gravacao;
  if (!g) { caixa.replaceChildren(); return; }
  const partes: Node[] = [];
  if (m.opcoes.length > 1) {
    const sel = el('select', { 'aria-label': 'Qual desenho desta criança' });
    m.opcoes.forEach((o, i) => sel.append(el('option', { value: String(i) }, o.titulo)));
    sel.value = String(Math.max(0, m.opcoes.indexOf(g)));
    sel.addEventListener('change', () => usarGravacao(modo, m.opcoes[Number(sel.value)]));
    partes.push(el('label', {}, 'Qual desenho', sel));
  }
  const voz = vozDaGravacao(g);
  partes.push(el('p', { class: 'origem' }, `${g.apelido} · ${g.titulo}` + (voz.adulto ? ` · voz de adulto: ${voz.adulto}` : '')));
  if (g.anotacao) partes.push(el('p', { class: 'nota' }, `Anotação: ${g.anotacao}`));
  const lista = el('div', { class: 'tomadas', role: 'radiogroup', 'aria-label': 'Tomada que vai para o jogo' });
  g.tomadas.forEach((t, i) => {
    const radio = el('input', { type: 'radio', name: `tomada-${modo}`, value: String(i) });
    radio.checked = i === g.escolhida;
    radio.addEventListener('change', () => { g.escolhida = i; atualizarTudo(false); });
    const tocar = el('button', { type: 'button', class: 'botao redondo', 'aria-label': `Ouvir a tomada ${i + 1}`, title: 'Ouvir' }, '▶');
    tocar.addEventListener('click', (ev) => { ev.preventDefault(); ouvir(t); });
    lista.append(el('label', { class: 'tomada' + (i === g.escolhida ? ' escolhida' : '') }, radio, `Tomada ${i + 1}`, tocar,
      el('small', {}, `${(t.fim - t.inicio).toFixed(1).replace('.', ',')} s`)));
  });
  const tirar = el('button', { type: 'button', class: 'botao' }, 'Tirar esta gravação');
  tirar.addEventListener('click', () => { pararSom(); m.gravacao = null; m.opcoes = []; atualizarTudo(false); });
  caixa.replaceChildren(...partes, lista, tirar);
}
campos.push(() => { desenharGravacao('personagem'); desenharGravacao('cenario'); });

// ---------- Lista de peças e de elementos ----------

function atualizarListas(): void {
  const lista = $('p-pecas');
  lista.replaceChildren(...PECAS.map((d) => {
    const p = P().pecas[d.id];
    const pronta = pecaPronta(P(), d.id);
    const estadoTexto = pronta ? '✓' : p.contorno?.pontos.length ? 'desenhando' : '';
    const botao = el('button', { type: 'button', 'aria-pressed': String(estado.peca === d.id), title: d.dica },
      el('span', { class: 'cor', style: `background:${d.cor}` }), d.nome, el('span', { class: 'estado' + (pronta ? ' ok' : '') }, estadoTexto));
    botao.addEventListener('click', () => { estado.peca = d.id; atualizarTudo(); });
    return el('li', {}, botao);
  }));
  const prontas = PECAS.filter((d) => pecaPronta(P(), d.id)).length;
  $('p-contagem').textContent = `${prontas} de ${PECAS.length}`;
  const def = PECA_POR_ID[estado.peca];
  $('p-dica-peca').textContent = `${def.nome}: ${def.dica}` + (def.pai ? ` Se foi desenhada separada, marque o encaixe no desenho de "${PECA_POR_ID[def.pai].nome}".` : '');

  const listaC = $('c-elementos');
  listaC.replaceChildren(...C().elementos.map((e, i) => {
    const botao = el('button', { type: 'button', 'aria-pressed': String(estado.elemento === e.chave) },
      el('span', { class: 'cor', style: `background:${CORES_CENARIO[i % CORES_CENARIO.length]}` }), e.id || `elemento ${i + 1}`,
      el('span', { class: 'estado' + (e.contorno.fechado ? ' ok' : '') }, e.contorno.fechado ? '✓' : 'desenhando'));
    botao.addEventListener('click', () => { estado.elemento = e.chave; atualizarTudo(); });
    return el('li', {}, botao);
  }));
  $('c-contagem').textContent = `${C().elementos.filter((e) => e.contorno.fechado).length} recortados`;
}

function atualizarDica(): void {
  const modo = editor.modo;
  let texto = '';
  if (!midiaAtual().imagem) texto = 'Comece com "Abrir imagem".';
  else if (modo === 'desenhar') texto = 'Clique em volta do desenho. Para fechar: clique no primeiro ponto, duplo clique ou Enter. Backspace desfaz.';
  else if (modo === 'pivo') texto = 'Clique onde a peça gira (a articulação).';
  else if (modo === 'encaixe') texto = 'Clique no desenho do pai, no lugar onde esta peça se prende.';
  else texto = 'Arraste os pontos e o pivô para ajustar. Clique num recorte para escolher. Roda do mouse: zoom.';
  $('dica-editor').textContent = texto;
  for (const [id, m] of [['ferr-desenhar', 'desenhar'], ['ferr-pivo', 'pivo'], ['ferr-encaixe', 'encaixe']] as const) {
    $(id).classList.toggle('ativo', modo === m);
  }
}

// ---------- Atualização geral ----------

let tempoGuardar = 0;
function atualizarTudo(refazerPrevia = true): void {
  for (const f of campos) f();
  atualizarListas();
  atualizarDica();
  editor.filtro = filtroCss(estado.modo === 'personagem' ? P().cor : C().cor);
  editor.desenhar();
  if (estado.modo === 'personagem') {
    if (refazerPrevia) atualizarPreviaDepois();
    else atualizarEncaixes();
  } else montagem.desenhar();
  clearTimeout(tempoGuardar);
  tempoGuardar = window.setTimeout(() => {
    void guardar('personagem', paraArquivo('personagem'));
    void guardar('cenario', paraArquivo('cenario'));
  }, 800);
}

function trocarModo(modo: Modo): void {
  estado.modo = modo;
  for (const b of document.querySelectorAll<HTMLButtonElement>('.abas button')) b.setAttribute('aria-selected', String(b.dataset.modo === modo));
  $('painel-personagem').hidden = modo !== 'personagem';
  $('painel-cenario').hidden = modo !== 'cenario';
  for (const e of document.querySelectorAll<HTMLElement>('.so-personagem')) e.hidden = modo !== 'personagem';
  $('novo').textContent = modo === 'personagem' ? 'Novo personagem' : 'Novo cenário';
  $('ferr-pivo').hidden = modo !== 'personagem';
  editor.definirModo('editar');
  editor.definirImagem(midiaAtual().imagem);
  atualizarTudo();
}
for (const b of document.querySelectorAll<HTMLButtonElement>('.abas button')) b.addEventListener('click', () => trocarModo(b.dataset.modo as Modo));

// ---------- Ferramentas ----------

$('ferr-desenhar').addEventListener('click', () => {
  if (!midiaAtual().imagem) return avisar('Abra uma imagem primeiro.', true);
  if (estado.modo === 'personagem') {
    const p = P().pecas[estado.peca];
    if (p.contorno?.fechado && !confirm(`Desenhar de novo o contorno de "${PECA_POR_ID[estado.peca].nome}"?`)) return;
    if (p.contorno?.fechado || !p.contorno) p.contorno = { pontos: [], fechado: false };
  } else {
    const e = El();
    if (!e || e.contorno.fechado) novoElemento();
  }
  editor.definirModo('desenhar');
  atualizarTudo(false);
});
$('ferr-pivo').addEventListener('click', () => { editor.definirModo('pivo'); atualizarDica(); });
$('ferr-encaixe').addEventListener('click', () => {
  if (!PECA_POR_ID[estado.peca].pai) return avisar('A base não tem encaixe: ela é o centro do boneco.');
  editor.definirModo('encaixe');
  atualizarDica();
});
$('ferr-apagar').addEventListener('click', () => {
  if (estado.modo === 'personagem') {
    const p = P().pecas[estado.peca];
    if (!p.contorno || !confirm(`Apagar o contorno, o pivô e o encaixe de "${PECA_POR_ID[estado.peca].nome}"?`)) return;
    Object.assign(p, { contorno: null, pivo: null, encaixe: null });
  } else {
    const e = El();
    if (!e || !confirm('Apagar o contorno deste elemento?')) return;
    e.contorno = { pontos: [], fechado: false };
  }
  atualizarTudo();
});
$('zoom-mais').addEventListener('click', () => editor.zoom(1.25));
$('zoom-menos').addEventListener('click', () => editor.zoom(1 / 1.25));
$('enquadrar').addEventListener('click', () => editor.enquadrar());
$('abrir-ajuda').addEventListener('click', () => $<HTMLDialogElement>('ajuda').showModal());

// ---------- Imagem e projeto ----------

const LADO_MAXIMO = 3200;

/** Diminui escaneados enormes (mais leve para salvar e recortar; continua com qualidade de sobra). */
async function prepararImagem(url: string): Promise<string> {
  const img = await carregarImagem(url);
  const lado = Math.max(img.width, img.height);
  if (lado <= LADO_MAXIMO) return url;
  const f = LADO_MAXIMO / lado;
  const canvas = el('canvas');
  canvas.width = Math.round(img.width * f);
  canvas.height = Math.round(img.height * f);
  const c = canvas.getContext('2d')!;
  c.imageSmoothingQuality = 'high';
  c.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

async function definirImagem(modo: Modo, url: string | null): Promise<void> {
  const m = estado.midia[modo];
  m.imagemUrl = url;
  m.imagem = url ? await carregarImagem(url) : null;
  cacheRecortes.clear();
  if (modo === estado.modo) editor.definirImagem(m.imagem);
}

$<HTMLInputElement>('abrir-imagem').addEventListener('change', async (ev) => {
  const entrada = ev.target as HTMLInputElement;
  const arquivo = entrada.files?.[0];
  entrada.value = '';
  if (!arquivo) return;
  try {
    await definirImagem(estado.modo, await prepararImagem(await lerComoDataUrl(arquivo)));
    if (estado.modo === 'personagem' && !P().nome) {
      const nome = arquivo.name.replace(/\.[^.]+$/, '');
      if (!/scan|img|dsc|\d{4}/i.test(nome)) { P().nome = nome; P().id = paraId(nome); }
    }
    atualizarTudo();
    avisar(estado.modo === 'personagem' ? 'Imagem aberta. Escolha uma peça e clique em "Desenhar contorno".' : 'Imagem aberta. Clique em "+ Novo elemento" para recortar.');
  } catch (erro) {
    avisar(String((erro as Error).message ?? erro), true);
  }
});

function paraArquivo(modo: Modo): ArquivoProjeto {
  const m = estado.midia[modo];
  return {
    versao_formato: 1, modo, imagem: m.imagemUrl, audio: m.audio, gravacao: m.gravacao,
    ...(modo === 'personagem' ? { personagem: estado.personagem } : { cenario: estado.cenario }),
  };
}

async function carregarArquivo(a: ArquivoProjeto, trocar = true): Promise<void> {
  if (a.versao_formato !== 1) throw new Error('Este projeto é de uma versão diferente da ferramenta.');
  if (a.modo === 'personagem' && a.personagem) {
    estado.personagem = { ...novoPersonagem(), ...a.personagem };
    estado.personagem.cor = { ...COR_PADRAO, ...a.personagem.cor };
    for (const d of PECAS) estado.personagem.pecas[d.id] = Object.assign({ contorno: null, pivo: null, encaixe: null, ajuste: [0, 0] as Ponto }, a.personagem.pecas?.[d.id]);
    idManualP = estado.personagem.id !== paraId(estado.personagem.nome);
  } else if (a.modo === 'cenario' && a.cenario) {
    estado.cenario = { ...novoCenario(), ...a.cenario };
    estado.cenario.cor = { ...COR_PADRAO, ...a.cenario.cor };
    estado.elemento = estado.cenario.elementos[0]?.chave ?? null;
    idManualC = estado.cenario.id !== paraId(estado.cenario.nome);
  } else throw new Error('Arquivo de projeto incompleto.');
  estado.midia[a.modo].audio = a.audio ?? null;
  estado.midia[a.modo].gravacao = (a.gravacao as GravacaoImportada | undefined) ?? null;
  estado.midia[a.modo].opcoes = [];
  await definirImagem(a.modo, a.imagem);
  if (trocar) trocarModo(a.modo);
}

$<HTMLInputElement>('abrir-projeto').addEventListener('change', async (ev) => {
  const entrada = ev.target as HTMLInputElement;
  const arquivo = entrada.files?.[0];
  entrada.value = '';
  if (!arquivo) return;
  try {
    await carregarArquivo(JSON.parse(await arquivo.text()) as ArquivoProjeto);
    avisar('Projeto aberto.');
  } catch (erro) {
    avisar('Não foi possível abrir o projeto: ' + String((erro as Error).message ?? erro), true);
  }
});

// Começar outro personagem (ou cenário) sem apagar peça por peça.
// A imagem aberta continua (às vezes há mais de um desenho na mesma folha) e os ajustes gerais também.
$('novo').addEventListener('click', () => {
  const ehPersonagem = estado.modo === 'personagem';
  const pergunta = ehPersonagem
    ? 'Começar um novo personagem? Os contornos, os textos e o áudio deste somem da página. Se quiser continuar este depois, clique em Cancelar e use "Salvar projeto" antes.'
    : 'Começar um novo cenário? Os elementos, os textos e o áudio deste somem da página. Se quiser continuar este depois, clique em Cancelar e use "Salvar projeto" antes.';
  if (!confirm(pergunta)) return;
  if (ehPersonagem) {
    const antigo = estado.personagem;
    estado.personagem = { ...novoPersonagem(), tipo: antigo.tipo === 'tia' ? 'personagem' : antigo.tipo, alturaDaArte: antigo.alturaDaArte, limparPapel: antigo.limparPapel };
    estado.peca = 'cabeca';
    idManualP = false;
  } else {
    const antigo = estado.cenario;
    estado.cenario = { ...novoCenario(), alturaDaFolha: antigo.alturaDaFolha, limparPapel: antigo.limparPapel, exportarFundo: antigo.exportarFundo };
    estado.elemento = null;
    idManualC = false;
    cacheRecortes.clear();
  }
  estado.midia[estado.modo].audio = null;
  estado.midia[estado.modo].gravacao = null;
  estado.midia[estado.modo].opcoes = [];
  pararSom();
  previa.dados = null;
  editor.definirModo('editar');
  atualizarTudo();
  avisar(ehPersonagem ? 'Pronto! Comece o novo personagem pela cabeça.' : 'Pronto! Clique em "+ Novo elemento" para recortar.');
});

$('salvar-projeto').addEventListener('click', () => {
  const nome = (estado.modo === 'personagem' ? P().id : C().id) || 'sem_nome';
  baixar(new Blob([JSON.stringify(paraArquivo(estado.modo))], { type: 'application/json' }), `${nome}_recorte.json`);
});

// ---------- Exportar ZIP ----------

function extensao(nome: string): string {
  return (nome.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'ogg').toLowerCase();
}

function dadosDoDataUrl(url: string): string {
  return url.slice(url.indexOf(',') + 1);
}

const LEIA = (pasta: string) =>
  `Extraia este ZIP dentro da pasta do projeto do jogo (onde fica o project.godot).\n` +
  `Os arquivos vão para: ${pasta}\nDepois abra a Godot para ela importar as imagens.\n`;

async function montarZip(): Promise<{ blob: Blob; nome: string; pasta: string }> {
  const zip = new JSZip();
  const m = midiaAtual();
  if (!m.imagem) throw new Error('Abra uma imagem primeiro.');
  if (estado.modo === 'personagem') {
    const p = P();
    if (!p.id) throw new Error('Escreva o nome do personagem.');
    const pasta = p.tipo === 'tia' ? 'outros/tia/' : `${p.tipo === 'npc' ? 'npcs' : 'personagens'}/${p.id}/`;
    const audio = m.gravacao ? 'apresentacao.wav' : m.audio ? `apresentacao.${extensao(m.audio.nome)}` : null;
    const r = exportarPersonagem(m.imagem, p, audio);
    if (m.gravacao) r.json.voz = vozDaGravacao(m.gravacao);
    for (const [id, peca] of Object.entries(r.imagens)) zip.file(pasta + id + '.png', await paraBlob(peca.canvas));
    zip.file(pasta + 'personagem.json', JSON.stringify(r.json, null, 2) + '\n');
    if (m.gravacao) zip.file(pasta + 'apresentacao.wav', wavParaJogo(m.gravacao));
    else if (m.audio && audio) zip.file(pasta + audio, dadosDoDataUrl(m.audio.dados), { base64: true });
    zip.file('LEIA.txt', LEIA(pasta));
    return { blob: await zip.generateAsync({ type: 'blob' }), nome: `${p.tipo === 'tia' ? 'tia' : p.id}.zip`, pasta };
  }
  const c = C();
  if (!c.id) throw new Error('Escreva o nome do cenário.');
  const pasta = `cenarios/${c.id}/`;
  const audio = m.gravacao ? 'audiodescricao.wav' : m.audio ? `audiodescricao.${extensao(m.audio.nome)}` : null;
  const r = exportarCenario(m.imagem, c, audio);
  if (m.gravacao) r.json.voz = vozDaGravacao(m.gravacao);
  for (const [nome, canvas] of Object.entries(r.imagens)) zip.file(pasta + nome, await paraBlob(canvas));
  zip.file(pasta + 'cenario.json', JSON.stringify(r.json, null, 2) + '\n');
  if (m.gravacao) zip.file(pasta + 'audiodescricao.wav', wavParaJogo(m.gravacao));
  else if (m.audio && audio) zip.file(pasta + audio, dadosDoDataUrl(m.audio.dados), { base64: true });
  zip.file('LEIA.txt', LEIA(pasta));
  return { blob: await zip.generateAsync({ type: 'blob' }), nome: `cenario_${c.id}.zip`, pasta };
}

$('exportar').addEventListener('click', async () => {
  try {
    const z = await montarZip();
    baixar(z.blob, z.nome);
    avisar(`ZIP pronto. Extraia na pasta do jogo: os arquivos vão para ${z.pasta}`);
  } catch (erro) {
    avisar(String((erro as Error).message ?? erro), true);
  }
});

// ---------- Começo ----------

async function comecar(): Promise<void> {
  for (const modo of ['cenario', 'personagem'] as const) {
    const a = await recuperar(modo);
    if (a?.imagem) {
      try { await carregarArquivo(a, false); } catch { /* projeto guardado com problema: começa do zero */ }
    }
  }
  trocarModo('personagem');
  if (estado.midia.personagem.imagem || estado.midia.cenario.imagem) avisar('Seu último trabalho foi recuperado deste navegador.');
}
void comecar();

// Ganchos para os testes automáticos (não atrapalham o uso normal).
declare global { interface Window { __recortes: unknown } }
window.__recortes = {
  estado,
  trocarModo,
  definirImagem: async (url: string) => { await definirImagem(estado.modo, url); atualizarTudo(); },
  definirPeca: (id: IdPeca, pontos: Ponto[], pivo: Ponto, encaixe: Ponto | null = null) => {
    const contorno: Contorno = { pontos, fechado: true };
    Object.assign(P().pecas[id], { contorno, pivo, encaixe });
    atualizarTudo();
  },
  novoElemento: (id: string, pontos: Ponto[], camada: ElementoCenario['camada'] = 'meio') => {
    const e = novoElemento();
    Object.assign(e, { id, camada, contorno: { pontos, fechado: true } });
    atualizarTudo();
  },
  atualizarTudo,
  atualizarPrevia,
  montarZip: async () => {
    const z = await montarZip();
    return { nome: z.nome, base64: await blobParaBase64(z.blob) };
  },
};

async function blobParaBase64(blob: Blob): Promise<string> {
  return dadosDoDataUrl(await lerComoDataUrl(blob));
}
