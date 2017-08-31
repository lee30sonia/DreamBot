var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var config = require('../config');
var GoogleSearch = require('google-search');
var cheerio = require("cheerio");
var mongo = require('mongodb').MongoClient;
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
//const PERSONA_ACCOUNT = '2b4572519c088d98984298d8343f8955';
const mongoUrl = "mongodb://localhost:27017/englishbot";
const SONIA = '1577355242339196';
const DEBBIE = '1613235225387887';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/webhook/', (req, res) => {
   if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
      res.send(req.query['hub.challenge']);
   }
   res.send('Error, wrong validation token');
});

app.post('/webhook/', (req, res) => {
   const messaging_events = req.body.entry[0].messaging;
   console.log(messaging_events);
   for (let i = 0; i < messaging_events.length; i++) {
      const event = req.body.entry[0].messaging[i];
      const sender = event.sender.id;
      if (event.message && event.message.text) {
         const text = event.message.text;
         if (event.message.quick_reply) {
            var qr = event.message.quick_reply;

            if (qr.payload == "take_test") takeTest(sender);else if (text == "I remember!") response_rem(sender, qr.payload, true);else if (text == "I forgot QQ") response_rem(sender, qr.payload, false);else if (text == "It's correct!") word_correct(sender, qr.payload);else if (text == "It's wrong QQ" || text == "ok let's go") word_wrong(sender, qr.payload);
         } else if (text == "Take test") {
            var qrs = [{
               "content_type": "text",
               "title": "yes",
               "payload": "take_test"
            }, {
               "content_type": "text",
               "title": "no",
               "payload": "nothing" }];
            sendTextMessageWithQR(sender, "Do you want to take a test now?", qrs);
         } else searchDictionary(text, sender);
      } else if (event.postback) {
         if (event.postback.payload == "cam") addWord(sender, event.postback.title, "cam");else if (event.postback.payload == "oxf") addWord(sender, event.postback.title, "oxf");else if (event.postback.title == "Search!") {
            oxford(event.postback.payload, sender);
            setTimeout(function () {
               sendButtonAdd(event.postback.payload, sender, "oxf");
            }, 1000);
         }
      }
   }
   res.sendStatus(200);
});

app.listen(port, () => console.log(`listening on port ${port}`));
setInterval(function () {
   var qrs = [{
      "content_type": "text",
      "title": "yes",
      "payload": "take_test"
   }, {
      "content_type": "text",
      "title": "no",
      "payload": "nothing" }];
   sendTextMessageWithQR(DEBBIE, "Do you want to take a test now?", qrs);
}, 24 * 60 * 60 * 1000);

function sendMessage(sender, messageData) {
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

function sendTextMessage(sender, text) {
   var messageData;
   if (text.length > 640) messageData = {
      text: text.substring(0, 639)
   };else messageData = {
      text: text
   };
   sendMessage(sender, messageData);
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

   sendMessage(sender, messageData);
}

function sendButtonSearch(word, sender) {
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

   sendMessage(sender, messageData);
}

function sendButtonAdd(word, sender, dictionary) {
   var messageData = {
      attachment: {
         type: "template",
         payload: {
            template_type: "button",
            text: "Add this word into wordbook?",
            buttons: [{
               type: "postback",
               title: word,
               payload: dictionary
            }]
         }
      }
   };

   sendMessage(sender, messageData);
}

function searchDictionary(word, sender) {
   cambridge(word, sender);
   setTimeout(function () {
      sendButtonSearch(word, sender);
      sendButtonAdd(word, sender, "cam");
   }, 5000);
}

function oxford(word, sender) {
   console.log(word);
   oxfordLearners.build({
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
                 delay(300);
            	sendTextMessage(sender, trans.eq(i).text().substring(0, 639));	
                 delay(500);
            }*/
         });
         sendTextMessage(sender, "dictionary link:\n" + response.items[0].link);
      }
   });
}

function colName(who) {
   var col;
   if (who == SONIA) col = "EnglishBot_Wordbook_Sonia";else if (who == DEBBIE) col = "EnglishBot_Wordbook_Debbie";else col = "test";
   return col;
}

