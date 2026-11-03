// Tipos de dados do projeto de recorte (o que é salvo no arquivo .json do projeto).
import type { IdPeca } from './pecas';

export type Ponto = [number, number];

export interface Contorno {
  pontos: Ponto[];
  fechado: boolean;
}

export interface PecaRecortada {
  contorno: Contorno | null;
  pivo: Ponto | null;
  /** Onde esta peça se encaixa no desenho do pai (só quando as peças foram desenhadas separadas).
   *  Sem ele, a peça fica onde foi desenhada (boneco desenhado inteiro). */
  encaixe: Ponto | null;
  /** Ajuste fino do encaixe, em pixels da arte exportada. */
  ajuste: Ponto;
}

/** Ajuste de cor do desenho, em porcentagem (100 = como foi escaneado). */
export interface AjusteCor {
  brilho: number;
  contraste: number;
  saturacao: number;
}

export const COR_PADRAO: AjusteCor = { brilho: 100, contraste: 100, saturacao: 100 };

export type TipoPersonagem = 'personagem' | 'npc' | 'tia';

export interface ProjetoPersonagem {
  tipo: TipoPersonagem;
  nome: string;
  id: string;
  autoria: string;
  apresentacao: string;
  alturaDaArte: number;
  afastarBracos: number;
  afastarPernas: number;
  /** 0 = desligado; 1 a 60 = quanto do branco do papel vira transparente. */
  limparPapel: number;
  cor: AjusteCor;
  pecas: Record<IdPeca, PecaRecortada>;
}

export type Camada = 'fundo' | 'meio' | 'frente';

export interface ElementoCenario {
  /** Identificação interna (não muda quando o nome muda). */
  chave: string;
  /** Nome do arquivo no jogo (ex.: arvore -> arvore.png). */
  id: string;
  contorno: Contorno;
  camada: Camada;
  espelhar: boolean;
  escala: number;
  /** Ajuste da posição na montagem, em pixels do jogo. */
  deslocamento: Ponto;
}

export interface ProjetoCenario {
  nome: string;
  id: string;
  autoria: string;
  audiodescricao: string;
  alturaDaFolha: number;
  exportarFundo: boolean;
  limparPapel: number;
  cor: AjusteCor;
  elementos: ElementoCenario[];
}

export type Modo = 'personagem' | 'cenario';

/** Arquivo .json salvo pela ferramenta (guarda a imagem e o áudio dentro dele). */
export interface ArquivoProjeto {
  versao_formato: 1;
  modo: Modo;
  imagem: string | null;
  audio: { nome: string; dados: string } | null;
  /** Gravação importada do Estúdio Meu Bairro (com as tomadas). */
  gravacao?: unknown;
  personagem?: ProjetoPersonagem;
  cenario?: ProjetoCenario;
}
