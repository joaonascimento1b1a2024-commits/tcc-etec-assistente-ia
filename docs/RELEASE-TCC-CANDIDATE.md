# Candidata do TCC — release/tcc-candidate

Versão de revisão do grupo, preparada após a aprovação da interface e do ensaio local de IA pelo usuário em 12/11/2026. Base: `main` em `156c88abfa950a85085d9e4a5501b7e6729db605`. O commit e o envio são exclusivamente na branch `release/tcc-candidate`; merge na main e deploy Firebase ficam para autorização posterior.

## Conteúdo

Landing e identidade existentes, fontes locais, melhorias de conta/avisos/histórico, chat com estado de envio e retry manual, referências legíveis, layout móvel, gaveta acessível, recolhimento desktop e navegação entre páginas sem salto. Inclui o adaptador RAG/Gemini curado local, filtros de evidência/escopo, contexto de conversa e cache segregado por conta. Não houve migração de framework.

As fontes de testes automatizados, perguntas sintéticas e casos de avaliação fazem parte do código de verificação. Dados temporários de execuções, logs, resultados JSON da curadoria, manifestos de backups, `.cache`, SDK baixado, dependências, Functions compiladas e credenciais ficam fora do commit. Perguntas institucionais e registros aprovados/em revisão são fontes editoriais versionadas; entradas pendentes continuam inelegíveis para resposta.

## Verificação da candidata

- Regressão selecionada atual: 363 testes aprovados, zero falhas. Usado o filtro histórico `formato real gerado`; o runner desta rodada informou zero casos pulados. Não representa a suíte inteira do repositório.
- Build e lint de Functions aprovados na preparação da candidata.
- Evidências anteriores desta versão: 12 combinações de primeira pintura/navegação, 69 verificações de layout em 13 páginas, 51 cenários responsivos, oito cenários de teclado móvel simulado e testes reais de autorização nos emuladores. Não somar conjuntos sobrepostos.
- Ensaio real antes da aprovação: uma pergunta gerada e revisada pelo Gemini principal em 3.063 ms com busca híbrida; histórico preservado após recarga e pedido sem token bloqueado com 401. Não é garantia de disponibilidade, precisão geral ou latência universal.
- Varredura das alterações sem novo segredo reconhecido pelos padrões revisados. As configurações públicas Firebase já existentes no frontend foram comparadas ao commit-base e não foram confundidas com chave Gemini ou credencial Admin.

## Ambientes e limites

A prévia em `localhost:4173` usa fixtures. O chat real avaliado usa `127.0.0.1:5000`, adaptador 5002, Auth/Firestore emulados e projeto `demo-sylvinho-render-poc`. A chave Gemini permanece somente no ambiente local. O SDK oficial foi espelhado exclusivamente no staging ignorado para contornar o bloqueio de rede desta sessão; não é servido pela aplicação de produção.

O RAG curado e o espelhamento do SDK ainda são composição local; este commit não conecta automaticamente o frontend publicado a esse adaptador. A inicialização da IA e alguns ensaios dependem do backend complementar, de fontes/caches documentais locais e da configuração de emuladores. Não incluir esses dados ignorados só para fazer um clone parecer autossuficiente.

Continuam pendentes: aparelho físico/Safari/leitor de tela, avaliação independente de 50 respostas reais (rodada anterior parcial), confirmações da Secretaria, decisão sobre imagens claras, revisão do grupo e futura preparação de publicação. As artes claras foram adiadas. Nenhuma dessas pendências foi declarada homologada.

## Referências

- [Estado consolidado e continuidade](RELATORIO-CONSOLIDADO-SYLVINHO-2026-11-12.md).
- [Navegação desktop](NAVEGACAO-DESKTOP-SUAVE-LOCAL.md).
- [Fechamento móvel e permissões](FECHAMENTO-MOBILE-E-VALIDACAO-LOCAL.md).
- [Ensaio real e reativação da IA](REATIVACAO-IA-CANDIDATA-LOCAL.md).

Para revisar a candidata, comparar a branch com a base acima. Não aplicar reversores de rodadas locais a um clone sem conferir seus manifestos e backups externos. O identificador exato do commit deve ser obtido do Git, sem depender deste documento para um hash autorreferente.
