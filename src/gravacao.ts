// Gravações do Estúdio Meu Bairro (gabura-estudio-dublagem-meu-bairro).
// Abre o ZIP de um desenho (personagem.zip, npc.zip, cenario.zip, extra_*.zip) ou o ZIP da criança inteira,
// deixa ouvir as tomadas e escolher uma. A escolhida vai para o jogo em WAV (a Godot abre e comprime sozinha).
import JSZip from 'jszip';
import { criarWav, lerWav } from './audio/wav';
import { TAXA, prepararParaJogo } from './audio/processar';

export interface TomadaImportada {
  arquivo: string;
  /** WAV da tomada, em base64 (para caber no projeto salvo). */
  base64: string;
  duracao: number;
  inicio: number;
  fim: number;
}

export interface GravacaoImportada {
  apelido: string;
  tipo: 'personagem' | 'npc' | 'cenario' | 'extra';
  titulo: string;
  anotacao: string;
  vozAdulta: string;
  tomadas: TomadaImportada[];
  escolhida: number;
}

interface GravacaoJson {
  formato: string; apelido: string; tipo: GravacaoImportada['tipo']; titulo: string; anotacao: string; voz_adulta: string;
  escolhida: string; tomadas: { arquivo: string; duracao: number; inicio: number; fim: number }[];
}

async function lerGravacao(zip: JSZip): Promise<GravacaoImportada> {
  const info = JSON.parse(await zip.file('gravacao.json')!.async('string')) as GravacaoJson;
  const tomadas: TomadaImportada[] = [];
  for (const t of info.tomadas) {
    const f = zip.file(t.arquivo);
    if (f) tomadas.push({ arquivo: t.arquivo, base64: await f.async('base64'), duracao: t.duracao, inicio: t.inicio, fim: t.fim });
  }
  if (tomadas.length === 0) throw new Error('Esta gravação não tem tomadas.');
  return {
    apelido: info.apelido, tipo: info.tipo, titulo: info.titulo, anotacao: info.anotacao, vozAdulta: info.voz_adulta,
    tomadas, escolhida: Math.max(0, tomadas.findIndex((t) => t.arquivo === info.escolhida)),
  };
}

/** Lê o ZIP de um desenho ou da criança (aí devolve todos os desenhos que têm gravação). */
export async function lerZipDoEstudio(arquivo: Blob): Promise<GravacaoImportada[]> {
  const zip = await JSZip.loadAsync(arquivo);
  if (zip.file('gravacao.json')) return [await lerGravacao(zip)];
  if (zip.file('crianca.json')) {
    const lista: GravacaoImportada[] = [];
    for (const nome of Object.keys(zip.files).filter((n) => n.endsWith('.zip')).sort()) {
      const interno = await JSZip.loadAsync(await zip.file(nome)!.async('uint8array'));
      if (interno.file('gravacao.json')) lista.push(await lerGravacao(interno));
    }
    if (lista.length === 0) throw new Error('Esta criança ainda não tem gravações.');
    return lista;
  }
  if (zip.file('oficina.json')) throw new Error('Este é o ZIP de todas as crianças. Use o ZIP de uma criança ou de um desenho.');
  throw new Error('Este ZIP não é do Estúdio Meu Bairro.');
}

function bytesDe(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** O som da tomada como vai para o jogo (cortado, sem ronco e com volume nivelado). */
export function somParaJogo(t: TomadaImportada): Float32Array {
  return prepararParaJogo(lerWav(bytesDe(t.base64)).amostras, t.inicio, t.fim);
}

export function wavParaJogo(g: GravacaoImportada): Uint8Array {
  return criarWav(somParaJogo(g.tomadas[g.escolhida]), TAXA, 16);
}

/** Quem gravou, para os créditos. */
export function vozDaGravacao(g: GravacaoImportada): { crianca: string; adulto: string } {
  return { crianca: g.apelido, adulto: g.vozAdulta === '-' ? 'adulto da equipe' : g.vozAdulta };
}

let ctx: AudioContext | null = null;
let tocando: AudioBufferSourceNode | null = null;

export function pararSom(): void {
  try { tocando?.stop(); } catch { /* já parou */ }
  tocando = null;
}

export function ouvir(t: TomadaImportada): void {
  pararSom();
  ctx ??= new AudioContext({ sampleRate: TAXA });
  void ctx.resume();
  const x = somParaJogo(t);
  const b = ctx.createBuffer(1, Math.max(1, x.length), TAXA);
  b.copyToChannel(x, 0);
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(ctx.destination);
  s.start();
  tocando = s;
}