function addWord(who, word, dictionary) {
   var col = colName(who);
   var obj = { voc: word, dic: dictionary, correct: 0, asked: false };
   mongo.connect(mongoUrl, function (err, db) {
      if (err) throw err;
      db.collection(col).insertOne(obj, function (err, res) {
         if (err) throw err;
         db.close();
      });
   });
   sendTextMessage(who, word + " added to wordbook!");
}

function takeTest(who) {
   var col = colName(who);
   mongo.connect(mongoUrl, function (err, db) {
      if (err) throw err;

      if (db.collection(col).count({}) == 0) {
         sendTextMessage(who, "No word in wordbook!");
         db.close();
      } else {
         db.collection(col).updateMany({}, { $set: { asked: false } }, function (err, res) {
            if (err) throw err;
         });
         db.collection(col).updateMany({ correct: 5 }, { $set: { correct: 6, asked: true } }, function (err, res) {
            if (err) throw err;
         });
         db.collection(col).updateMany({ correct: 3 }, { $set: { correct: 4, asked: true } }, function (err, res) {
            if (err) throw err;
            db.close();
            askQuestion(who);
         });
      }
   });
}

function askQuestion(who) {
   var col = colName(who);
   mongo.connect(mongoUrl, function (err, db) {
      if (err) throw err;

      db.collection(col).find({ asked: false }).toArray(function (err, res) {
         if (err) throw err;
         if (!res || res.length == 0) {
            sendTextMessage(who, "Congrats! You have finished today's test!");
         } else {
            var i = Math.floor(Math.random() * res.length);
            db.collection(col).updateOne({ _id: res[i]._id }, { $set: { asked: true } }, function (err, result) {
               if (err) throw err;
            });
            sendTextMessageWithQR(who, "Do you remember what this word means?: " + res[i].voc, [{
               "content_type": "text",
               "title": "I remember!",
               "payload": res[i].voc
            }, {
               "content_type": "text",
               "title": "I forgot QQ",
               "payload": res[i].voc }]);
         }
         db.close();
      });
   });
}

function response_rem(who, word, rem) {
   var col = colName(who);
   mongo.connect(mongoUrl, function (err, db) {
      if (err) throw err;
      db.collection(col).findOne({ voc: word }, function (err, res) {
         if (err) throw err;
         if (res.dic == "oxf") oxford(word, who);else if (res.dic == "cam") cambridge(word, who);
         db.close();
      });
   });
   setTimeout(function () {
      if (rem) sendTextMessageWithQR(who, "Did you remember it correctly?", [{
         "content_type": "text",
         "title": "It's correct!",
         "payload": word
      }, {
         "content_type": "text",
         "title": "It's wrong QQ",
         "payload": word }]);else sendTextMessageWithQR(who, "Ready for the next question?", [{
         "content_type": "text",
         "title": "ok let's go",
         "payload": word
      }]);
   }, 8000);
}

function word_correct(who, word) {
   var col = colName(who);
   mongo.connect(mongoUrl, function (err, db) {
      if (err) throw err;
      db.collection(col).findOne({ voc: word }, function (err, res) {
         if (err) throw err;

         if (res.correct < 6) {
            db.collection(col).updateOne({ voc: word }, { $set: { correct: res.correct + 1 } }, function (err, result) {
               if (err) throw err;
               db.close();
               askQuestion(who);
            });
         } else {
            sendTextMessage(who, "Yay! You killed this word! :D");
            db.collection(col).deleteOne({ voc: word }, function (err, result) {
               if (err) throw err;
               db.close();
               askQuestion(who);
            });
         }
      });
   });
}

function word_wrong(who, word) {
   var col = colName(who);
   mongo.connect(mongoUrl, function (err, db) {
      if (err) throw err;
      db.collection(col).updateOne({ voc: word }, { $set: { correct: 0 } }, function (err, result) {
         if (err) throw err;
         db.close();
         askQuestion(who);
      });
   });
}

/*function LookUpStatus(who) {
   var col;
   if (who=='1577355242339196') col="EnglishBot_Wordbook_Sonia";
   else col="test";
   var s=0;
   mongo.connect(mongoUrl, function(err, db) {
      if (err) throw err;
      var query = { status: { $exists:true } };
      db.collection(col).findOne(query,function(err, res) {
         if (err) throw err;
         if (res)
            s=res.status;
         else
            console.log("no status record");
         db.close();
      });
   });
   return s;
}*/

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