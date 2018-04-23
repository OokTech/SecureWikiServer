/*
  These are the websocket message handler functions for the simple chat
  application.

  Things this demonstrates:
  - using token based authentication for websocket messages
  - verifying jsonwebtokens using a pivate key
  - sending messages from node using websockets
*/

var fs = require('fs')
var path = require('path')
var jwt = require('jsonwebtoken')

var connections = require('./websocketserver.js').connections

var messageHandlers = messageHandlers || {}

// Authentication function, if the token is verified it returns the decoded
// token payload, otherwise returns false.
// Not being authenticated doesn't mean that the request fails because we can
// have public actions, or different levels of authentication for different
// actions.
function authenticateMessage(data) {
  if (data.token) {
    try {
      var key = fs.readFileSync(path.join(require('os').homedir(), '.ssh/id_rsa'))
      var decoded = jwt.verify(data.token, key)
      return decoded
    } catch (e) {
      return false
    }
  } else {
    return false
  }
}

/*
  Echo example to show how the authentication stuff works
*/
messageHandlers.echo = function (data) {
  if (connections[data.source_connection].socket.readyState === 1) {
    var authenticated = authenticateMessage(data)
    if (authenticated) {
      data['authenticated'] = true
      connections[data.source_connection].socket.send(JSON.stringify(data))
    } else {
      connections[data.source_connection].socket.send(JSON.stringify(data))
    }
  }
}

/*
  This sets the connection as inactive
*/
messageHandlers.disconnect = function (data) {
  connections[data.source_connection].active = false
}

/*
  Send the message to everyone, but only if you are authenticated
*/
messageHandlers.announce = function (data) {
  var authenticated = authenticateMessage(data)
  if (authenticated) {
    data['authenticated'] = true
    Object.keys(connections).forEach(function (index) {
      if (connections[index].active && connections[index].socket.readyState === 1) {
        try {
          connections[index].socket.send(JSON.stringify(data))
        } catch (e) {
          connections[index].active = false
        }
      }
    })
  }
}

/*
  This responds to a ping from the browser. This is used to check and make sure
  that the browser and server are connected.
  It also echos back any data that was sent. This is used by the heartbeat to
  make sure that the server and browser are still connected.
*/
messageHandlers.ping = function(data) {
  var message = {type: 'pong'};
  Object.keys(data).forEach(function (key) {
    message[key] = data[key];
  })
  if (data.heartbeat) {
    message.heartbeat = true;
  }
  // When the server receives a ping it sends back a pong.
  var response = JSON.stringify(message);
  $tw.connections[data.source_connection].socket.send(response);
}

// A function to add message handlers.
var addHandlers = function (handlers) {
  // We expect an object where each property is a function for a different
  // message handler.
  if (typeof handlers === 'object') {
    for (handler in handlers) {
      if (typeof handlers[handler] === 'function') {
        messageHandlers[handler] = handlers[handler]
      }
    }
  }
}

module.exports = messageHandlers
module.exports.addHandlers = addHandlers
