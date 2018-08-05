/*
  This is a generic extensible websocket server.

  Each message comes in as a json object. Each message has to have a
  type property which names the message handler function to use.

  The handler function is passed the message as a json object. Any
  authentication or validation is done by the message handlers.

  Things this shows:
  - Setting up a websocket server
  - Exporting things as a module
*/

// Require needed libraries
var ws = require('ws')
var path = require('path')
var fs = require('fs')
var jwt = require('jsonwebtoken')

var settings = require('../LoadConfig.js')

var wiki = require('../startWiki.js')

// Initialise variables
var websocketserver = {}
var connections = []

/*
  This is the init function. There are two ways to initialise the websocket
  server, by passing a port number or by passing a server object.
  For insecrue ws:// type servers you can use the port method, but to use
  secure wss:// connections you need to use an https server to initialise it.

  If a server is provided it is used, if not than the port number is used.
  If neither is given than this does nothing.

  To initialise using a port 8080 the function call would be

  websocketserver.init(false, 8080)
*/
var init = function (server, port) {
  // This lets you create the websocket server using a port number or an
  // existing http(s) server. To use secure websockets you need to use an
  // existing https server, otherwise it doesn't make much difference.
  var WebSocketServer = ws.Server
  if (server) {
    var wss = new WebSocketServer({server})
  } else {
    var wss = new WebSocketServer({port: port})
  }
  // This sets the handler function for the 'connection' event. This fires
  // every time a new connection is initially established.
  wss.on('connection', handleConnection)


  // Authentication function, if the token is verified it returns the decoded
  // token payload, otherwise returns false.
  // Not being authenticated doesn't mean that the request fails because we
  // can have public actions, or different levels of authentication for
  // different actions.
  function authenticateMessage(data) {
    if (data.token) {
      try {
        settings = settings || {}
        settings.wikis = settings.wikis || {}
        settings.wikis[data.wiki] = settings.wikis[data.wiki] || {}
        var key = fs.readFileSync(path.join(require('os').homedir(), settings.tokenPrivateKeyPath))
        var decoded = jwt.verify(data.token, key)
        // Special handling for the chat thing
        if (decoded && (data.type === 'announce' || data.type === 'credentialCheck' || (data.type === 'ping' && decoded.level !== 'Guest'))) {
          return decoded
        } else if (decoded.level) {
          if (settings.wikis[data.wiki].access[decoded.level] || (typeof decoded.name === 'string' && decoded.name !== '' && decoded.name === settings.wikis[data.wiki].owner)) {
            var levels = settings.wikis[data.wiki].access[decoded.level] || []
            // If the logged in person is the wiki owner than add the 'owner'
            // level to the list of permissions
            if (typeof decoded.name === 'string' && decoded.name !== '' && decoded.name === settings.wikis[data.wiki].owner) {
              levels.push('owner')
            }
            var allowed = false
            levels.forEach(function(level, index) {
              if (settings.actions[level].indexOf(data.type) !== -1) {
                allowed = decoded
              }
            })
            return allowed
          } else {
            // The attempted operation isn't allowed by the persons
            // authorisation level.
            return false
          }
        } else {
          // No authorisation level included in the token
          return false
        }
      } catch (e) {
        // Error getting private key or something similar
        return false
      }
    } else {
      // No token
      return false
    }
  }

  // This function sets up how the websocket server handles incomming
  // connections. It is generic and extensible so you can use this same server
  // to make many different things.
  function handleConnection (client) {
    // This imports the handlers for the example chat application.
    var messageHandlers = require('./websocketmessagehandlers.js')
    console.log('New Connection')
    connections.push({'socket':client, 'active': true})
    client.on('message', handleMessage)
    connections[Object.keys(connections).length-1].index = [Object.keys(connections).length-1]
  }
}

function handleMessage(event) {
  var self = this
  // Determine which connection the message came from
  var thisIndex = connections.findIndex(function(connection) {return connection.socket === self})
  try {
    var eventData = JSON.parse(event)
    // Add the source to the eventData object so it can be used later.
    eventData.source_connection = thisIndex
    if (eventData.wiki && eventData.wiki !== connections[thisIndex].wiki && !connections[thisIndex].wiki) {
      connections[thisIndex].wiki = eventData.wiki;
      // Make sure that the new connection has the correct list of tiddlers
      // being edited.
      wiki.tw.Bob.UpdateEditingTiddlers();
    }
    // Make sure we have a handler for the message type
    if (typeof messageHandlers[eventData.messageType] === 'function') {
      // Check authorisation
      var authorised = authenticateMessage(eventData)
      if (authorised) {
        eventData.decoded = authorised
        messageHandlers[eventData.messageType](eventData)
      }
      // If unauthorised just ignore it.
    } else {
      console.log('No handler for message of type ', eventData.messageType)
    }
  } catch (e) {
    console.log("WebSocket error, probably closed connection: ", e)
  }
}

// This module exports an empty object at the top level.
// It also exports the init function to create and start the server.
// It also exports the connections object which is used to send messages to
// connected devices.
module.exports = websocketserver
module.exports.init = init
module.exports.connections = connections
module.exports.handleMessage = handleMessage
