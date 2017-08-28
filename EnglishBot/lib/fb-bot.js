var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var config = require('../config');
var GoogleSearch = require('google-search');
var cheerio = require("cheerio");
var oxfordLearners = new GoogleSearch({
   key: 'AIzaSyAsGIJCUyKhUtKcraPC2WVu7bhQ19Sw2X4',
   cx: '013483341958330762973:_tmwjyyaxpa'
});
var cambridgeEnCh = new GoogleSearch({
   key: 'AIzaSyAsGIJCUyKhUtKcraPC2WVu7bhQ19Sw2X4',
   cx: '013483341958330762973:fg6fcohtj2c'
});

const app = express();
const port = '8080';
const VERIFY_TOKEN = config.VERIFY_TOKEN;
const PAGE_TOKEN = config.PAGE_TOKEN;
const PERSONA_ACCOUNT = '2b4572519c088d98984298d8343f8955';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/webhook/', (req, res) => {
   if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
      res.send(req.query['hub.challenge']);
   }
   res.send('Error, wrong validation token');
});

app.post('/webhook/', (req, res) => {

   //console.log(req.body.entry.length);

   const messaging_events = req.body.entry[0].messaging;
   console.log(messaging_events);
   for (let i = 0; i < messaging_events.length; i++) {
      const event = req.body.entry[0].messaging[i];
      const sender = event.sender.id;
      if (event.message && event.message.text) {
         const text = event.message.text;
         searchDictionary(text, sender);

         /*request({
            url: 'https://radbots.com/api/personas',
            qs:  {
               account_key:PERSONA_ACCOUNT,
               persona_id:sender,
               dimension:'test'
            },
            method: 'GET',
            json: true
         }, function(error, response, body) {
            if (error) { console.log('Error sending message: ', error); } 
            else if (response.body.error) { console.log('Error: ', response.body.error); }
            else { console.log(response.body); }
         });
         
         request({
            url: 'https://radbots.com/api/personas',
            qs:  {
               account_key:PERSONA_ACCOUNT,
               persona_id:sender,
               dimension:'test',
               fact:'fact'
            },
            method: 'POST',
            json: true
         }, function(error, response, body) {
            if (error) { console.log('Error sending message: ', error); } 
            else if (response.body.error) { console.log('Error: ', response.body.error); }
         });*/
      } else if (event.postback) {
         oxford(event.postback.payload, sender);
      }
   }
   res.sendStatus(200);
});

app.listen(port, () => console.log(`listening on port ${port}`));

function sendTextMessage(sender, text) {
   var messageData;
   if (text.length > 640) messageData = {
      text: text.substring(0, 639)
   };else messageData = {
      text: text
   };

   request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {
         access_token: PAGE_TOKEN
      },
      method: 'POST',
      json: {
         recipient: {
            id: sender
         },
         message: messageData
      }
   }, function (error, response, body) {
      if (error) {
         console.log('Error sending message: ', error);
      } else if (response.body.error) {
         console.log('Error: ', response.body.error);
      }
   });
}

function sendTextMessageWithQR(sender, text, qrs) {
   var messageData;
   if (text.length > 640) messageData = {
      text: text.substring(0, 639),
      quick_replies: qrs
   };else messageData = {
      text: text,
      quick_replies: qrs
   };

   request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {
         access_token: PAGE_TOKEN
      },
      method: 'POST',
      json: {
         recipient: {
            id: sender
         },
         message: messageData
      }
   }, function (error, response, body) {
      if (error) {
         console.log('Error sending message with qr: ', error);
      } else if (response.body.error) {
         console.log('Error: ', response.body.error);
      }
   });
}

function sendButton(word, sender) {
   var messageData = {
      attachment: {
         type: "template",
         payload: {
            template_type: "button",
            text: "Search again in Oxford Learner's Dictionary?",
            buttons: [{
               type: "postback",
               title: "Search!",
               payload: word
            }]
         }
      }
   };

   request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {
         access_token: PAGE_TOKEN
      },
      method: 'POST',
      json: {
         recipient: {
            id: sender
         },
         message: messageData
      }
   }, function (error, response, body) {
      if (error) {
         console.log('Error sending button: ', error);
      } else if (response.body.error) {
         console.log('Error: ', response.body.error);
      }
   });
}

function searchDictionary(word, sender) {
   cambridge(word, sender);
   setTimeout(function () {
      sendButton(word, sender);
   }, 5000);
}

function oxford(word, sender) {
   console.log(word);
   oxfordLearners.build({
      q: word,
      start: 1,
      //fileType: "pdf",
      //gl: "tr", //geolocation, 
      //lr: "lang_tr",
      num: 1 // Number of search results to return between 1 and 10, inclusive 
      //siteSearch: "http://kitaplar.ankara.edu.tr/" // Restricts results to URLs from a specified site 
   }, function (error, response) {
      if (!response.items) sendTextMessage(sender, "No result found!");else {
         request({
            url: response.items[0].link,
            method: "GET"
         }, function (error, response, body) {
            if (error || !body) {
               return;
            }

            var $ = cheerio.load(body);
            var defs = $("span.def"); //<span class="def">
            for (var i = 0; i < defs.length; i++) {
               sendTextMessage(sender, defs.eq(i).text());
            }
         });
         sendTextMessage(sender, "dictionary link:\n" + response.items[0].link);
      }
   });
}

function cambridge(word, sender) {
   cambridgeEnCh.build({
      q: word,
      start: 1,
      num: 1
   }, function (error, response) {
      if (!response.items) sendTextMessage(sender, "No result found!");else {
         request({
            url: response.items[0].link,
            method: "GET"
         }, function (error, response, body) {
            if (error || !body) {
               return;
            }

            var $ = cheerio.load(body);
            var defs = $("b.def");
            var trans = $("span.trans:only-of-type");

            var i = 0;
            function forloop() {
               sendTextMessage(sender, defs.eq(i).text());
               setTimeout(function () {
                  sendTextMessage(sender, trans.eq(i).text());
                  i++;
                  if (i < defs.length) setTimeout(forloop, 500);
               }, 300);
            }
            forloop();
            /*for (var i=0; i<defs.length; i++){
            	sendTextMessage(sender, defs.eq(i).text().substring(0, 639));
            	sendTextMessage(sender, trans.eq(i).text().substring(0, 639));	
            }*/
         });
         sendTextMessage(sender, "dictionary link:\n" + response.items[0].link);
      }
   });
}