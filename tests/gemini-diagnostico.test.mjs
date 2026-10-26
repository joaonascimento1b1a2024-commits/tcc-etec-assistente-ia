import test from 'node:test';
import assert from 'node:assert/strict';
import {criarClienteGemini} from '../functions/lib/assistente/geracao/gemini.js';

for (const [status, codigo] of [[400,'REQUISICAO_INVALIDA'],[401,'CREDENCIAL_RECUSADA'],[403,'ACESSO_NEGADO'],[404,'MODELO_OU_ROTA_INDISPONIVEL'],[429,'COTA_OU_TAXA'],[503,'HTTP_PROVEDOR']]) {
    test('HTTP '+status+' produz diagnostico sanitizado e erro generico', async () => {
        const events=[];
        const cliente=criarClienteGemini('modelo-ficticio',()=> 'chave-ficticia',async()=>new Response('DETALHE_PRIVADO',{status}),undefined,e=>events.push(e));
        await assert.rejects(cliente.moderar('pergunta-ficticia',new AbortController().signal),/^Error: GEMINI_INDISPONIVEL$/);
        assert.deepEqual(events,[{codigo,statusHttp:status}]);
    });
}
test('chave ausente bloqueia rede e identifica etapa',async()=>{
    const events=[];
    const c=criarClienteGemini('modelo-ficticio',()=>'',()=>assert.fail(),undefined,e=>events.push(e));
    await assert.rejects(c.moderar('ficticia',new AbortController().signal));
    assert.deepEqual(events,[{codigo:'CHAVE_AUSENTE_OU_INVALIDA'}]);
});
test('HTTP 200 com JSON invalido nao e resposta bem sucedida',async()=>{
    const events=[];
    const c=criarClienteGemini('modelo-ficticio',()=>'ficticia',async()=>new Response('invalido'),undefined,e=>events.push(e));
    await assert.rejects(c.responderGeral('ficticia',new AbortController().signal));
    assert.deepEqual(events,[{codigo:'FORMATO',statusHttp:200}]);
});
test('falha do coletor nao descarta resposta valida',async()=>{
    const c=criarClienteGemini('modelo-ficticio',()=>'ficticia',async()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:'{"segura":true}'}]}}]})),undefined,()=>{throw Error('coletor');});
    assert.equal(await c.moderar('ficticia',new AbortController().signal),true);
});

test('replay entre instancias e identificado depois da transacao',async()=>{
    const {adicionarRespostaBot}=await import('../functions/lib/assistente/handler.js');
    const mid='message-ficticia-000001', pergunta='Pergunta ficticia';
    const ref={};let replays=0;
    const firestore={async runTransaction(fn){return fn({get:async()=>({exists:true,data:()=>({mensagens:[{remetente:'user',texto:pergunta,messageId:mid},{remetente:'bot',texto:'Resposta anterior ficticia',messageId:mid}]})}),update:()=>assert.fail()});}};
    const result=await adicionarRespostaBot(ref,'Nova resposta ficticia',{firestore,serverTimestamp:()=>assert.fail()},mid,pergunta,()=>replays++);
    assert.equal(result,'Resposta anterior ficticia');assert.equal(replays,1);
});
