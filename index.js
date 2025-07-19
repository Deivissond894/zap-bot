const express = require('express');
const axios = require('axios');
const dialogflow = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid'); // Para gerar session IDs únicos

const app = express();
app.use(express.json()); // Habilita o Express a ler JSON no corpo das requisições

// Variáveis de ambiente
const ULTRAMSG_INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const DIALOGFLOW_PROJECT_ID = process.env.DIALOGFLOW_PROJECT_ID;
const DIALOGFLOW_CLIENT_EMAIL = process.env.DIALOGFLOW_CLIENT_EMAIL;
const DIALOGFLOW_PRIVATE_KEY = process.env.DIALOGFLOW_PRIVATE_KEY.replace(/\\n/g, '\n'); // Reverte \\n para \n

// Configuração do cliente Dialogflow
const config = {
  credentials: {
    client_email: DIALOGFLOW_CLIENT_EMAIL,
    private_key: DIALOGFLOW_PRIVATE_KEY,
  },
  projectId: DIALOGFLOW_PROJECT_ID,
};
const sessionClient = new dialogflow.SessionsClient(config);

// Endpoint para receber mensagens da Ultramsg (Webhook)
app.post('/webhook', async (req, res) => {
  console.log('Webhook recebido do Ultramsg:', JSON.stringify(req.body, null, 2));

  try {
    // Acessa diretamente 'dados' (que é 'data' em português)
    const eventData = req.body.dados;

    // Verifica se os dados do evento e o tipo de mensagem são válidos
    if (!eventData || eventData.tipo !== 'bate-papo' || !eventData.corpo) {
      console.log(`Não é uma mensagem de chat válida ou está vazia. Tipo: ${eventData ? eventData.tipo : 'N/A'}`);
      return res.sendStatus(200);
    }

    // Ignora mensagens enviadas pelo próprio bot (fromMe está em português no webhook)
    if (eventData.fromMe) {
      console.log('Ignorando mensagem enviada pelo próprio bot.');
      return res.sendStatus(200);
    }

    const sender = eventData.de; // 'de' é 'from' em português
    const messageText = eventData.corpo; // 'corpo' é 'body' em português

    console.log(`Mensagem de ${sender}: "${messageText}"`);

    // Gerar um Session ID único para cada conversa do Dialogflow
    // Podemos usar o número do remetente como parte do session ID para manter o contexto
    const sessionId = uuidv4();
    const sessionPath = sessionClient.projectAgentSessionPath(
      DIALOGFLOW_PROJECT_ID,
      sessionId
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: messageText,
          languageCode: 'pt-BR', // Defina o idioma do seu agente Dialogflow
        },
      },
    };

    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    console.log('Resposta do Dialogflow:', result.fulfillmentText);

    if (result.fulfillmentText) {
      // Enviar a resposta de volta para o usuário via Ultramsg
      const ultramsgUrl = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;
      const params = new URLSearchParams();
      params.append('token', ULTRAMSG_TOKEN);
      params.append('to', sender); // O número de volta para o remetente
      params.append('body', result.fulfillmentText);

      await axios.post(ultramsgUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      console.log('Resposta enviada de volta ao usuário.');
    } else {
      console.log('Nenhuma resposta do Dialogflow para enviar.');
    }
    
    res.sendStatus(200); // Responde OK para a Ultramsg
  } catch (error) {
    console.error('Erro no webhook ou ao processar mensagem:', error.message);
    if (error.response) {
      console.error('Detalhes do erro Axios:', error.response.data);
    }
    res.sendStatus(500); // Responde com erro interno do servidor
  }
});

// Endpoint básico para verificar se o servidor está online
app.get('/', (req, res) => {
  res.send('O bot do WhatsApp está rodando!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});