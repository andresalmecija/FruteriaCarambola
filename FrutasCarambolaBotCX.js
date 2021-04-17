// Librerías
const dialogflow = require("dialogflow");
var fs = require("fs");
const {SessionsClient} = require('@google-cloud/dialogflow-cx');
var chatbase = require('@google/chatbase');
let ChatBaseApiKey = "";
chatbase.setApiKey(ChatBaseApiKey);
const projectId = "";
const keyFilename = './dev/fruteriacarambola-credentials.json'
let clientCX = new SessionsClient({projectId, keyFilename});


//Inicializaciones
// Telegram Bot
const TelegramBot = require('node-telegram-bot-api');
const token = '';
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


// Dialogflow
const credentials = {
    keyFilename: "./dev/service_account.json"
  };
const sessionClient = new dialogflow.SessionsClient(credentials);
const contextsClient = new dialogflow.ContextsClient(credentials);


// Google Spreedsheet
const SPREADSHEET_ID = ``;


async function vision_artificial(url_image) {
    return new Promise((resolve, reject)=>{ 
    const vision = require('@google-cloud/vision');
    // Creates a client
    const client = new vision.ImageAnnotatorClient(credentials);
    // Performs label detection on the image file
    //const [result] = await client.labelDetection(url_image);
    //client.labelDetection(url_image).then(([result]) =>{
    client.objectLocalization(url_image).then(([result]) =>{
      console.log(result);
      const labels = result.localizedObjectAnnotations;
      //console.log('Labels:');
      //labels.forEach(label => console.log(label.description));
      resolve(labels)
    })
  })
}

const secretKEYgpt3 = '';
const openAIUrl = 'https://api.openai.com/v1/engines/davinci/completions';


// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', async (msg) => {

  console.log("-> Mensaje recibido en Telegram: "+JSON.stringify(msg));
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const sessionId = userId.toString();//msg.from.id.toString();
  const sessionPath = sessionClient.sessionPath(projectId, sessionId); 
  //console.log("sessionPath: "+sessionPath);
  let userData;
  /**** Comprobamos si el usuario ya existía *********/
  userData = await consultaUsuario(userId);
  console.log("userData: "+JSON.stringify(userData))
  //Si hay datos de usuario almacenados en nuestra BBDD creo el contexto datos_usuario
  if(userData.nombre){ //Si el objeto no está vacío

    const contextPath = contextsClient.contextPath(projectId,sessionId,'datos_usuario');
    var createContextRequest = {
        parent: sessionPath,
        context: {
          name: contextPath,
          lifespanCount: 100,
          parameters: {
            fields: {
              nombre: {
                kind: "stringValue",
                stringValue: userData.nombre
              },
              pais: {
                kind: "stringValue",
                stringValue: userData.pais
              }
            }
          }
          
        }
      }
    const a = await contextsClient.createContext(createContextRequest);
  }
  /***************************************************/
  
  // Textoa
  if (msg.text) {
    var request_dialogflow = {
        session: sessionPath,
        queryInput: {
            text: {
            text: msg.text,
            languageCode: "es-ES"
            }
        }
    };
    console.log(JSON.stringify("request: "+request_dialogflow));
    const responses = await sessionClient.detectIntent(request_dialogflow);
    gestionaMensajesDF(responses, chatId);  
  } 
  // Ubicación
  else if (msg.location) { 
    var request_dialogflow = {
      session: sessionPath,
      queryInput: {
          text: {
          text: 'ubicacion',
          languageCode: "es-ES"
          }
      }
    };
    const responses = await sessionClient.detectIntent(request_dialogflow);
    gestionaMensajesDF(responses, chatId);  
    let data_recomendador = {
      id_usuario: chatId,
      nombre: msg.from.first_name,
      idioma: msg.from.language_code,
      longitud: msg.location.longitude,
      latitud: msg.location.latitude
    }
    console.log("----------> "+JSON.stringify(responses[0].queryResult.parameters))
    if (responses[0].queryResult.parameters && responses[0].queryResult.parameters.fields.edad){
      data_recomendador.edad = responses[0].queryResult.parameters.fields.edad.numberValue
    }
    ingestaDatosRecomendador(data_recomendador);
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
  
/*
    const contextPath = contextsClient.contextPath(projectId,sessionId,'frutas');
    var createContextRequest = {
      parent: sessionPath,
      context: {
        name: contextPath,
        lifespanCount: 2,
        parameters: {
          fields: {}
        }
      }
    }
    var fruits = ['Apple', 'Pear', 'Melon', 'Banana', 'Orange']
      for (var i = 0; i < labels.length; i++) {

        if(fruits[labels[i].name]){
        createContextRequest.context.parameters.fields[`fruta${i+1}`] = {kind: "stringValue", stringValue: labels[i].name}
        }
    }
    const a = await contextsClient.createContext(createContextRequest);
  }*/

    var request_dialogflow = {
        session: sessionPath,
        queryInput: {
            text: {
            text: 'foto',
            languageCode: "es-ES"
            }
        }
    };
    const responses = await sessionClient.detectIntent(request_dialogflow);
    gestionaMensajesDF(responses, chatId);  
    
  } 
  // Voice
  else if (msg.voice) { 
   
    // Hacemos un bucle porque en telegram móvil llegan 3 versiones de la foto. Nos quedamos con la que más resolución tenga 
  
    const image_url = await bot.downloadFile(msg.voice.file_id, "./");

    
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
  const responses = await sessionClient.detectIntent(request_dialogflow);
  gestionaMensajesDF(responses, chatId);
});

