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

    // Adiciona logs de depuração para entender a validação
    console.log('DEBUG: eventData existe?', !!eventData);
    console.log('DEBUG: eventData.tipo:', eventData ? eventData.tipo : 'N/A');
    console.log('DEBUG: eventData.corpo existe?', eventData ? !!eventData.corpo : 'N/A');
    console.log('DEBUG: eventData.tipo é "bate-papo"?', eventData ? eventData.tipo === 'bate-papo' : 'N/A');

    // Verifica se os dados do evento e o tipo de mensagem são válidos
    // 'tipo' deve ser 'bate-papo' e 'corpo' não deve ser vazio
    if (!eventData || eventData.tipo !== 'bate-papo' || !eventData.corpo) {
      console.log(`Não é uma mensagem de chat válida ou vazia. Tipo: ${eventData ? eventData.tipo : 'N/A'}`);
      return res.sendStatus(200);
    }

    // Ignora mensagens enviadas pelo próprio bot (fromMe está em português no webhook)
    if (eventData.fromMe) {
      console.log('Ignorando mensagem enviada pelo próprio bot.');
      return res.sendStatus(200);
    }

    const sender = eventData.de; // 'de' é 'from' em português (pode ser o ID do grupo ou do contato)
    const messageText = eventData.corpo; // 'corpo' é 'body' em português

    console.log(`Mensagem de ${sender}: "${messageText}"`);

    // Gerar um Session ID único para cada conversa do Dialogflow
    // Podemos usar o número do remetente como parte do session ID para manter o contexto
    const sessionId = uuidv4();
    const sessionPath = sessionClient.projectAgentSessionPath(