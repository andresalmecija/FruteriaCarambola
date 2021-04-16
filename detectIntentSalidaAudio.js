const credentials = {
    keyFilename: "./dev/service_account.json"
  };

// Imports the Dialogflow client library
const dialogflow = require('@google-cloud/dialogflow').v2;

// Instantiate a DialogFlow client.
const sessionClient = new dialogflow.SessionsClient(credentials);

/**
 * TODO(developer): Uncomment the following lines before running the sample.
 */
// const projectId = 'ID of GCP project associated with your Dialogflow agent';
// const sessionId = `user specific ID of session, e.g. 12345`;
// const query = `phrase(s) to pass to detect, e.g. I'd like to reserve a room for six people`;
// const languageCode = 'BCP-47 language code, e.g. en-US';
// const outputFile = `path for audio output file, e.g. ./resources/myOutput.wav`;

// Define session path
const projectId = "";
const sessionId = '12345'
const sessionPath = sessionClient.projectAgentSessionPath(
  projectId,
  sessionId
);
const fs = require('fs');
const util = require('util');

async function detectIntentwithTTSResponse() {
  // The audio query request
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: 'hola',
        languageCode: 'es',
      },
    },
    outputAudioConfig: {
      audioEncoding: 'OUTPUT_AUDIO_ENCODING_LINEAR_16',
    },
  };
  sessionClient.detectIntent(request).then(responses => {
    console.log('Detected intent:');
    let outputFile = "Audio1.wav"
    const audioFile = responses[0].outputAudio;
    util.promisify(fs.writeFile)(outputFile, audioFile, 'binary');
    console.log(`Audio content written to file: ${outputFile}`);
    const TelegramBot = require('node-telegram-bot-api');
    const token = '';
    // Método para recoger los actualizaciones de Telegram
    // Método 1: Polling
    const bot = new TelegramBot(token);
    bot.sendAudio(651340810,audioFile)
  });

  
}
detectIntentwithTTSResponse();