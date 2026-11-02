// As 11 peças do boneco recortado, na mesma hierarquia usada no jogo (Godot).
// O "pai" diz em qual peça cada uma se encaixa; o pivô fica na articulação.

export type IdPeca =
  | 'cabeca' | 'tronco' | 'base'
  | 'braco_esq' | 'antebraco_esq' | 'braco_dir' | 'antebraco_dir'
  | 'coxa_esq' | 'perna_esq' | 'coxa_dir' | 'perna_dir';

export interface DefinicaoPeca {
  id: IdPeca;
  nome: string;
  pai: IdPeca | null;
  cor: string;
  /** Onde fica o pivô sugerido, em fração da caixa do contorno (0 = esquerda/topo, 1 = direita/base). */
  pivoSugerido: [number, number];
  dica: string;
}

export const PECAS: DefinicaoPeca[] = [
  { id: 'cabeca', nome: 'Cabeça', pai: 'tronco', cor: '#e8590c', pivoSugerido: [0.5, 0.92], dica: 'Pivô no pescoço (embaixo da cabeça).' },
  { id: 'tronco', nome: 'Tronco', pai: 'base', cor: '#1f5fc4', pivoSugerido: [0.5, 0.95], dica: 'Pivô na cintura (embaixo do tronco).' },
  { id: 'base', nome: 'Base (quadril)', pai: null, cor: '#7048e8', pivoSugerido: [0.5, 0.2], dica: 'Pivô no meio do quadril.' },
  { id: 'braco_esq', nome: 'Braço esquerdo', pai: 'tronco', cor: '#2b8a3e', pivoSugerido: [0.5, 0.1], dica: 'Pivô no ombro.' },
  { id: 'antebraco_esq', nome: 'Antebraço esquerdo', pai: 'braco_esq', cor: '#5c940d', pivoSugerido: [0.5, 0.1], dica: 'Pivô no cotovelo.' },
  { id: 'braco_dir', nome: 'Braço direito', pai: 'tronco', cor: '#c2255c', pivoSugerido: [0.5, 0.1], dica: 'Pivô no ombro.' },
  { id: 'antebraco_dir', nome: 'Antebraço direito', pai: 'braco_dir', cor: '#e64980', pivoSugerido: [0.5, 0.1], dica: 'Pivô no cotovelo.' },
  { id: 'coxa_esq', nome: 'Coxa esquerda', pai: 'base', cor: '#1098ad', pivoSugerido: [0.5, 0.1], dica: 'Pivô no quadril.' },
  { id: 'perna_esq', nome: 'Perna esquerda', pai: 'coxa_esq', cor: '#0b7285', pivoSugerido: [0.5, 0.1], dica: 'Pivô no joelho.' },
  { id: 'coxa_dir', nome: 'Coxa direita', pai: 'base', cor: '#f08c00', pivoSugerido: [0.5, 0.1], dica: 'Pivô no quadril.' },
  { id: 'perna_dir', nome: 'Perna direita', pai: 'coxa_dir', cor: '#d9480f', pivoSugerido: [0.5, 0.1], dica: 'Pivô no joelho.' },
];

export const PECA_POR_ID = Object.fromEntries(PECAS.map((p) => [p.id, p])) as Record<IdPeca, DefinicaoPeca>;

/** Filhos de cada peça, na ordem de desenho do jogo (quem vem depois fica por cima). */
export function filhos(id: IdPeca | null, bracoPorCima: boolean): IdPeca[] {
  switch (id) {
    case null: return ['base'];
    case 'base': return ['coxa_esq', 'coxa_dir', 'tronco'];
    case 'coxa_esq': return ['perna_esq'];
    case 'coxa_dir': return ['perna_dir'];
    // Igual ao jogo: parado, a cabeça na frente; andando ou pulando, o braço de trás por cima da cabeça.
    case 'tronco': return bracoPorCima ? ['braco_dir', 'cabeca', 'braco_esq'] : ['braco_esq', 'braco_dir', 'cabeca'];
    case 'braco_esq': return ['antebraco_esq'];
    case 'braco_dir': return ['antebraco_dir'];
    default: return [];
  }
}
