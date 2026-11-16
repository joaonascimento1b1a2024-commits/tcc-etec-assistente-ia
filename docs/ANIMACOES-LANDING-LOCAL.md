# Animações discretas da landing — 11/11/2026

## Escopo desta rodada

Implementados somente os efeitos discretos recomendados e autorizados: entrada dos cards de benefícios e serviços, escala leve dos ícones de serviços e microinteração dos botões. Sem alteração de textos, imagens, logos, estrutura das seções ou dimensões do layout.

- Cards: entrada única de 350 ms, opacidade e deslocamento vertical de 8 px. Sequência com atraso de 100 ms entre cards do mesmo grupo que entram juntos na área visível.
- Ícones de serviços: escala de 0,96 para 1, acompanhando o card, sem rotação. São os SVGs já usados como máscaras CSS; não foram substituídos.
- Botões: deslocamento de 2 px no hover somente com mouse preciso; escala de 0,98 ao pressionar. Áreas clicáveis e foco preservados.

Conector das etapas, destaque de etapa ativa, parallax, header persistente/translúcido, barra de progresso e brilho com mouse foram adiados para avaliação posterior. Não foram adicionados contadores nem estatísticas.

## Implementação e acessibilidade

Arquivos novos: `public/Landing-Page/animacoes-scroll.css` e `public/Landing-Page/animacoes-scroll.js`. O único HTML alterado é `public/index.html`, para carregar os dois arquivos.

Usa IntersectionObserver como base, sem depender de animation-timeline. A Web Animations API anima apenas transform e opacity. Os elementos começam visíveis no CSS; não existe classe que os deixe ocultos aguardando o JavaScript. Sem suporte, a apresentação continua estática. As animações têm duração finita e não mantêm estado final persistente; uma exceção ao iniciar os efeitos cancela os efeitos iniciados.

Com prefers-reduced-motion ativo, nenhuma entrada animada é iniciada e as microinterações de movimento ficam desativadas. Se a preferência mudar durante a execução, os efeitos são cancelados imediatamente. Não foram adicionados listeners de scroll/mousemove ou bibliotecas. Foram aplicados os princípios ECC de movimento curto, atenção à leitura, animação sem alterar layout e respeito à preferência de acessibilidade, adaptados ao HTML/JS existente, sem introduzir React.

## Verificação

Antes: `node scripts/verificar-landing-local.mjs` passou nos nove grupos existentes. Resultado salvo em `.cache/landing-before-animacoes/testes-iniciais.json`.

Depois: o mesmo comando passou nos mesmos nove grupos, sem erro JavaScript. Os sete tamanhos são 1440×900, 1903×945, 2560×1080, 1024×768, 768×800, 390×844 e 320×640.

A verificação adicional está em `scripts/verificar-animacoes-landing.mjs`: passaram 36 cenários. Exercita esses sete tamanhos em modo normal, movimento reduzido, JavaScript desativado, IntersectionObserver ausente e falha simulada da API de animação, além de mudar a preferência durante a execução. Evidências em `.cache/landing-review/animacoes/`. A inspeção da captura desktop confirmou o estado final dos serviços sem deslocamentos persistentes.

As verificações locais não validam Firebase, autenticação, IA ou e-mail. Avaliação estética e teste em aparelho físico continuam recomendados.

## Reverter somente esta rodada

Backup anterior em `.cache/landing-before-animacoes/`: index.html e landing.css. O CSS da landing não foi alterado por esta rodada.

Se não houver alterações posteriores no HTML, recuperar o index.html dessa cópia e remover somente os dois arquivos animacoes-scroll.css e animacoes-scroll.js. Se houver alterações posteriores, remover apenas as duas referências adicionadas no head do HTML, preservando o restante. O script de teste e este relatório podem ser removidos separadamente, se desejado. Não usar git reset/clean global nem mexer no stash.

Nenhum commit, push, deploy ou edição remota foi realizado. WhatsApp, functions, regras do Firestore, autenticação, IA/Gemini e Figma remoto não foram alterados nesta rodada.
