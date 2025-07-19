const express = require('express');
const axios = require('axios');
const dialogflow = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid'); // To generate unique session IDs

const app = express();
app.use(express.json()); // Enables Express to read JSON in request body

// Environment variables
const ULTRAMSG_INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const DIALOGFLOW_PROJECT_ID = process.env.DIALOGFLOW_PROJECT_ID;
const DIALOGFLOW_CLIENT_EMAIL = process.env.DIALOGFLOW_CLIENT_EMAIL;

// --- LINHAS DE DEBUG ADICIONADAS AQUI ---
console.log("DEBUG: Valor bruto da DIALOGFLOW_PRIVATE_KEY do env:", process.env.DIALOGFLOW_PRIVATE_KEY);
const DIALOGFLOW_PRIVATE_KEY = process.env.DIALOGFLOW_PRIVATE_KEY.replace(/\\n/g, '\n'); // Revert \\n to \n
console.log("DEBUG: Valor processado da DIALOGFLOW_PRIVATE_KEY:", DIALOGFLOW_PRIVATE_KEY);
// --- FIM DAS LINHAS DE DEBUG ---

// Dialogflow client configuration
const config = {
  credentials: {
    client_email: DIALOGFLOW_CLIENT_EMAIL,
    private_key: DIALOGFLOW_PRIVATE_KEY,
  },
  projectId: DIALOGFLOW_PROJECT_ID,
};
const sessionClient = new dialogflow.SessionsClient(config);

// Endpoint to receive messages from Ultramsg (Webhook)
app.post('/webhook', async (req, res) => {
  console.log('Webhook received from Ultramsg:', JSON.stringify(req.body, null, 2));

  try {
    // Access 'data' (which contains the message details)
    const eventData = req.body.data;

    // Add debug logs to understand validation
    console.log('DEBUG: eventData exists?', !!eventData);
    console.log('DEBUG: eventData.type:', eventData ? eventData.type : 'N/A');
    console.log('DEBUG: eventData.body exists?', eventData ? !!eventData.body : 'N/A');
    console.log('DEBUG: eventData.type is "chat"?', eventData ? eventData.type === 'chat' : 'N/A');

    // Check if event data and message type are valid
    // 'type' should be 'chat' and 'body' should not be empty
    if (!eventData || eventData.type !== 'chat' || !eventData.body) {
      console.log(`Not a valid chat message or empty. Type: ${eventData ? eventData.type : 'N/A'}`);
      return res.sendStatus(200);
    }

    // Ignore messages sent by the bot itself (fromMe in webhook)
    if (eventData.fromMe) {
      console.log('Ignoring message sent by the bot itself.');
      return res.sendStatus(200);
    }

    const sender = eventData.from; // 'from' is the sender's ID (can be group or contact ID)
    const messageText = eventData.body; // 'body' is the message content

    console.log(`Message from ${sender}: "${messageText}"`);

    // Generate a unique Session ID for each Dialogflow conversation
    // We can use the sender's number as part of the session ID to maintain context
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
          languageCode: 'pt-BR', // Set your Dialogflow agent's language
        },
      },
    };

    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    console.log('Dialogflow response:', result.fulfillmentText);

    if (result.fulfillmentText) {
      // Send the response back to the user via Ultramsg
      const ultramsgUrl = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;
      const params = new URLSearchParams();
      params.append('token', ULTRAMSG_TOKEN);
      params.append('to', sender); // The number or group ID to reply to
      params.append('body', result.fulfillmentText);

      await axios.post(ultramsgUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      console.log('Response sent back to the user.');
    } else {
      console.log('No Dialogflow response to send.');
    }
    
    res.sendStatus(200); // Respond OK to Ultramsg
  } catch (error) {
    console.error('Error in webhook or while processing message:', error.message);
    if (error.response) {
      console.error('Axios error details:', error.response.data);
    }
    res.sendStatus(500); // Respond with internal server error
  }
});

// Basic endpoint to check if the server is online
app.get('/', (req, res) => {
  res.send('The WhatsApp bot is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});