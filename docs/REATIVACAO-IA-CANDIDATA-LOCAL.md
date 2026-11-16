# IA reativada para avaliação da candidata — 12/11/2026

Após autorização do usuário, o chat real local foi reativado para avaliação antes do commit em branch separada. A aprovação do funcionamento pelo usuário ainda antecede a preparação/envio de `release/tcc-candidate`, conforme a sequência combinada.

## Estado verificado

- Auth emulado em 9099, Firestore emulado em 8080, Hosting emulado em 5000; projeto `demo-sylvinho-render-poc`.
- Adaptador em 5002, health HTTP 200, modo `gemini-rag-curado-local`, modelo principal `gemini-3-flash-preview`, reserva configurada `gemini-2.5-flash`, 44 entradas curadas carregadas.
- URL para teste: `http://127.0.0.1:5000/Logado/Home/home.html`.
- Conta anônima exclusiva do emulador. Não representa a conta/histórico de produção.

## Ensaio real pequeno

Pergunta: “Qual é o horário geral de funcionamento da escola?”

Resposta recebida: “A escola funciona de segunda a sexta-feira, das 07h às 23h. A Secretaria confirma seu próprio horário de atendimento.”

Os eventos registraram duas chamadas de geração/revisão ao modelo principal e resultado `gemini_curado`, modo `hibrido`, em 3.063 ms. Trata-se de uma amostra de uma pergunta, não de latência geral garantida ou avaliação factual ampla. A geração real depende da cota disponível.

Após recarregar, a pergunta e a resposta permaneceram no histórico emulado, sem nova pergunta duplicada, e o campo voltou ativo. Pedido HTTP sem token recebeu 401. A ferramenta de clique informou timeout, mas a observação seguinte e os eventos confirmaram que o envio havia ocorrido e sido concluído; não foi repetido.

## SDK e isolamento

O navegador do ambiente bloqueava os arquivos públicos do SDK Firebase. Foram obtidos os três módulos oficiais 10.12.5 em `www.gstatic.com`, com autorização da ferramenta de rede, e guardados em `.cache/firebase-sdk-10.12.5/`.

Somente a cópia ignorada em `.cache/local-e2e/public/` passou a apontar esses imports para `/__firebase_sdk__/10.12.5/`. O código em `public/` não foi modificado para usar o SDK local. Nenhuma dependência foi instalada e nenhuma credencial foi copiada para o frontend ou relatório. O processo dos emuladores usa guarda de rede local; o adaptador tem acesso à API Gemini para a geração solicitada.

O staging foi atualizado com a interface atual, incluindo a correção de navegação desktop. A prévia visual em 4173 continua separada e usa fixtures; ela não é a URL para testar a IA.

## Git e próximos passos

Verificado ao finalizar: branch atual `main`, último commit `156c88a`. Nenhum novo commit, branch, push, merge ou deploy foi feito nesta etapa. Os processos locais ficaram ativos para o usuário experimentar.

Após aprovação explícita do teste local pelo usuário: revisar diff e arquivos elegíveis, excluir segredos/caches/backups/dados de teste do commit, criar `release/tcc-candidate`, commitar e enviar somente essa branch. Não integrar na main nem publicar Firebase sem autorização posterior.
