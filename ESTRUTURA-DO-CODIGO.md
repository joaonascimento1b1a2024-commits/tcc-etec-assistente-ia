# Organização do código

## Como ler os arquivos

- **HTML:** estrutura e conteúdo das telas; os comentários identificam navegação, formulários e áreas preenchidas pelo JavaScript.
- **CSS:** aparência, estados dos controles e adaptação a outras larguras. A ordem das regras foi preservada porque ela influencia o resultado visual.
- **JavaScript:** conexão e estado da página, funções auxiliares e eventos de interação. Os comentários destacam autenticação, persistência, permissões e tratamento de falhas.
- **JSON:** arquivos de configuração não aceitam comentários. Sua finalidade está descrita abaixo, sem adicionar campos ou comentários inválidos.

## Telas e responsabilidades

| Pasta/arquivo | Responsabilidade |
| --- | --- |
| `public/index.html` e `Landing-Page/` | Apresentação pública e entrada para o login. `script.js` ainda é reservado, sem comportamento ativo. |
| `public/Pagina-Inicial/` | Apresentação dos benefícios com uma prévia estática do chat. |
| `public/Login/` | Acesso por senha ou Google, persistência da sessão e recuperação de senha. |
| `public/Criar-Conta/` | Criação da identidade no Authentication e gravação do perfil no Firestore. |
| `public/Logado/acesso.js` | Consulta o cargo no servidor e determina o destino das configurações. |
| `public/Logado/Home/` | Perfil, saudação, sugestões e envio de mensagens para o histórico da conta. |
| `public/Logado/Conversas/` | Lista e gerenciamento do histórico. `conversation-store.js` concentra as operações no Firestore usadas também pela Home. |
| `public/Logado/Avisos/` | Consulta e exibição dos avisos publicados pelos administradores. |
| `public/Logado/Serviços/` | Encaminhamento ao WhatsApp, condicionado à configuração do número real. |
| `public/Logado/Configurações Aluno/` | Perfil, segurança, preferências e saída. O JavaScript e o CSS também são usados pela versão administrativa. |
| `public/Logado/Configurações Administrador/` | Acrescenta formulários para publicar avisos e promover pessoas. Não substitui as verificações de segurança do banco. |

## Servidor, segurança e testes

- `firestore.rules`: autoriza as operações sobre perfis, conversas, avisos e administradores. O cargo não vem de campos editáveis em `users`.
- `functions/src/index.ts`: entrada das Cloud Functions; atualmente define apenas o limite de instâncias, sem endpoints de IA ou envio de e-mails.
- `tests/admin-routing.test.mjs`: verifica os redirecionamentos com sessão e interface simuladas, sem acessar o Firebase.
- `tests/admin-rules.test.mjs`: exercita as regras nos emuladores locais, usando um projeto `demo-`, sem dados de produção.
- `ADMINISTRADORES.md`: instruções para publicar as regras, cadastrar o primeiro administrador e executar os testes.

## Arquivos de configuração

- `firebase.json`: configura Firestore, Hosting, Functions e emuladores do projeto.
- `firebase.admin.test.json`: emuladores com portas dedicadas aos testes administrativos.
- `firestore.indexes.json`: índices e ajustes de indexação do Firestore.
- `package.json`: identificação e comandos do projeto principal; o comando `test` ainda é o marcador original, não a suíte administrativa.
- `functions/package.json`: dependências e comandos específicos das Cloud Functions.
- `functions/tsconfig.json` e `tsconfig.dev.json`: compilação e análise do código TypeScript do servidor.
- `functions/.eslintrc.js`: regras de qualidade e estilo das Cloud Functions.
- `.prettierrc.json`: formatação consistente; quatro espaços no site e dois nas Functions, respeitando o padrão existente do servidor.
- `skills-lock.json` e arquivos de lock de dependências: registros gerados por ferramentas; não fazem parte da lógica do site e não devem receber comentários manuais.

## Cuidados na manutenção

- Não grave senhas nem chaves administrativas no código público ou no Firestore.
- Mantenha IDs e classes usados pelos scripts ao editar o HTML.
- Os caminhos com espaços e acentos fazem parte dos links existentes; não foram renomeados nesta organização.
- Algumas integrações continuam pendentes: IA, disparo de e-mails e número do WhatsApp. Comentários explicam essas limitações sem simular funcionalidades inexistentes.
- No cadastro por senha, o formulário usa `novalidate`; a validação do aceite dos termos ainda precisa ser implementada no JavaScript. Esta organização apenas documenta o comportamento existente.
