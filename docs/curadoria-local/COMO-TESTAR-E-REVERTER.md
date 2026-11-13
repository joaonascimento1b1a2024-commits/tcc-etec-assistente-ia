# Testar e reverter a bancada local

Execute a partir de `C:\Programação\tcc-etec-assistente-ia`. Estes comandos não iniciam servidor nem acessam Firebase.

## Verificações sem chamadas pagas/externas

```powershell
node scripts/verificar-curadoria-local.mjs
node scripts/avaliar-curadoria-local.mjs
```

O primeiro executa as 260 regressões estabelecidas e os 24 testes novos. O segundo confere 56 cenários de política/recuperação, usando os vetores em cache quando disponíveis. A saída é rotulada: não é uma avaliação de 56 respostas geradas pelo Gemini.

Os scripts de conferência e construção representam um snapshot de 12/11/2026. Não são uma rotina automática para aprovar futuras alterações nas fontes.

Para uma futura confirmação de AL: registrar a resposta do setor competente, data e evidência local anonimizada com hash em `confirmacoes/`; preencher `quemConfirmou.tipo = secretaria`, `setor = Secretaria Acadêmica` e a data. A revisão humana deve conferir a evidência antes de mudar para `aprovado`, incrementar a versão, ajustar as expectativas e refazer o índice. O arquivo não pode conter nomes de menores ou contatos pessoais. A entrega não realizou nenhuma dessas aprovações. Um caminho e um hash são rastreabilidade, não uma prova automática de autoridade.

## Consulta real isolada

```powershell
node scripts/consultar-curadoria-local.mjs "Preciso de quantos % de presença?"
```

Essa consulta usa a chave já existente no backend, somente no processo Node; consome cota do Gemini e pode usar embeddings. Não grava conversa, não importa dados no Firebase e não liga o RAG no chat. As perguntas informais ainda não confirmadas têm encaminhamento cauteloso. Em falha do provedor, o texto informa que não foi possível concluir, sem inventar uma resposta.

Configuração opcional do processo de teste:

```powershell
$env:SYLVINHO_GEMINI_MODEL = 'gemini-3-flash-preview'
$env:SYLVINHO_GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash'
$env:SYLVINHO_EMBEDDING_MODEL = 'gemini-embedding-001'
```

Nenhuma variável global da máquina, `.env` ou chave foi alterada pela entrega. Trocar o modelo de embeddings exige refazer o índice; os espaços vetoriais não são intercambiáveis. Fonte ou resposta alterada também invalida o hash do índice. As consultas vetorizadas são reutilizadas quando o modelo e o texto não mudam.

## Reversão desta rodada

O backup anterior está em `C:\Programação\Backups\sylvinho-curadoria-2026-11-12T13-05-13-515Z`.

Primeiro veja a lista completa em `manifesto-entrega.json`. Para conferir os hashes e mostrar o plano, sem remover nada:

```powershell
node scripts/reverter-curadoria-local.mjs
```

Somente se você decidir reverter, execute:

```powershell
node scripts/reverter-curadoria-local.mjs --aplicar
```

O script compara todos os hashes antes de agir. Se você editou algum arquivo depois da entrega, ele para; nesse caso, faça a comparação e reversão manual para preservar seu trabalho. Ele restaura apenas o handler ao backup desta rodada e remove os arquivos novos listados, incluindo os caches desta experiência. Não remove diretórios, não altera o stash e não usa operações Git destrutivas. O backup fica preservado.

Depois de uma reversão aplicada, execute `npm.cmd run build` dentro de `functions/` para regenerar o JavaScript compilado a partir do TypeScript restaurado.

Rodar novamente os verificadores muda os relatórios e seus hashes. Nesse caso, revise os resultados e gere um novo manifesto com `node scripts/registrar-entrega-curadoria.mjs` antes de usar a reversão automática. Não regenere o manifesto para apagar alterações suas sem antes revisá-las.

**Nenhuma reversão foi executada na entrega.** O estado anterior do chat e os 290 trechos continuam preservados; ativar a composição no chat depende de uma instrução específica posterior.
