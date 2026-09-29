// Ponto de entrada reservado às Cloud Functions do projeto.
// Ainda não há funções exportadas para IA, notificações ou outras operações
// de servidor.

import {setGlobalOptions} from "firebase-functions";

// Limita a dez instâncias por função de segunda geração, reduzindo a expansão
// automática de recursos. Cada função pode substituir esse padrão.
// Essa configuração não cria endpoints e não se aplica às funções da API v1.
setGlobalOptions({maxInstances: 10});
