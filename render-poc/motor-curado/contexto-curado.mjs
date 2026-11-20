// Contexto da conversa: entende perguntas de acompanhamento como "e o prazo?" ou "precisa de responsável?".
//
// O chat logado manda as últimas mensagens. Este módulo descobre o ASSUNTO da conversa
// (renovação, trancamento, estágio...) e dados do aluno citados por ele (curso, turno, ano,
// idade), e reescreve a pergunta curta em uma pergunta completa para a busca.
// Ex.: histórico "Como renovo a matrícula?" + pergunta "qual o prazo?" -> "Quando renovo a matrícula?".
//
// Segurança: o contexto vem SOMENTE das mensagens do usuário, nunca das respostas do bot
// (uma resposta errada do bot não pode virar "fato" para a próxima pergunta).

// Normaliza: minúsculas, sem acentos e sem pontuação ("Matrícula?" -> "matricula").
const n = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();

// Assunto da mensagem, por palavras-chave. A ordem importa: "renovação da matrícula" vem antes
// de "matrícula inicial" para que "rematrícula" não seja lida como matrícula nova.
function assunto(s) {
    if (/renov|rematricul/.test(s)) return 'renovação da matrícula';
    if (/transfer/.test(s)) return 'transferência';
    if (/tranc/.test(s)) return 'trancamento';
    if (/cancel/.test(s)) return 'cancelamento';
    if (/declaracao/.test(s)) return 'declaração';
    if (/historico/.test(s)) return 'histórico escolar';
    if (/diploma/.test(s)) return 'diploma';
    if (/atestado/.test(s)) return 'atestado';
    if (/matricul/.test(s)) return 'matrícula inicial';
    if (/estagio/.test(s)) return 'estágio';
    if (/\btcc\b/.test(s)) return 'TCC';
    if (/frequencia|presenca|faltas/.test(s)) return 'frequência mínima';
    if (/dependencia|\bdp\b/.test(s)) return 'dependência';
    if (/recuperacao/.test(s)) return 'recuperação';
    if (/sair.*cedo|saida.*(antecipada|aula)/.test(s)) return 'saída antecipada';
    if (/recesso/.test(s)) return 'recesso escolar';
    if (/vestibulinho/.test(s)) return 'vestibulinho';
    if (/horario.*secretaria|secretaria.*horario/.test(s)) return 'horário da Secretaria';
    if (/horario|funcionamento/.test(s)) return 'horário de funcionamento';
    if (/camiseta|uniforme/.test(s)) return 'uniforme';
    if (/biblioteca/.test(s)) return 'biblioteca';
    return null;
}

// Cursos reconhecidos no texto e o identificador usado em aplicaSe.cursos da base.
const cursos = [
    [/\benfermagem\b/, 'enfermagem'],
    [/\bdesenvolvimento de sistemas\b|\bds\b/, 'desenvolvimento de sistemas'],
    [/\binformatica para internet\b/, 'informatica-para-internet'],
    [/\bmecatronica\b/, 'mecatronica'],
    [/\bmecanica\b/, 'mecanica'],
    [/\badministracao\b/, 'administracao'],
    [/\beletrotecnica\b/, 'eletrotecnica'],
    [/\blogistica\b/, 'logistica'],
];
const curso = s => cursos.find(([r]) => r.test(s))?.[1];

// A mensagem é só a resposta "qual é o seu curso?" ("sou de mecânica", "enfermagem")?
const apenasCurso = s => {
    const padrao = cursos.find(([r]) => r.test(s))?.[0];
    return !!padrao && /^(faco|curso|faco o curso de|sou de|meu curso e|estudo|estudo no curso de)?$/
        .test(s.replace(padrao, '').trim());
};

const turno = s => /noturno|\ba noite\b/.test(s) ? 'noite'
    : /matutino|\bmanha\b/.test(s) ? 'manha'
    : /vespertino|\btarde\b/.test(s) ? 'tarde' : undefined;

