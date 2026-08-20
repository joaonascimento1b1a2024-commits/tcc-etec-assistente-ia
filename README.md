# 🤖 Projeto Sylvinho

## Sobre o Projeto

O **Projeto Sylvinho** é uma plataforma web desenvolvida como Trabalho de Conclusão de Curso (TCC), com o objetivo de utilizar **Inteligência Artificial** para auxiliar no atendimento da secretaria acadêmica da ETEC Sylvio de Mattos Carvalho.

O sistema funcionará como um assistente virtual capaz de responder dúvidas relacionadas aos procedimentos e informações da instituição, utilizando como fonte uma **base de conhecimento composta por documentos e regras oficiais da escola**.

Além do atendimento por IA, a plataforma contará com recursos de autenticação, histórico de conversas, comunicados institucionais e gerenciamento de perfil.

## 🎯 Objetivo

Desenvolver uma plataforma de atendimento automatizado que facilite o acesso dos alunos, responsáveis, professores e demais usuários às informações da secretaria, reduzindo a necessidade de atendimento presencial para dúvidas recorrentes e disponibilizando informações de forma rápida e organizada.

A IA será desenvolvida para trabalhar especificamente com informações da instituição, evitando que o sistema funcione apenas como um chatbot genérico.

## 🧠 Inteligência Artificial

O sistema utilizará a técnica de **RAG (Retrieval-Augmented Generation)**.

O funcionamento básico será:

```text
Usuário
   ↓
Pergunta
   ↓
Sistema
   ↓
Busca na base de conhecimento
   ↓
Recuperação das informações relevantes
   ↓
Modelo de Inteligência Artificial
   ↓
Resposta contextualizada
   ↓
Usuário
```

A base de conhecimento conterá informações oficiais da instituição, como regras, procedimentos, comunicados, calendário acadêmico e orientações da secretaria.

## 🗄️ Banco de Dados

O projeto utilizará o **Firebase**, principalmente o **Cloud Firestore**, como banco de dados NoSQL.

O Firestore será utilizado não apenas pela Inteligência Artificial, mas também pelo próprio sistema web.

Entre os dados armazenados estarão:

* Usuários;
* Histórico de conversas;
* Mensagens;
* Comunicados;
* Informações da secretaria;
* Base de conhecimento da IA;
* Preferências dos usuários.

A estrutura será organizada por **coleções, documentos e campos**, aproveitando o modelo NoSQL do Firestore.

## 🔐 Autenticação

O sistema utilizará o **Firebase Authentication** para gerenciamento de usuários.

Serão previstos recursos como:

* Cadastro de usuários;
* Login;
* Recuperação de senha;
* Login com Google;
* Controle de sessão;
* Diferenciação de permissões entre usuários.

## 💬 Funcionalidades

### Chat com Inteligência Artificial

Permite que o usuário envie perguntas sobre procedimentos e informações acadêmicas e receba respostas contextualizadas pela base oficial da instituição.

### Cadastro e Login

Permite a criação de contas e autenticação dos usuários para acesso às funcionalidades personalizadas.

### Histórico de Conversas

Usuários autenticados poderão consultar suas conversas anteriores com o assistente.

### Mural de Avisos

Exibição de comunicados oficiais, eventos, prazos e outras informações importantes disponibilizadas pela secretaria.

### Perfil e Configurações

Permite consultar e alterar informações do perfil, além de configurar preferências como tema da interface e notificações.

### Área Administrativa

Funcionários autorizados poderão gerenciar informações da base de conhecimento e comunicados institucionais.

## 🛠️ Tecnologias

As principais tecnologias e serviços previstos para o desenvolvimento são:

* **JavaScript** — linguagem principal utilizada no desenvolvimento da aplicação;
* **Node.js** — ambiente utilizado no backend;
* **Firebase** — infraestrutura principal do projeto;
* **Cloud Firestore** — banco de dados NoSQL;
* **Firebase Authentication** — autenticação e gerenciamento de usuários;
* **Firebase Cloud Functions** — processamento das operações do backend;
* **Firebase Storage** — armazenamento de arquivos;
* **Gemini / LLM** — processamento das perguntas e geração das respostas;
* **RAG** — técnica utilizada para relacionar as respostas da IA à base de conhecimento oficial;
* **HTML5 / CSS3** — estrutura e estilização da interface;
* **Git e GitHub** — controle de versão e desenvolvimento colaborativo.

## 🏗️ Arquitetura Simplificada

```text
                 ┌─────────────────┐
                 │     Usuário     │
                 └────────┬────────┘
                          ↓
                 ┌─────────────────┐
                 │   Interface Web │
                 └────────┬────────┘
                          ↓
                 ┌─────────────────┐
                 │  Backend /      │
                 │ Cloud Functions │
                 └───────┬─────────┘
                         ↓
              ┌──────────┴──────────┐
              ↓                     ↓
      ┌───────────────┐      ┌───────────────┐
      │ Cloud         │      │ Inteligência  │
      │ Firestore     │      │ Artificial    │
      └───────┬───────┘      └───────┬───────┘
              │                      │
              └──────────┬───────────┘
                         ↓
                  Resposta ao usuário
```

## 📂 Estrutura planejada do banco

O Firestore será organizado em coleções semelhantes a:

```text
Firestore
│
├── usuarios
├── conversas
├── avisos
├── baseConhecimento
├── faq
└── configuracoes
```

Essa estrutura poderá ser ajustada durante o desenvolvimento conforme as necessidades do sistema.

## 👥 Público-alvo

O sistema será destinado principalmente à comunidade escolar, incluindo:

* Alunos;
* Responsáveis;
* Professores;
* Funcionários;
* Visitantes interessados em informações da instituição.

## 🚀 Desenvolvimento

O projeto será desenvolvido de forma colaborativa, utilizando **GitHub para controle de versão** e **Firebase como infraestrutura compartilhada**.

O desenvolvimento será dividido em etapas:

1. Modelagem da estrutura do sistema;
2. Configuração do Firebase;
3. Desenvolvimento do banco de dados;
4. Implementação da autenticação;
5. Desenvolvimento da interface;
6. Implementação do sistema de conversação;
7. Criação da base de conhecimento;
8. Integração da Inteligência Artificial;
9. Implementação do RAG;
10. Desenvolvimento da área administrativa;
11. Testes e correções;
12. Publicação da aplicação.

## 📌 Status

**Em desenvolvimento 🚧**

O Projeto Sylvinho está em fase de planejamento e desenvolvimento, com a arquitetura, funcionalidades e estrutura do banco sendo definidas antes da implementação completa do sistema.

---

### Projeto de TCC

**Projeto Sylvinho — Assistente Virtual para a Secretaria Acadêmica**

Desenvolvido como Trabalho de Conclusão de Curso do Técnico em Informática para Internet.
