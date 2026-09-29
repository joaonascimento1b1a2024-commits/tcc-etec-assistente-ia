# Acesso de aluno e administrador

O site usa o Firebase Authentication para identificar a pessoa e o Cloud Firestore para consultar seu cargo. A Home, conversas, avisos e serviços são compartilhados. As configurações encaminham automaticamente para a versão de aluno ou administrador, inclusive quando alguém abre o endereço da outra versão.

## Antes de usar

1. Publique as regras de `firestore.rules` no **Firestore Database → Rules → Publish**, substituindo as regras anteriores deste projeto. Não use regras de teste que liberam todo o banco.
2. Publique também os arquivos atualizados de `public` se estiver usando o site hospedado. Alterar os arquivos locais não atualiza automaticamente o Firebase.
3. Não é necessário publicar Cloud Functions para estas funcionalidades. Não publicamos alterações nem promovemos contas automaticamente durante o desenvolvimento.

Alternativa pelo terminal, dentro da pasta do projeto, após conferir a conta e o projeto selecionados:

```sh
firebase deploy --only firestore:rules,hosting --project tcc-ia-d8891
```

## Cadastrar o primeiro administrador pelo console

1. Peça à pessoa para criar/entrar em sua conta no site e abrir a Home.
2. No console do projeto **tcc-ia-d8891**, abra **Authentication → Users** e copie o **User UID** exato da pessoa. Não use o e-mail como identificador.
3. Em **Firestore Database → Data**, crie a coleção **administradores**.
4. Crie um documento cujo **Document ID** seja esse UID (não use ID automático).
5. Adicione o campo **ativo**, do tipo **boolean**, com valor **true**, e salve.
6. Abra as configurações no site. Se já estiverem abertas, a alteração é acompanhada em tempo real. Recarregue a Home para atualizar seu link de perfil.

Exemplo de caminho: `administradores/UID_COPIADO_DO_AUTHENTICATION`, com `{ ativo: true }`.

O console usa as permissões administrativas do seu projeto Google/Firebase para esta operação. O site não pode cadastrar o primeiro administrador: um aluno tentando criar o próprio documento é bloqueado pelas regras. Dê acesso ao console apenas a pessoas responsáveis pelo projeto.

## Promover pelo site

Nas configurações do administrador, clique em **Promover a administrador**, informe o UID de uma conta existente, busque o perfil, confira o UID e clique em **Confirmar promoção**. A pessoa precisa ter passado pela Home para existir um perfil em `users/{UID}`. Nome/e-mail exibidos vêm do perfil; o UID do Authentication é a referência para escolher a conta.

O site cria `administradores/{UID}` com `ativo: true`, `promovidoPor: UID_DO_ADMIN` e `criadoEm: timestamp do servidor`. As regras validam quem promove, impedem alterar uma permissão existente e não dão ao administrador acesso às conversas privadas de outras contas.

## Revogar ou reativar pelo console

Edite **ativo** para **false** no documento correspondente. As regras passam a negar publicações e promoções; a página de configurações aberta volta para a versão de aluno quando recebe a atualização. Para reativar, altere para **true** no console. Manter o documento com `false` impede reativação pelo formulário do site. Evite desativar o único administrador sem ter acesso ao console.

## Publicar avisos

Em **Criar avisos**, preencha título, categoria e descrição e confirme em **Publicar aviso**. Os avisos usam a coleção `avisos` e aparecem na página já existente. Isso não envia e-mails: o serviço de disparo ainda não foi implementado.

## Segurança e compatibilidade

- A fonte do cargo agora é exclusivamente `administradores/{UID}.ativo`. A antiga verificação de custom claim `admin` foi substituída; se houver administradores definidos por claims, cadastre seus UIDs nesta coleção ao migrar.
- Não coloque `admin`, `cargo` ou `role` em `users/{UID}` esperando conceder acesso. Esse perfil é editável pela própria conta e esses campos são ignorados para autorização.
- Falha ao consultar o cargo bloqueia as configurações; não libera o painel por um valor em cache.
- Somente um administrador ativo pode criar avisos e novas permissões. Alunos só podem consultar o próprio cargo. Administradores podem consultar um perfil por UID para a promoção, mas não listar todos os perfis nem consultar históricos alheios.

Referência do modelo de autorização: https://firebase.google.com/docs/firestore/security/rules-conditions#access_other_documents

## Testar sem acessar produção

Com Firebase CLI, Java e Node instalados, execute na raiz do projeto:

```sh
firebase emulators:exec --config firebase.admin.test.json --only auth,firestore --project demo-etec-rbac 'node tests/admin-rules.test.mjs'
```

Os testes usam portas locais dedicadas e um projeto `demo-`. Cobrem consulta de cargo, bloqueio de auto-promoção, publicação, promoção válida, revogação, rascunhos e isolamento das conversas.

Execute também `node tests/admin-routing.test.mjs` para testar os redirecionamentos e falhas de conexão com sessão e interface simuladas.
