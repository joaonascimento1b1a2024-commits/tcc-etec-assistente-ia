# Fechamento móvel e validação local — 12/11/2026

A tela móvel foi corrigida localmente nas rodadas anteriores. Esta rodada ampliou a verificação e corrigiu também a gaveta: ela ainda usava a altura inteira da janela de layout quando o teclado reduzia apenas a janela visual.

## Correção final da gaveta

`public/Logado/shell.css` agora limita a altura da lateral à altura visual disponível, com fallback para `100dvh`. Mantém rolagem interna e funcionamento nas demais telas. A mudança vale também no desktop com altura visual configurada, sem mudar a largura ou a animação de recolhimento.

O verificador `scripts/verificar-celular-local.mjs` passou a abrir a gaveta com teclado simulado, conferir altura, foco e acesso ao botão Fechar menu, além de voltar ao campo via Escape. Antes desta correção, três casos da Home falharam; o visitante e os demais cenários continuaram passando. Depois, os oito cenários passaram, sem erros JavaScript. Falhas anteriores preservadas em `.cache/mobile-final-2026-11-12/gaveta-before.json`; resultado atual em `.cache/mobile-continuacao-2026-11-12/result.json`.

Isso complementa a remoção da altura mínima conflitante, o suporte de altura visual no toque horizontal, o limite de texto multilinha e a compactação do chat visitante já documentados em [celular e verificações](CELULAR-E-VERIFICACOES-LOCAIS.md). As imagens seguem adiadas. A lateral expandida/recolhida continua em 196/76 px.

## Verificações desta rodada

- Oito cenários móveis de teclado simulado, incluindo gaveta/foco: passaram.
- 69 verificações de layout em 13 páginas: passaram, sem erros JavaScript nem requisições externas.
- 185 testes selecionados de cliente, Home, referências, sessão, autenticação, isolamento do bootstrap, histórico, pendências, avisos, contexto/cache, curadoria e visitante: passaram, zero falhas. Log em `.cache/mobile-final-2026-11-12/regressao.log`.
- `npm.cmd run build` e `npm.cmd run lint` de Functions: passaram nesta rodada.
- Testes reais das regras administrativas: passaram no Auth/Firestore Emulator, projeto `demo-etec-rbac`. Confirmado bloqueio de conversa alheia inclusive para administrador. Log em `.cache/mobile-continuacao-2026-11-12/admin-rules.log`.

Os 51 cenários responsivos e 56 casos offline de recuperação passaram na rodada móvel anterior. Não são 51/56 respostas Gemini nem testes de produção. Os conjuntos de testes se sobrepõem; não somar como cobertura independente.

## Pendência do emulador resolvida

Foi encontrada uma cópia já existente do JAR em `.cache/local-e2e/emulator-artifacts/`. A CLI foi executada usando `FIREBASE_EMULATORS_PATH` nesse diretório e configuração vazia dentro do workspace. Não houve download, leitura de credenciais ou mudança de regras.

Assim, o bloqueio de disponibilidade do Firestore Emulator relatado na rodada anterior foi resolvido para o teste de regras. Os processos usados pelo ensaio foram encerrados pela CLI ao concluir.

## Ensaio de contas no navegador: inconclusivo

Criado `scripts/verificar-contas-emuladas.mjs`, voltado ao staging produzido por `local-e2e/prepare-auth.mjs`. Cobre cadastro, login, histórico por conta, recarga, navegação móvel para configurações, tema, logout, tentativa de acesso entre contas e solicitação de recuperação exclusivamente no emulador. Não chama IA, envia e-mail real ou usa contas de produção. Rotas externas são bloqueadas, exceto os arquivos públicos do SDK Firebase 10.12.5 usados pela aplicação.

O ensaio foi iniciado com Auth/Firestore/Hosting locais no projeto `demo-sylvinho-render-poc`, mas não chegou aos fluxos: o SDK público em `www.gstatic.com` está bloqueado pela rede do ambiente. Uma verificação isolada do endereço confirmou `net::ERR_NETWORK_ACCESS_DENIED`. O timeout inicial não comprova falha de autenticação do produto. Evidências em `.cache/mobile-final-2026-11-12/contas-failure.json` e `contas.log`. O verificador passou a registrar também falhas de rede para facilitar a próxima execução.

Não foi substituído o SDK por uma simulação para declarar esse ensaio aprovado. Os 185 testes locais e os testes reais de regras possuem resultados próprios; não comprovam o percurso completo de login no navegador.

## O que ainda depende de condição externa

- Aparelho físico, teclado real e Safari: sem dispositivo disponível nesta sessão. A simulação não certifica gestos nativos, deslocamento visual do Safari ou leitor de tela.
- Fluxos completos de contas no navegador: permitir acesso aos arquivos públicos do SDK Firebase ou fornecer cópia local fiel para o staging.
- Avaliação Gemini: permanece com duas respostas anteriores e 48 pendentes, sem novo orçamento/cota definido; nenhuma chamada feita nesta rodada.
- Conteúdo institucional: depende das confirmações da Secretaria. Nenhuma pendência foi preenchida por suposição.
- Aprovação visual final do usuário: ainda não registrada. Imagens adiadas explicitamente. Sem commit, push, deploy ou alteração no Figma.

O resultado móvel está nos arquivos locais servidos pela prévia de fixtures em `http://localhost:4173/Logado/Home/home.html`; não foi publicado no endereço de produção.

## Preservação e revisão

Backup imediatamente anterior desta rodada: `.cache/mobile-final-2026-11-12/shell.before.css`. Os backups da rodada móvel anterior permanecem em sua pasta e não foram substituídos; seu manifesto continua registrando os hashes daquela entrega, não da versão posterior. Comparar os arquivos antes de restaurar. Não usar reset ou limpeza ampla.

Autoavaliação: precisão 4/5 (reprodução antes/depois e regras reais; sem aparelho físico), completude 4/5 (trabalho local concluído, integração web impedida pela rede), clareza 4/5 (limites e histórico separados), utilidade 4/5 (ensaios reproduzíveis, dependência externa explícita), concisão 4/5 (detalhes mantidos para continuidade). Média 4,0/5. Próximas melhorias com maior impacto: validar aparelho físico e concluir o percurso de contas quando o SDK estiver acessível.