async function gestionaMensajesDF(responses, chatId){
    // Alimentamos el sistema de analytics
  enviaInfoAnalyticsChatBase(responses, chatId)

  var mensajes = responses[0].queryResult.fulfillmentMessages;
  console.log("-> Respuesta de DF: "+JSON.stringify(mensajes));
  console.log("-> QueryResult de DF: "+JSON.stringify(responses[0].queryResult));

  var newArray = responses[0].queryResult.outputContexts.filter(el => el.name.includes('pedidocx'));
  if(newArray.length>0){ //Si Dialogflow se ha metido en un contexto pedido
    const sessionPathCX = clientCX.projectLocationAgentSessionPath(
      projectId,
      'global',
      '', // Id del Agente de DialogflowCS
      chatId
    );
    console.info(sessionPathCX);
    const request = {
      session: sessionPathCX,
      queryInput: {
        text: {
          text: responses[0].queryResult.queryText,
        },
        languageCode: 'en',
      },
    };
    const [response] = await clientCX.detectIntent(request);
    for (const message of response.queryResult.responseMessages) {
      if (message.text) {
        bot.sendMessage(chatId, message.text.text[0])
        console.log(`Agent Response: ${message.text.text}`);
      }
    }

  } else {
    let mensajesEspecificosTelegram = false;
    for (var i = 0; i < mensajes.length; i++) {
      if (mensajes[i].platform === 'TELEGRAM') {
        mensajesEspecificosTelegram = true;
        // Cards
        if (mensajes[i].message === 'card') {
          //if (mensajes[i].card.title) await bot.sendMessage(chatId, mensajes[i].card.title)
          if (mensajes[i].card.imageUri) await bot.sendPhoto(chatId, mensajes[i].card.imageUri);
          if (mensajes[i].card.buttons) {
            const btns = mensajes[i].card.buttons;
            let botones_TE = {
              reply_markup: {
                  inline_keyboard: []
              }
            }
            for (var j = 0; j < btns.length; j++) {
              botones_TE.reply_markup.inline_keyboard.push([{"text":btns[j].text,"callback_data":btns[j].text}])
            }
            await bot.sendMessage(chatId, mensajes[i].card.title, botones_TE)
          }
        } 
        // Text
        else if (mensajes[i].message === 'text'){
          await bot.sendMessage(chatId, mensajes[i].text.text[0]);
        } 
        // quickReplies
        else if (mensajes[i].message === 'quickReplies'){
          let botones_TE = {
            reply_markup: {
                inline_keyboard: []
            }
          }
          // Insertamos los botones en el mensaje para Telegram
          var botones_DF = mensajes[i].quickReplies.quickReplies;
          for (var j = 0; j < botones_DF.length; j++) {
            botones_TE.reply_markup.inline_keyboard.push([{"text":botones_DF[j],"callback_data":botones_DF[j]}])
          }
          await bot.sendMessage(chatId, mensajes[i].quickReplies.title, botones_TE)
        } 
        // Imagen
        else if (mensajes[i].message === 'image'){
          await bot.sendPhoto(chatId, mensajes[i].image.imageUri);
        } 
      }
      if (mensajes[i].platform === 'PLATFORM_UNSPECIFIED' && !mensajesEspecificosTelegram) {
        await bot.sendMessage(chatId, mensajes[i].text.text[0]);
      }
    }
  }
  // Si no hay mensaje de Telegram imprimo los de PLATFORM_UNSPECIFIED
  /*
  if (!mensajes.find(e=>e.platform === 'TELEGRAM')) {
    for (var i = 0; i < mensajes.length; i++) {
      if (mensajes[i].platform === 'PLATFORM_UNSPECIFIED' && mensajes[i].message === 'text'){
        await bot.sendMessage(chatId, mensajes[i].text.text[0]);
      } 
    }
  }*/
}