// Pedido de fonte/referência ("de onde é isso?", "tem link?").
export const solicitaFonte = s => /\b(de onde|qual o artigo|onde esta|tem link|qual (e )?a (fonte|referencia)|(?:mandar|enviar|passar) o link|onde (posso )?(conferir|consultar|verificar))\b/.test(n(s));

// Mensagem que só faz sentido como continuação ("e ...", "qual o prazo", "onde entrego").
const seguimento = s => /^(e\b|onde (entrego|levo|faco|solicito)|precisa de responsavel|preciso de responsavel|qual (e )?o prazo|quais documentos|qual o artigo|de onde|onde esta|tem link|no meu curso|pode ser online)/.test(s);

// "tenho 16 anos", "meu filho tem 15 anos"...
const idadeNoTexto = t => t.match(/\b(?:tenho|meu filho tem|minha filha tem|o candidato tem|a candidata tem) (\d{1,2}) anos\b/)?.[1];

/**
 * @param {string} pergunta mensagem atual
 * @param {Array<{remetente:'user'|'bot', texto:string}>} historico mensagens anteriores
 * @param {object} escopo dados já conhecidos (curso, turno, ano, idade)
 * @returns {{pergunta?:string, esclarecimento?:string, escopo:object, tema?:string, intencao?:string, usaHistorico?:boolean}}
 *   pergunta = pergunta completa para a busca; esclarecimento = pergunta que o bot deve devolver ao usuário.
 */
