import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const source=readFileSync(new URL('../public/Logado/Home/resposta-documental-view.js',import.meta.url),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);
const {analisar,renderizar}=context.apresentacaoDocumental;
const intro='Trechos documentais relacionados a pergunta (citacoes, nao uma interpretacao ou garantia de regra vigente):';
const quote='A frequência mínima é de 75% conforme a disposição documental de teste.';
const reference='Regimento Comum; documento: doc-teste; trecho: chunk-teste; secao: artigo 83; pagina 26';
const response=(n=1)=>intro+Array.from({length:n},(_,i)=>`\n\n${i+1}. Trecho documental: "${quote}"\nFonte: ${reference}.`).join('');
test('resposta gerada aparece antes do aviso e as fontes ficam em details',()=>{
 const c=container();
 const natural='A frequência mínima é de 75%.';
 assert.equal(renderizar(c,'Resposta gerada por IA; confira as fontes oficiais.\n\n'+natural+'\n\n'+response()),true);
 assert.equal(c.children[0].className,'documental-resposta-ia');
 assert.equal(c.children[0].textContent,natural);
 assert.equal(c.children[1].textContent,'Resposta gerada por IA; confira as fontes oficiais.');
 assert.equal(c.children[2].tagName,'details');
 assert.equal(c.children[2].children[0].textContent,'Ver fontes');
});
class Element {
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.className='';this.raw='';this.classList={add:name=>{this.className+=' '+name}};}
 set textContent(value){this.raw=String(value);this.children=[];}
 get textContent(){return this.raw+this.children.map(c=>c.textContent).join('');}
 append(...children){this.children.push(...children);}
}
const container=()=>{const doc={createElement(tag){return new Element(tag,doc)}};return doc.createElement('div')};
const walk=e=>[e,...e.children.flatMap(walk)];
test('fonte legivel usa apenas titulo secao pagina e oculta IDs principais',()=>{const r=analisar(response());assert.equal(r.citacoes[0].texto,quote);assert.equal(r.citacoes[0].fonte,'Regimento Comum — artigo 83 — página 26');assert.doesNotMatch(r.citacoes[0].fonte,/doc-teste|chunk-teste/);});
test('tres citacoes: uma visivel por padrao, demais em details nativos',()=>{const c=container();renderizar(c,response(3));assert.equal(c.children.filter(x=>x.tagName==='figure').length,1);const details=c.children.filter(x=>x.tagName==='details');assert.equal(details.length,2);assert.equal(details[0].children.filter(x=>x.tagName==='figure').length,2);assert.equal(details[0].children[0].tagName,'summary');assert.equal(details[1].children[1].textContent,response(3));});
test('texto original e referencias completas preservados sem regravacao',()=>{const original=response();const c=container();assert.equal(renderizar(c,original),true);assert.equal(c.children.at(-1).children.at(-1).textContent,original);});
test('CRLF preservado literalmente nas citacoes e original',()=>{const original=response().replaceAll(quote,quote+'\nLinha literal.').replaceAll('\n','\r\n');const r=analisar(original);assert.equal(r.citacoes[0].texto,quote+'\r\nLinha literal.');const c=container();renderizar(c,original);assert.equal(c.children.at(-1).children.at(-1).textContent,original);});
test('recusas e mensagens comuns usam fallback integral',()=>{for(const text of ['Olá!','Nao ha informacao suficiente na base consultada. Procure a secretaria.','texto\ncom quebras']){const c=container();assert.equal(renderizar(c,text),false);assert.equal(c.textContent,text);assert.equal(c.children.length,0);}});
test('formatos incompletos desconhecidos ou ambiguos usam fallback integral',()=>{for(const text of [response().replace('1. Trecho','2. Trecho'),response()+'\nextra',response().replace('pagina 26','link: inventado'),response().replace('Regimento Comum;','Título; parte ambígua;'),response().replace('Fonte:','Referência:'),'x'.repeat(10000),response().replace(quote,'x'.repeat(481))]){const c=container();assert.equal(renderizar(c,text),false);assert.equal(c.textContent,text);}});
test('intervalos e paginas parciais nao viram paginas exatas inventadas',()=>{for(const [page,label]of [['paginas 25-26 (intervalo do chunk)','páginas 25-26 (intervalo do chunk)'],['pagina inicial 25','página inicial 25'],['pagina final 26','página final 26']])assert.ok(analisar(response().replace('pagina 26',page)).citacoes[0].fonte.endsWith(label));});
test('metadados ausentes nao sao preenchidos',()=>{const text=response().replace(reference,'Título disponível; trecho: chunk-teste');assert.equal(analisar(text).citacoes[0].fonte,'Título disponível');});
test('modelo nao normativo e identificado sem reinterpretacao',()=>{const text=response().replace('Trecho documental:','Modelo/exemplo, nao normativo:');assert.equal(analisar(text).citacoes[0].tipo,'Modelo/exemplo, nao normativo');});
test('HTML malicioso permanece texto e nao cria elementos executaveis',()=>{const attack='<img src=x onerror=alert(1)><script>alert(1)</script>';const c=container();renderizar(c,response().replace(quote,attack));assert.equal(walk(c).some(e=>['script','img','a'].includes(e.tagName)),false);assert.ok(c.textContent.includes(attack));assert.doesNotMatch(source,/innerHTML|insertAdjacentHTML|eval\(/);});
test('formato real gerado a partir da amostra oficial local e reconhecido',()=>{const require=createRequire(import.meta.url);const {gerarRespostaDocumental}=require('../functions/lib/assistente/resposta-documental.js');const {selecionarDocumentosOriginais}=require('../functions/lib/rag/recuperacao.js');const docs=JSON.parse(readFileSync(new URL('./dados/rag-original.json',import.meta.url))).documentos;for(const question of ['Qual a frequência mínima para aprovação?','Como solicitar uma declaração escolar?']){const result=gerarRespostaDocumental(question,selecionarDocumentosOriginais(docs,question));assert.equal(result.status,'trechos_encontrados');const parsed=analisar(result.resposta);assert.ok(parsed);assert.equal(parsed.citacoes.length,result.citacoes.length);parsed.citacoes.forEach((c,i)=>assert.equal(c.texto,result.citacoes[i].texto));}});
test('Home so formata bot; ordem de scripts garante modulo disponivel',()=>{const home=readFileSync(new URL('../public/Logado/Home/home.js',import.meta.url),'utf8');const html=readFileSync(new URL('../public/Logado/Home/home.html',import.meta.url),'utf8');assert.match(home,/sender === 'bot' && globalThis.apresentacaoDocumental/);assert.ok(html.indexOf('src="resposta-documental-view.js"')<html.indexOf('src="home.js"'));});

test('hierarquia extensa fica nos detalhes e nao sobrecarrega fonte principal',()=>{const hierarchy='SEÇÃO DOCUMENTAL > '.repeat(10)+'Artigo 83';const original=response().replace('secao: artigo 83','secao: '+hierarchy);assert.equal(analisar(original).citacoes[0].fonte,'Regimento Comum — página 26');const c=container();renderizar(c,original);assert.equal(c.children.at(-1).children.at(-1).textContent,original);});
