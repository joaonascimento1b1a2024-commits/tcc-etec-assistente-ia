# Fundamentação — Fase A exclusivamente offline

Estes módulos não são importados pelos entrypoints Functions/Render. Não alteram
RAG, frontend, HTTP, autenticação, histórico ou idempotência. Desativados por
padrão, sem SDK de IA, leitura de segredos, rede, retries ou provedor real.
`habilitado: true` habilita SOMENTE a simulação local injetada. `ClienteSimulado`
é uma interface, não um sandbox: um chamador arbitrário poderia implementar
rede; isso não é permitido nesta fase nem autorizado pelas flags deste módulo.

## Contrato estrito

```json
{"versao":1,"afirmacoes":[{"texto":"evidência literal integral","referencias":[{"id":"E1","citacao":"evidência literal integral"}]}]}
```

Máximo de três afirmações, uma referência por afirmação, 480 caracteres por
citação, 6000 por proposta JSON, 2400 na resposta e 1000 na pergunta local.
Entradas estruturais têm limites de profundidade, nós, propriedades e arrays.
Objetos são inspecionados e copiados ANTES de qualquer serialização: undefined,
símbolos, acessores, proxies (inclusive revogados), ciclos, protótipos customizados,
propriedades ocultas, toJSON, números não finitos, arrays esparsos/com extras e
campos de poluição de protótipo são recusados. Getters e toJSON não são executados.
JSON textual é limitado antes do parse e não pode repetir chaves, inclusive com
escapes equivalentes. A cópia validada é desvinculada do objeto do chamador.

E1/E2/E3 são referências internas, associadas aos chunks e metadados originais.
Metadados nunca são aceitos do cliente. Cada afirmação E cada citação devem ser
idênticas à evidência correspondente, sem cortar números, condições, negações ou
exceções. O validador recusa cobertura parcial do conjunto, mas isso NÃO comprova
relação entre evidências. A política de contexto do gateway é uma barreira
separada, necessária antes de chamar o simulador ou aceitar uma proposta.

## Contexto: nenhuma composição de trechos

Não há metadados confiáveis que certifiquem independência ou fechamento normativo
entre chunks. Portanto, citar todos NÃO basta. Múltiplos chunks, múltiplas
citações, recortes de uma unidade maior, modelos, marcadores de remissão,
condição/exceção ou dependências anafóricas detectadas impedem a simulação.
Nessas situações o resultado permanece EXATAMENTE o gerador documental existente.
Não se tenta combinar trechos, reconstruir exceções ou provar relações por prompt.

A única proposta aceitável é o eco literal de UMA citação que corresponda ao
conteúdo INTEGRAL do único chunk recebido, com vínculo de fonte preservado e sem
os marcadores de dependência bloqueados. Mesmo então, a saída final é exatamente
o baseline: não existe reconstrução, seleção parcial ou texto livre do cliente.
Esta prova é de preservação estrutural do contexto VISÍVEL, não de completude de
todo o documento, vigência, ausência de exceções em partes não recuperadas ou
correção semântica de uma paráfrase. A ausência de marcadores não prova autonomia
normativa. Não usar este eco como autorização para gerar interpretações naturais.
Quando não há fechamento local verificável, o gateway retorna ao documental.

As evidências são exclusivamente internas, obtidas do RAG confiável. Uma entrada
arbitrária com um documentoId autorizado não tem sua autenticidade comprovada.
A allowlist protege a seleção; não autentica conteúdo ou metadados fornecidos por
terceiros. As fixtures sintéticas existem apenas no diretório de testes e não
podem ser importadas por entrypoints ou carregadas no Firestore.

## Entradas, falhas e cancelamento

Todas as entradas são copiadas/validadas antes do gerador: no máximo cinco chunks,
8000 caracteres de conteúdo total, IDs/textos/metadados tipados e limitados.
Um chunk malformado invalida a preparação inteira, sem descartar possíveis
condições silenciosamente. A preparação e a validação têm tratamento de falhas.

Com baseline calculado com segurança, falhas do simulador, timeout ou proposta
inválida retornam `{origem: "documental", resposta: baseline.resposta, motivo}`.
Quando a entrada é inválida ou o próprio gerador não pode operar, o resultado é
`{origem: "falha_controlada", resposta: null, motivo}`. Não há resposta inventada
nem conteúdo bruto do erro. Um futuro adaptador HTTP deverá tratar explicitamente
essa união; atualmente nenhum entrypoint utiliza o módulo.

Timeout padrão 10 s, configurável de 1 ms a 30 s; saída solicitada de 2048 tokens.
O timer limita a espera assíncrona, sinaliza AbortSignal e não faz retry. A parada
efetiva depende da cooperação do cliente; não é garantia de cancelamento faturável
nem interrompe JavaScript síncrono bloqueante. Uma resposta tardia é ignorada.
Limites de entrada são aplicados antes do processamento documental; limites de
estrutura e saída também são verificados independentemente do cliente.

## Privacidade e minimização

Detectores PT/EN são heurísticas adicionais, NÃO anonimização. Podem não reconhecer
nomes livres, formatos novos, ofuscação ou instruções adversariais. Não substituem
consentimento, política de tratamento de dados ou análise do provedor.

A pergunta original é usada somente na preparação local. O cliente simulado
recebe uma instrução fixa no campo pergunta, os textos/IDs locais estritamente
necessários e limites. Não recebe UID, tokens, metadados de fontes, IDs de conversa
ou mensagem, histórico completo ou a pergunta original. O pedido declara
`destino: "simulacao_local"` e `envioExternoAutorizado: false`, ferramentas vazias.
Os textos das evidências também podem conter dados pessoais; a minimização não
os torna anônimos. Nenhum texto daqui está autorizado para transmissão externa.
Não há logs de prompts, conteúdo de erros, credenciais ou dados pessoais.

## Validação reproduzível

Com Node 24 e dependências instaladas pelo lockfile de functions:

```powershell
npm --prefix functions ci
npm --prefix functions run build
node --require ./local-e2e/network-guard.cjs --test tests/fundamentacao-offline.test.mjs
npm --prefix functions run lint
```

Nenhuma instalação adicional é necessária. A suíte usa exclusivamente
`tests/fixtures/fundamentacao-sintetica.mjs`, inteiramente inventada para testes.
Não lê tests/dados/rag-original.json, corpus local, Firebase ou credenciais.
Os IDs da allowlist usados pelas fixtures só exercitam o filtro; não representam
proveniência oficial. Percentuais, nomes e procedimentos sintéticos não são normas.
As regressões existentes que dependem de corpus real continuam separadas e não
foram alteradas. A independência do corpus desta suíte pode ser verificada com
bloqueio de leitura de tests/dados/ e .cache/ em memória, sem mover os arquivos.

## Antes de um provedor real

Requer nova autorização, política de privacidade/termos/público-alvo, orçamento,
adaptador isolado, verificação de cancelamento e testes dos contratos HTTP.
A geração natural permanece fora do escopo: igualdade literal não valida
paráfrases nem consistência semântica global. Não há garantia de uma única chamada
faturável entre instâncias; a idempotência persistida existente não foi alterada.
Nenhuma chave, faturamento, configuração de serviço ou publicação é necessária
para testar ou versionar esta arquitetura exclusivamente offline.