async function almacenaUsuario(data){
  const {GoogleSpreadsheet} = require('google-spreadsheet')
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
  const cred = require('./dev/service_account.json')
  await doc.useServiceAccountAuth(cred);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0]; // número de hoja. Si solo hay una hoja es la 0
  const rows = await sheet.getRows();
  let existeFila = false;

  // Recorrojo la hoja para buscar ese sessionId
  for (var k = 0; k < rows.length; k++) {
    if(rows[k].userId.toString() === data.userId.toString()){ // Existe ese userId
      if(data.nombre) rows[k].nombre = data.nombre;
      if(data.pais) rows[k].pais = data.pais;
      await rows[k].save()
      existeFila = true; 
    }
  }
  if(!existeFila){ //Si no existía la insertamos
    await sheet.addRow(data)
  }

}

async function consultaUsuario(userId){
  let data = {}
  const {GoogleSpreadsheet} = require('google-spreadsheet')
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
  const cred = require('./dev/service_account.json')
  await doc.useServiceAccountAuth(cred);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0]; // número de hoja. Si solo hay una hoja es la 0
  const rows = await sheet.getRows();
  for (var k = 0; k < rows.length; k++) {
    if(rows[k].userId.toString() === userId.toString()){ // Existe ese sessionId
      data.userId = userId;
      data.nombre = rows[k].nombre;
      data.pais = rows[k].pais;
      
    }
  }
  return(data)
}

