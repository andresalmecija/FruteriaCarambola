const secrets = require('./dev/secrets.json');

const googleMapsClient = require('@google/maps').createClient({
  key: secrets.GOOGLE_MAPS_API_KEY,
  Promise: Promise
});

const {SessionsClient} = require('@google-cloud/dialogflow-cx');



const projectId = secrets.projectId;
const location = secrets.location;
const agentId = secrets.agentId;
const languageCode = 'es'

const keyFilename = './dev/service_account.json'
const clientCX = new SessionsClient({apiEndpoint: 'us-central1-dialogflow.googleapis.com', projectId: projectId, keyFile:keyFilename})


//Inicializaciones
// Telegram Bot
const TelegramBot = require('node-telegram-bot-api');
const token = secrets.telegram_token;
// Método para recoger los actualizaciones de Telegram
// Método 1: Polling
const bot = new TelegramBot(token, {polling: true});

// Fin Método 1
// Método 2: Webhook
/*
const url = 'https://4b4a96b8b157.ngrok.io';
const express = require('express');
const bot = new TelegramBot(token);
bot.setWebHook(`${url}/bot${token}`);
const port = 3000;
const app = express();
// parse the updates to JSON
app.use(express.json());
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});
//const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Express server is listening on ${port}`);
});
*/
// Fin Método 2


// Listen for any kind of message. There are different kinds of messages.
bot.on('message', async (msg) => {

  console.log("-> Mensaje recibido en Telegram: "+JSON.stringify(msg));
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const sessionId = userId.toString();//msg.from.id.toString();
  const sessionPath = clientCX.projectLocationAgentSessionPath(
    projectId,
    location,
    agentId,
    sessionId
  ); 

  // Textoa
  if (msg.text) {
    var request_dialogflow = {
        session: sessionPath,
        queryInput: {
            text: {
              text: msg.text,
            },
            languageCode: "es-ES"
        }
    };
    console.log(JSON.stringify("request: "+request_dialogflow));
    const responses = await clientCX.detectIntent(request_dialogflow);
    gestionaMensajesDF(responses, chatId);  
  } 
  // Ubicación
  else if (msg.location) { 
    var request_dialogflow = {
      session: sessionPath,
      queryInput: {
          text: {
            text: 'ubicacion',
          },
          languageCode: "es-ES"
      }
    };

    googleMapsClient.reverseGeocode({latlng:msg.location.latitude.toString() + "," + msg.location.longitude.toString()})
      .asPromise()
      .then((response) => {
        console.log(response.json.results);
        request_dialogflow.queryInput.text.text = response.json.results[0].formatted_address;
        clientCX.detectIntent(request_dialogflow).then((responses) => {gestionaMensajesDF(responses, chatId);})
      })
      .catch((err) => {
        console.log(err);
      });
  } 
  // Imagen
  else if (msg.photo) { 
    console.log(JSON.stringify(msg.photo))
    // Hacemos un bucle porque en telegram móvil llegan 3 versiones de la foto. Nos quedamos con la que más resolución tenga 
    var photo_index_max_resolution = 0;
    var max_resolution = 0;
    for (var i = 0; i < msg.photo.length; i++) {
      if (max_resolution < msg.photo[i].height * msg.photo[i].width){
        photo_index_max_resolution = i
        max_resolution = msg.photo[i].height * msg.photo[i].width
      }
    } 
    console.log(`Resolucion: ${msg.photo[photo_index_max_resolution].height}x${msg.photo[photo_index_max_resolution].width}`)
    const image_url = await bot.downloadFile(msg.photo[photo_index_max_resolution].file_id, "./");
    const labels = await vision_artificial(image_url);  
    
    for (var i = 0; i < labels.length; i++) {
      const contextPath = contextsClient.contextPath(projectId,sessionId,labels[i].name.toLowerCase());
      var createContextRequest = {
          parent: sessionPath,
          context: {
            name: contextPath,
            lifespanCount: 2,
            
          }
        }
      const a = await contextsClient.createContext(createContextRequest);
  }
  
  var request_dialogflow = {
        session: sessionPath,
        queryInput: {
            text: {
            text: 'foto',
            languageCode: "es-ES"
            }
        }
    };
    const responses = await clientCX.detectIntent(request_dialogflow);
    gestionaMensajesDF(responses, chatId);  
  } 
});

bot.on("callback_query", async function(data){
  console.log("-> Callback recibido en Telegram: "+JSON.stringify(data));
  const userId = data.from.id;
  const chatId = userId;
  const sessionId = userId.toString();//msg.from.id.toString();
  const sessionPath = sessionClient.sessionPath(projectId, sessionId);

  // Texto
  var request_dialogflow = {
      session: sessionPath,
      queryInput: {
          text: {
          text: data.data,
          languageCode: "es-ES"
          }
      }
  }
  const responses = await clientCX.detectIntent(request_dialogflow);
  gestionaMensajesDF(responses, chatId);  
});

async function gestionaMensajesDF(responses, chatId){
  const [response] = responses;
  for (const message of response.queryResult.responseMessages) {
    if (message.text) {
      bot.sendMessage(chatId, message.text.text[0])
      console.log(`Agent Response: ${message.text.text}`);
    }
  }
}