export function resolverConversaCurada(pergunta, historico = [], escopo = {}) {
    const atual = n(pergunta);
    let tema = null;      // assunto vigente na conversa
    let anterior = '';    // última mensagem do usuário (normalizada)
    let estado = {};      // curso/turno/ano/idade acumulados

    // 1) Percorre as últimas 12 mensagens DO USUÁRIO, acumulando assunto e dados citados.
    for (const m of historico.slice(-12)) {
        if (m?.remetente !== 'user' || typeof m.texto !== 'string') continue;
        const t = n(m.texto), c = curso(t), a = assunto(t);
        if (c) {
            if (c !== estado.curso) delete estado.turno; // trocou de curso: o turno anterior não vale mais
            estado.curso = c;
        }
        const tr = turno(t), ano = t.match(/\b20\d{2}\b/)?.[0], idade = idadeNoTexto(t);
        if (tr) estado.turno = tr;
        if (ano) estado.ano = Number(ano);
        if (idade) estado.idade = Number(idade);
        // Mensagem com assunto novo troca o tema; mensagem sem assunto que não seja continuação o encerra.
        if (a) tema = a;
        else if (!seguimento(t) && !solicitaFonte(t) && !c && !/^(oi|ola|obrigad[oa]|valeu|\d{1,2} anos)$/.test(t)) tema = null;
        anterior = t;
    }

    // 2) Situações em que a última mensagem do bot foi uma pergunta de esclarecimento.
    const ultimaDoBot = historico.at(-1)?.remetente === 'bot' ? historico.at(-1).texto || '' : '';
    const clarificador = /matrícula inicial ou renovar|matrícula inicial ou renovação/i.test(ultimaDoBot);
    const pediuCurso = /qual é o seu curso/i.test(ultimaDoBot);

    // 3) A mensagem atual tem assunto próprio? É continuação da conversa?
    const direto = assunto(atual), c = curso(atual);
    const retomaCurso = pediuCurso && apenasCurso(atual);
    const follow = seguimento(atual) || solicitaFonte(atual) && !direto ||
        clarificador && /^(renovar|renovacao|rematricula|a inicial|inicial)$/.test(atual) || retomaCurso;
    if (c) {
        if (c !== estado.curso) delete estado.turno;
        estado.curso = c;
    }
    const tr = turno(atual), ano = atual.match(/\b20\d{2}\b/)?.[0], idade = idadeNoTexto(atual);
    if (tr) estado.turno = tr;
    if (ano) estado.ano = Number(ano);
    if (idade) estado.idade = Number(idade);
    // Pergunta nova (não é continuação) é autônoma: curso/ano antigos não a acompanham.
    if (!follow) estado = {...(c ? {curso: c} : {}), ...(tr ? {turno: tr} : {}), ...(ano ? {ano: Number(ano)} : {}), ...(idade ? {idade: Number(idade)} : {})};
    estado = {...estado, ...escopo};
    const temaAtual = direto || (follow ? tema : null);

    // 4) Respostas às perguntas de esclarecimento do próprio bot.
    if (clarificador && /^(renovar|renovacao|rematricula)$/.test(atual))
        return {pergunta: 'Como renovo a matrícula?', escopo: estado, tema: 'renovação da matrícula', usaHistorico: true};
    if (clarificador && /^(a )?inicial$/.test(atual))
        return {pergunta: 'Como fazer a matrícula inicial?', escopo: estado, tema: 'matrícula inicial', usaHistorico: true};
    if (retomaCurso && tema) { // respondeu o curso: refaz a pergunta original agora com o curso
        const original = [...historico].reverse().find(m => m?.remetente === 'user' && assunto(n(m.texto)) === tema)?.texto;
        return {pergunta: original || 'Como funciona ' + tema + '?', escopo: estado, tema, usaHistorico: true};
    }

    // 5) Faltam dados para responder: o bot devolve uma pergunta curta.
    if (/meu curso|minha turma/.test(atual) && !estado.curso) return {esclarecimento: 'Qual é o seu curso?', escopo: estado};
    if (/^(e )?o horario$/.test(atual)) return {esclarecimento: 'Você quer saber o horário da Secretaria ou das aulas?', escopo: estado};
    if (follow && !temaAtual) return {esclarecimento: 'Você quer saber isso sobre matrícula, documentos ou outro assunto?', escopo: estado};

    // 6) Pedido de fonte sobre o assunto anterior: repete a pergunta original para achar o mesmo fato.
    if (solicitaFonte(atual) && !direto && tema) {
        if (/perder|perdi/.test(anterior) && /prazo/.test(anterior) && tema === 'renovação da matrícula')
            return {pergunta: 'Perdi o prazo da renovação, o que faço?', escopo: estado, tema, usaHistorico: true};
        const original = [...historico].reverse().find(m => m?.remetente === 'user' && assunto(n(m.texto)) === tema)?.texto;
        return {pergunta: original || tema, escopo: estado, tema, usaHistorico: true};
    }

    // 7) Intenção da continuação e reescrita da pergunta curta em pergunta completa.
    const intencao = /onde (entrego|levo|faco|solicito)|pode ser online/.test(atual) ? 'canal'
        : /precis[ao] de responsavel/.test(atual) ? 'responsavel'
        : /quais documentos/.test(atual) ? 'documentos'
        : /qual (e )?o prazo/.test(atual) ? 'prazo' : null;
    let consulta = pergunta;
    if (follow && temaAtual && !direto) consulta = pergunta + ' (sobre ' + temaAtual + ')';
    if (/qual o artigo|de onde|onde esta|tem link/.test(atual) && /perder|perdi/.test(anterior) && /prazo/.test(anterior) && tema === 'renovação da matrícula')
        consulta = pergunta + ' (sobre perda do prazo de renovação)';
    if (intencao === 'responsavel' && temaAtual === 'matrícula inicial') consulta = 'Sou menor, posso me matricular sozinho?';
    if (intencao === 'documentos' && temaAtual === 'matrícula inicial') consulta = 'Quais documentos preciso para a matrícula?';
    if (intencao === 'prazo' && temaAtual === 'renovação da matrícula') consulta = 'Quando renovo a matrícula' + (estado.ano ? ' em ' + estado.ano : '') + '?';
    return {pergunta: consulta, escopo: estado, tema: temaAtual, intencao, usaHistorico: follow};
}
