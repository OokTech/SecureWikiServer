/*
  browser.js

  This is the code that runs in the browser for the secure server chat example.

  Things this demonstrates:
  - Simple values in the browser localStorage
  - In-browser http POST requests
  - The browser components for a simple websocket application
*/

// Set the port used by the websocket server and placeholder variables
var wsport = '40510'
var ws = false
var name = 'unauthenticated'

/*
  This logs out, which in this context means:
  - deleting the token from the local storage
  - disabling the logout button
  - enabling the login button, and the username and password fields
*/
var logout = function () {
  localStorage.removeItem('ws-token')
  document.getElementById('logout').disabled = true
  document.getElementById('login').disabled = false
  document.getElementById('user').disabled = false
  document.getElementById('pwd').disabled = false
}

/*
  This posts the username and password for the server to get a token response
*/
var login = function () {
  if (window.location.protocol === 'https:') {
    var xhr = new XMLHttpRequest()
    xhr.open('POST', 'authenticate', true)
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
    xhr.onload = function () {
      // do something to response
      if (this.responseText) {
        localStorage.setItem('ws-token', this.responseText)
        document.getElementById('logout').disabled = false
        document.getElementById('login').disabled = true
        document.getElementById('user').disabled = true
        document.getElementById('pwd').disabled = true
        if (ws.readyState === 1) {
          var token = localStorage.getItem('ws-token')
          ws.send(JSON.stringify({messageType: 'announce', text: "I connected!!", token: token}))
        }
      }
    }
    name = document.getElementById('user').value
    var password = document.getElementById('pwd').value
    xhr.send(`name=${name}&pwd=${password}`)
  }
}

// Send a message to the server and it gets echoed back
var sendMessage = function () {
  if (ws.readyState === 1) {
    var token = localStorage.getItem('ws-token')
    ws.send(JSON.stringify({messageType: 'echo', text: document.getElementById('message').value, name: name, token: token}))
    document.getElementById('message').value = ''
  }
}

// Send a message to the server and it gets sent to all of the connected
// computers
var sendAnnouncement = function () {
  if (ws.readyState === 1) {
    var token = localStorage.getItem('ws-token')
    ws.send(JSON.stringify({messageType: 'announce', text: document.getElementById('user').value + ': ' + document.getElementById('message').value, token: token}))
    document.getElementById('message').value = ''
  }
}

// This removes the token from the local storage and sends a message to the
// server that tells the server to set the connection as inactive.
var disconnect = function () {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({messageType: 'disconnect'}))
    ws.close()
    ws = false
  }
}

var connect = function () {
  if (window.location.protocol !== 'https:') {
      document.getElementById('authstate').innerHTML = 'Login only allowed on https!'
      document.getElementById('logout').disabled = true
      document.getElementById('login').disabled = true
      document.getElementById('user').disabled = true
      document.getElementById('pwd').disabled = true
  }
  wsprotocol = window.location.protocol === 'https:'?'wss://':'ws://'
  wsport = '40510'
  if (ws.readyState !== 1) {
    //ws = new WebSocket(wsprotocol + window.location.hostname + ':' + wsport)
    ws = new WebSocket(wsprotocol + window.location.hostname + ':' + wsport)
    // event emmited when connected
    ws.onopen = function () {
      // Set things to the opened state
      document.getElementById('wsstate').innerHTML = 'Connected'
      document.getElementById('connect').disabled = true
      document.getElementById('disconnect').disabled = false
      document.getElementById('echo').disabled = false
      document.getElementById('announce').disabled = false
    }
    ws.onclose = function () {
      // Set things to the closed state.
      document.getElementById('wsstate').innerHTML = 'Disconnected'
      document.getElementById('connect').disabled = false
      document.getElementById('disconnect').disabled = true
    }
    // event emmited when receiving message
    ws.onmessage = function (ev) {
      var display = document.getElementById('display')
      display.innerHTML += '<br>' + JSON.parse(ev.data).text
      if (window.location.protocol === 'https:') {
        if (JSON.parse(ev.data).authenticated) {
          document.getElementById('authstate').innerHTML = 'Authenticated'
        } else {
          document.getElementById('authstate').innerHTML = 'Unauthenticated'
        }
      }
    }
  }
}

connect()
