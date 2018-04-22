/*
  This is a generic extensible websocket server.

  Each message comes in as a json object. Each message has to have a
  messageType property which names the message handler function to use.

  The handler function is passed the message as a json object. Any
  authentication or validation is done by the message handlers.

  Things this shows:
  - Setting up a websocket server
  - Exporting things as a module
*/

// Require needed libraries
var ws = require('ws')

var settings = require('../LoadConfig.js')

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
  // Not being authenticated doesn't mean that the request fails because we can
  // have public actions, or different levels of authentication for different
  // actions.
  function authenticateMessage(data) {
    console.log(data)
    if (data.token) {
      console.log("here")
      try {
        console.log(1)
        var key = fs.readFileSync(path.join(require('os').homedir(), '.ssh/id_rsa'))
        console.log(2)
        var decoded = jwt.verify(data.token, key)
        console.log('decoded: ', decoded)
        console.log(settings)
        // Special handling for the chat thing
        if (decoded && data.messageType === 'announce') {
          return true
        } else if (decoded.level) {
          settings = settings || {}
          settings.access = settings.access || {}
          settings.access.wikis = settings.access.wikis || {}
          if (settings.access.wikis[data.wiki]) {
            if (settings.access.wiki[data.wiki][decoded.level]) {
              var levels = settings.access.wiki[data.wiki][decoded.level]
              var allowed = false
              Object.keys(levels).forEach(function(level) {
                if (settings.actions[level].indexOf(data.messageType) !== -1) {
                  allowed = true
                }
              })
              return allowed
            } else {
              return false
            }
          } else {
            return false
          }
        } else {
          return false
        }
      } catch (e) {
        return false
      }
    } else {
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
    client.on('message', function incoming(event) {
      var self = this
      // Determine which connection the message came from
      var thisIndex = connections.findIndex(function(connection) {return connection.socket === self})
      try {
        var eventData = JSON.parse(event)
        // Add the source to the eventData object so it can be used later.
        eventData.source_connection = thisIndex
        // Make sure we have a handler for the message type
        if (typeof messageHandlers[eventData.messageType] === 'function') {
          //console.log(eventData)
          //console.log(settings)
          // Check authorisation
          var authorised = authenticateMessage(eventData)
          if (authorised === true) {
            messageHandlers[eventData.messageType](eventData)
          }
          // If unauthorised just ignore it.
        } else {
          console.log('No handler for message of type ', eventData.messageType)
        }
      } catch (e) {
        console.log("WebSocket error, probably closed connection: ", e)
      }
    })
    connections[Object.keys(connections).length-1].index = [Object.keys(connections).length-1]
  }
}

// This module exports an empty object at the top level.
// It also exports the init function to create and start the server.
// It also exports the connections object which is used to send messages to
// connected devices.
module.exports = websocketserver
module.exports.init = init
module.exports.connections = connections
