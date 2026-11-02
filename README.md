# Meu Bairro – Recortes

Ferramenta (página web) para recortar os desenhos das crianças e levar para o jogo
**Meu Bairro Vira Game** (Godot 4.7). Funciona no navegador do computador: nada é enviado para a internet,
tudo fica no seu computador.

> Link da ferramenta: `https://<seu-usuario>.github.io/meu-bairro-recortes/` (depois de publicar).

## O que ela faz

**Personagem** (personagem jogável, pessoa do bairro/NPC ou a Tia)
- Recorta as **11 peças**: cabeça, tronco, base (quadril), braço e antebraço, coxa e perna de cada lado.
- Marca o **pivô** de cada peça (onde ela gira: pescoço, ombro, cotovelo, quadril, joelho).
- Serve para boneco **desenhado inteiro** ou com as **peças desenhadas separadas** na folha
  (nesse caso, use **Marcar encaixe**: clique no desenho do pai onde a peça se prende).
- **Prévia animada** com as mesmas animações do jogo (respirando, andando, pulando, flutuando, interagindo)
  e a mesma ordem das peças (parado, a cabeça na frente; andando ou pulando, o braço de trás por cima).
- **Ajustes**: afastar braços, afastar pernas, ajuste fino de cada peça (ou arraste a peça na pose "Parado"),
  tirar o branco do papel e altura da arte.
- Texto da apresentação e áudio gravado (.ogg).

**Cenário**
- Recorta vários **elementos** de uma folha (árvore, casa, banco...). Uma folha não precisa virar uma tela.
- Cada elemento tem nome, camada (fundo, meio, frente), espelhar e tamanho.
- **Montagem** no tamanho do jogo, com o retângulo da tela e um boneco de referência; arraste para arrumar.
- Opção de exportar também a folha inteira como fundo.
- Texto da audiodescrição e áudio gravado (.ogg).

## Como usar

1. **Abrir imagem**: a folha escaneada (ou foto bem reta e com boa luz).
2. Escolha a peça (ou **+ Novo elemento**) e clique em **Desenhar contorno**.
   Clique ponto a ponto em volta do desenho. Para fechar: clique no primeiro ponto, dê duplo clique ou aperte Enter.
3. Arraste o **pivô** para a articulação certa (ele aparece sozinho num lugar sugerido).
4. Confira a **prévia**, faça os ajustes e clique em **Exportar ZIP para o jogo**.
5. Extraia o ZIP **dentro da pasta do jogo** (onde fica o `project.godot`). As pastas já vêm com o caminho certo:
   - personagem: `personagens/<nome>/`
   - NPC: `npcs/<nome>/`
   - Tia: `outros/tia/`
   - cenário: `cenarios/<nome>/`
6. **Salvar projeto** baixa um arquivo `.json` com tudo (até a imagem) para continuar depois ou em outro computador.
   A ferramenta também guarda sozinha o último trabalho neste navegador.

### Levar o cenário para o bairro (na Godot)

Arraste uma `jogo/pecas/area_apagada.tscn` para a cena do bairro. No Inspetor, em
**Cenário da ferramenta de recorte**, escolha a pasta do cenário e aperte **Montar desenhos da pasta**.
Os desenhos aparecem dentro da área, com o meio do chão da folha na origem da área, e o nome e a
audiodescrição são preenchidos.

### Atalhos

| Tecla / mouse | Ação |
| --- | --- |
| Roda do mouse, `+`, `−` | zoom |
| `0` ou **Ver tudo** | enquadrar a imagem |
| Botão direito arrastando, ou `Espaço` + arrastar | mover a imagem |
| `Enter` ou duplo clique | fechar o contorno |
| `Backspace` | desfazer o último ponto |
| `Esc` | cancelar |
| `Shift` + clique num ponto | apagar o ponto |

## Áudio

O jogo usa **Ogg Vorbis (.ogg)**. A Godot não importa Opus: converta antes (o conversor de mídias vai fazer isso).

## Para programar

Precisa do Node.js 20 ou mais novo.

```
npm install
npm run dev      # abre em http://localhost:5173/meu-bairro-recortes/
npm run build    # atualiza a pasta docs/ (a que vai para o GitHub Pages)
```

### Publicar no GitHub Pages

A versão pronta para publicar fica na pasta **`docs/`** (já vem gerada).

1. Crie o repositório **meu-bairro-recortes** no GitHub e envie estes arquivos (GitHub Desktop).
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch **main**, pasta **/docs**. Salve.
3. Em 1 ou 2 minutos o link aparece no topo dessa mesma página.

Depois de mudar o código, rode `npm run build` para atualizar a pasta `docs/` e envie de novo.
Se o nome do repositório for outro, troque o `base` em `vite.config.ts`.

## Arquivos

| Arquivo | O que faz |
| --- | --- |
| `src/main.ts` | liga a página às partes abaixo |
| `src/editor.ts` | a imagem escaneada: zoom, contornos, pivô e encaixe |
| `src/recorte.ts` | a "tesoura": recorta e calcula pivôs e encaixes no formato do jogo |
| `src/previa.ts` | boneco animado (animações exportadas do jogo em `src/animacoes.json`) |
| `src/montagem.ts` | montagem do cenário no tamanho do jogo |
| `src/pecas.ts` | as 11 peças e a ordem de desenho (igual ao jogo) |
| `src/guardar.ts` | guarda o trabalho no navegador |

## Licença

Código sob a licença MIT (arquivo `LICENSE`). Fontes Atkinson Hyperlegible e Chewy sob a SIL Open Font License
(arquivos em `public/fontes/`). Os desenhos das crianças **não** fazem parte deste repositório.