function enviaInfoAnalyticsChatBase(responses, chatId){
  // Si el intent ejecutado es el de por defecto se marca setAsNotHandled
if (responses[0].queryResult.intent.isFallback){
  chatbase.newMessage(ChatBaseApiKey, 'usuario_prueba')
  .setPlatform('Telegram')
  .setAsTypeUser()
  .setMessage(responses[0].queryResult.queryText.toString())
  .setVersion('1.0')
  .setUserId(chatId.toString())
  .setAsNotHandled() 
  .setIntent(responses[0].queryResult.intent.displayName.toString())
  .setTimestamp(Date.now().toString())
  .send()
  .catch(err => console.error(err));
  } else {
    //El intent ejecutado es cualquier otro se marca como setAsHandled
    chatbase.newMessage(ChatBaseApiKey, 'usuario_prueba')
    .setPlatform('Telegram')
    .setAsTypeUser()
    .setMessage(responses[0].queryResult.queryText.toString())
    .setVersion('1.0')
    .setUserId(chatId.toString())
    .setAsHandled() 
    .setIntent(responses[0].queryResult.intent.displayName.toString())
    .setTimestamp(Date.now().toString())
    .send()
    .catch(err => console.error(err));
  }
  //En chatbase se deben enviar por separado también las respuetas del chatbot. Ahora no 
  //hace falta informar del intent que se ha despertado. El intent se pone en el mensaje de
  //usuario ocn la función setIntent. En los mensajes de agente no hace falta.
  //Recorremos con un bucle todos los mensajes de agente
  var mensajes = responses[0].queryResult.fulfillmentMessages;
  let mensajesEspecificosTelegram = false;
  for (var i = 0; i < mensajes.length; i++) {
    if (mensajes[i].platform === 'TELEGRAM') {
      mensajesEspecificosTelegram = true;
      // Cards
      if (mensajes[i].message === 'card') {
        //if (mensajes[i].card.title) await bot.sendMessage(chatId, mensajes[i].card.title)
        if (mensajes[i].card.imageUri) {
          chatbase.newMessage(ChatBaseApiKey, 'usuario_prueba')
          .setPlatform('Telegram')
          .setAsTypeAgent()
          .setMessage('Imagen')
          .setVersion('1.0')
          .setUserId(chatId.toString())
          .setTimestamp(Date.now().toString())
          .send()
          .catch(err => console.error(err));
        }
        if (mensajes[i].card.buttons) {
          var texto_botones = []
          const btns = mensajes[i].card.buttons;
          for (var j = 0; j < btns.length; j++) {
            texto_botones.push(btns[j].text)
          }
          chatbase.newMessage(ChatBaseApiKey, 'usuario_prueba')
          .setPlatform('Telegram')
          .setAsTypeAgent()
          .setMessage(`${mensajes[i].card.title}: ${texto_botones.toString()}` )
          .setVersion('1.0')
          .setUserId(chatId.toString())
          .setTimestamp(Date.now().toString())
          .send()
          .catch(err => console.error(err));
        }
      } 
      // Text
      else if (mensajes[i].message === 'text'){
        chatbase.newMessage(ChatBaseApiKey, 'usuario_prueba')
        .setPlatform('Telegram')
        .setAsTypeAgent()
        .setMessage(mensajes[i].text.text[0].toString())
        .setVersion('1.0')
        .setUserId(chatId.toString())
        .setTimestamp(Date.now().toString())
        .send()
        .catch(err => console.error(err));
      } 
      // quickReplies
      else if (mensajes[i].message === 'quickReplies'){
        // Extraemos el texto de los botones en el mensaje para Telegram
        var botones_DF = mensajes[i].quickReplies.quickReplies;
        // Creamos el mensaje de agente: titulo de los quickreplies + Texto de los botones
        chatbase.newMessage(ChatBaseApiKey, 'usuario_prueba')
        .setPlatform('Telegram')
        .setAsTypeAgent()
        .setMessage(`${mensajes[i].quickReplies.title}: ${botones_DF.toString()}`)
        .setVersion('1.0')
        .setUserId(chatId.toString())
        .setTimestamp(Date.now().toString())
        .send()
        .catch(err => console.error(err));
      // Imagen
    } else if (mensajes[i].message === 'image'){
        chatbase.newMessage(ChatBaseApiKey, 'usuario_prueba')
        .setPlatform('Telegram')
        .setAsTypeAgent()
        .setMessage('Imagen')
        .setVersion('1.0')
        .setUserId(chatId.toString())
        .setTimestamp(Date.now().toString())
        .send()
        .catch(err => console.error(err));
      } 
    }
    if (mensajes[i].platform === 'PLATFORM_UNSPECIFIED' && !mensajesEspecificosTelegram) {
      // Si en Dialogflow no hay mensajes específicos en el canal Telegram, nuestro adaptador
      // de canal toma los mensajes que existan en el canal por defecto.
      chatbase.newMessage(ChatBaseApiKey, 'usuario_prueba')
        .setPlatform('Telegram')
        .setAsTypeAgent()
        .setMessage(mensajes[i].text.text[0].toString())
        .setVersion('1.0')
        .setUserId(chatId.toString())
        .setTimestamp(Date.now().toString())
        .send()
        .catch(err => console.error(err));
    }
  }
}
