var express = require( 'express');
var bodyParser = require( 'body-parser');
var request = require( 'request');
var config = require( '../config');
var GoogleSearch = require('google-search');
var cheerio = require("cheerio");
var googleSearch = new GoogleSearch({
  key: 'AIzaSyAsGIJCUyKhUtKcraPC2WVu7bhQ19Sw2X4',
  cx: '013483341958330762973:_tmwjyyaxpa'
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
})

app.post('/webhook/', (req, res) => {

  //console.log(req.body);

  const messaging_events = req.body.entry[0].messaging;
  console.log(messaging_events);
  for (let i = 0; i < messaging_events.length; i++) {
    const event = req.body.entry[0].messaging[i];
    const sender = event.sender.id;
    if (event.message && event.message.text) {
      const text = event.message.text;
      //sendTextMessage(sender, "Text received, echo: "+ text.substring(0, 200));
      searchDictionary(text,sender);
      
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
    }
  }
  res.sendStatus(200);
});

app.listen(port, () => console.log(`listening on port ${port}`));

function sendTextMessage(sender, text) {
  
  const messageData = {
    text: text
  }

  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {
        access_token:PAGE_TOKEN
    },
    method: 'POST',
    json: {
      recipient: {
        id: sender
      },
      message: messageData,
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  });
}
 
function searchDictionary(word,sender) {
   googleSearch.build({
      q: word,
      start: 1,
      //fileType: "pdf",
      //gl: "tr", //geolocation, 
      //lr: "lang_tr",
      num: 1, // Number of search results to return between 1 and 10, inclusive 
      //siteSearch: "http://kitaplar.ankara.edu.tr/" // Restricts results to URLs from a specified site 
   }, function(error, response) {
      if (!response.items)
      	sendTextMessage(sender, "No result found!");
      else
      { 
      	request({
         	url: response.items[0].link,
         	method: "GET"
      	}, function(error, response, body) {
         	if (error || !body) {
            	return;
         	}
         
         	var $ = cheerio.load(body);
         	var defs = $("span.def");
         	for (var i=0; i<defs.length; i++){
         		sendTextMessage(sender, defs.eq(i).text().substring(0, 639));
         	}
      	});      
      	sendTextMessage(sender, "dictionary link:\n"+response.items[0].link);
   	  } 
   });
}