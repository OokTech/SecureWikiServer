/*
  This is the http server component for initial authentication that can be used
  by other systems. It was made to work with a websocket server where each
  message is sent with a token.

  The basic web socket server is ./js/websocketserver.js and is made to be
  reusable by allowing you to add message handlers.
  Example message handlers are in ./js/websocketmessagehandlers.js

  It creates the people folder in the same place as this script.
  The people folder.

  Things this shows:
  - Setting up a simple express server
  - Creating an authentication route
  - Setting up an https server using a private key and certificate
*/

var fs = require('fs')
var path = require('path')
var express = require('express')
var bodyParser = require('body-parser')
var jwt = require('jsonwebtoken')
var bcrypt = require('bcrypt')
var https = require('https')
var cookieParser = require('cookie-parser')

var settings = require('./LoadConfig.js')
var baseDir = settings.filePathBase === 'homedir'?require('os').homedir():settings.filePathBase

var wiki = require('./startWiki.js')

var app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))
app.use(cookieParser())

function checkAuthentication (req, res, next) {
  try {
    var key = fs.readFileSync(path.join(require('os').homedir(), '.ssh/id_rsa'))
    var decoded = jwt.verify(req.cookies.token, key)
    if (decoded) {
      // Add the decoded token to res object.
      res.decoded = decoded
      return next()
    } else {
      res.redirect('/')
    }
  } catch (e) {
    res.redirect('/')
  }
}

app.use('/wiki', checkAuthentication, wiki.router)

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html')
})

app.get('/js', function (req, res) {
  res.sendFile(__dirname + '/js/browser.js')
})

app.post('/authenticate', function (req, res) {
  // Get the authentication heanders and stuff
  // Check to make sure the header send a name and password
  if (req.body.name && req.body.pwd) {
    try {
      // Get the stored hash
      var info = JSON.parse(fs.readFileSync(path.join(path.dirname(require.main.filename), 'people', req.body.name, 'info.hash'), {encoding: 'utf8'}))
      if (info.hash && info.level) {
        // Compare the password to the stored hash
        var goodPassword = bcrypt.compareSync(req.body.pwd, info.hash)
        if (goodPassword) {
          // Check the headers against the username and password
          // Create the token for it
          // Sign the token using the rsa private key of the server
          var key = fs.readFileSync(path.join(baseDir, settings.tokenPrivateKeyPath))
          var token = jwt.sign({level: info.level, name: req.body.name}, key, {expiresIn: settings.tokenTTL})
          // Send the token back
          res.send(token)
        } else {
          res.status(403).send(false)
        }
      } else {
        res.status(403).send(false)
      }
    } catch (e) {
      console.log(e)
      res.status(400).send(false)
    }
  } else {
    res.status(400).send(false)
  }
})

keypath = path.join(baseDir, settings.serverKeyPath)
certpath = path.join(baseDir, settings.certPath)
var options = {
  key: fs.readFileSync(keypath),
  cert: fs.readFileSync(certpath)
}

https.createServer(options, app).listen(settings.httpsPort)

// Create the websocket server on port listed in settings.wssPort
var wsserver = require('./js/websocketserver.js')
var httpsServer = https.createServer(options).listen(settings.wssPort)
wsserver.init(httpsServer)

var messageHandlers = require('./js/websocketmessagehandlers.js')

messageHandlers.addHandlers(wiki.tw.nodeMessageHandlers)
wiki.tw.connections = wsserver.connections
