require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const Nexmo = require("nexmo");
const speech = require('@google-cloud/speech').v1p1beta1;

const nexmo = new Nexmo({
    apiKey: "not_used", // Voice applications don't use the API key or secret
    apiSecret: "not_used", 
    applicationId: process.env.NEXMO_APPLICATION_ID,
    privateKey: process.env.NEXMO_PRIVATE_KEY_PATH
});

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/webhooks/answer', (req, res) => {
    return res.json([
        {
            action: 'connect',
            endpoint: [{
                type: 'phone',
                number: process.env.BOB_PHONE_NUMBER
            }]
        },
        {
            action: 'connect',
            endpoint: [{
                type: 'phone',
                number: process.env.CHARLIE_PHONE_NUMBER
            }]
        },
        {
            "action": "record",
            "eventUrl": [`${req.protocol}://${req.get('host')}/webhooks/recording`],
            "split": "conversation",
            "channels": 3,
            "format": "wav"
        }
    ]);
});

app.post('/webhooks/event', (req, res) => {
    console.log(req.body);
    return res.status(204).send("");
});

app.post('/webhooks/recording', (req, res) => {
    nexmo.files.get(req.body.recording_url, (err, audio) => {
        if (err) { console.log(err); return; }

        transcribeRecording({
            "language": "en-US",
            "channelCount": 3,
            "audio": audio,
        }).then((data) => {
            const response = data[0];
            const transcription = response.results
                .map(
                    result =>
                    ` Channel Tag: ` +
                    result.channelTag +
                    ` ` +
                    result.alternatives[0].transcript
                )
                .join('\n');
            console.log(`Transcription: \n${transcription}`);
        });
    });
    return res.status(204).send("");
});

function transcribeRecording(params) {
    const client = new speech.SpeechClient();

    const config = {
        encoding: `LINEAR16`,
        languageCode: params.language,
        audioChannelCount: params.channelCount,
        enableSeparateRecognitionPerChannel: true,
    };

    const request = {
        config: config,
        audio: {
            content: params.audio.toString('base64'),
        }
    };

    return client.recognize(request);
}

app.listen(3000, () => console.log(`Listening`))

