// Guarda o trabalho sozinho neste navegador (IndexedDB), para não perder nada se a página fechar.
// É só uma garantia: para levar para outro computador, use "Salvar projeto".
import type { ArquivoProjeto, Modo } from './tipos';

const BANCO = 'meu_bairro_recortes';
const LOJA = 'projetos';

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export async function guardar(modo: Modo, arquivo: ArquivoProjeto): Promise<void> {
  try {
    const db = await abrir();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(LOJA, 'readwrite');
      t.objectStore(LOJA).put(arquivo, modo);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
    db.close();
  } catch (erro) {
    console.warn('Não foi possível guardar no navegador.', erro);
  }
}

export async function recuperar(modo: Modo): Promise<ArquivoProjeto | null> {
  try {
    const db = await abrir();
    const valor = await new Promise<ArquivoProjeto | null>((resolve, reject) => {
      const pedido = db.transaction(LOJA, 'readonly').objectStore(LOJA).get(modo);
      pedido.onsuccess = () => resolve((pedido.result as ArquivoProjeto) ?? null);
      pedido.onerror = () => reject(pedido.error);
    });
    db.close();
    return valor;
  } catch {
    return null;
  }
}
