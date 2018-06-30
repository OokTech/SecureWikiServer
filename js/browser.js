/*
  browser.js

  This is the code that runs in the browser for the secure server chat example.

  Things this demonstrates:
  - Simple values in the browser localStorage
  - In-browser http POST requests
  - The browser components for a simple websocket application
*/

// Set the port used by the websocket server and placeholder variables
var ws = false
var name = 'unauthenticated'

/*
  This checks if we are logged in already or not and set the UI state
  appropriately.
*/
function checkStatus() {
  var loggedin = false
  // check if there is a token stored, if not we aren't logged in.
  var token = localStorage.getItem('ws-token')
  if (token) {
    // Ask the server to verify the token, just send an echo message and check
    // if it is set as verified or not.
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({messageType: 'credentialCheck', token: token}))
    }
  }
}

/*
  This sets the UI to the logged out state.
*/
var setLoggedOut = function () {
  document.getElementById('logout').disabled = true
  document.getElementById('login').disabled = false
  document.getElementById('loginasguest').disabled = false
  document.getElementById('user').disabled = false
  document.getElementById('pwd').disabled = false
  document.getElementById('announce').disabled = true
}

/*
  This sets the UI to the logged in state
*/
var setLoggedIn = function () {
  document.getElementById('logout').disabled = false
  document.getElementById('login').disabled = true
  document.getElementById('loginasguest').disabled = true
  document.getElementById('user').disabled = true
  document.getElementById('pwd').disabled = true
  document.getElementById('announce').disabled = false
}

/*
  This logs out, which in this context means:
  - deleting the token from the local storage
  - disabling the logout button
  - enabling the login button, and the username and password fields
*/
var logout = function () {
  localStorage.removeItem('ws-token')
  document.cookie = 'token=;expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  setLoggedOut()
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
        var expires = new Date();
        expires.setTime(expires.getTime() + 24*60*60*1000)
        document.cookie = 'token=' + this.responseText + '; expires=' + expires + '; path=/;'
        setLoggedIn()
        if (ws.readyState === 1) {
          var token = localStorage.getItem('ws-token')
          ws.send(JSON.stringify({messageType: 'announce', text: "I connected!!", token: token}))
          document.getElementById('wikilink').innerHTML = "<a href='./wiki'>wiki</a>"
        }
      }
    }
    name = document.getElementById('user').value
    var password = document.getElementById('pwd').value
    xhr.send(`name=${name}&pwd=${password}`)
  }
}

/*
  This logs in as a guest
*/
var loginAsGuest = function () {
  if (window.location.protocol === 'https:') {
    var xhr = new XMLHttpRequest()
    xhr.open('POST', 'authenticate', true)
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
    xhr.onload = function () {
      // do something to response
      if (this.responseText) {
        localStorage.setItem('ws-token', this.responseText)
        var expires = new Date();
        expires.setTime(expires.getTime() + 24*60*60*1000)
        document.cookie = 'token=' + this.responseText + '; expires=' + expires + '; path=/;'
        setLoggedIn()
        if (ws.readyState === 1) {
          var token = localStorage.getItem('ws-token')
          ws.send(JSON.stringify({messageType: 'announce', text: "I connected!!", token: token}))
          document.getElementById('wikilink').innerHTML = "<a href='./wiki/Public'>wiki</a>"
        }
      }
    }
    name = document.getElementById('user').value
    var password = document.getElementById('pwd').value
    xhr.send(`name=Guest&pwd=Guest`)
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

function isEnter (event) {
  if (event.key === "Enter") {
    sendAnnouncement()
  }
}

// Send a message to the server and it gets sent to all of the connected
// computers
var sendAnnouncement = function () {
  if (ws.readyState === 1) {
    var token = localStorage.getItem('ws-token')
    var name = JSON.parse(window.atob(token.split('.')[1])).name
    ws.send(JSON.stringify({messageType: 'announce', text: name + ': ' + document.getElementById('message').value, token: token}))
    document.getElementById('message').value = ''
  }
}

// This removes the token from the local storage and sends a message to the
// server that tells the server to set the connection as inactive.
var disconnect = function () {
  if (ws.readyState === 1) {
    var token = localStorage.getItem('ws-token')
    ws.send(JSON.stringify({messageType: 'disconnect', token: token}))
    ws.close()
    ws = false
  }
}

var connect = function (settings) {
  if (window.location.protocol !== 'https:') {
      document.getElementById('authstate').innerHTML = 'Login only allowed on https!'
      document.getElementById('logout').disabled = true
      document.getElementById('login').disabled = true
      document.getElementById('user').disabled = true
      document.getElementById('pwd').disabled = true
  }
  wsprotocol = window.location.protocol === 'https:'?'wss://':'ws://'
  if (ws.readyState !== 1) {
    ws = new WebSocket(wsprotocol + window.location.hostname + ':' + settings.wssPort)
    // event emmited when connected
    ws.onopen = function () {
      // Set things to the open state
      document.getElementById('announce').disabled = false
      checkStatus()
    }
    ws.onclose = function () {
      // Set things to the closed state.
      document.getElementById('announce').disabled = true
    }
    // event emmited when receiving message
    ws.onmessage = function (ev) {
      evdata = JSON.parse(ev.data)
      if (evdata.messageType === 'announce') {
        var display = document.getElementById('display')
        display.innerHTML += '<br>' + JSON.parse(ev.data).text
      }
      if (window.location.protocol === 'https:' && evdata.messageType === 'credentialCheck') {
        if (evdata.authenticated) {
          setLoggedIn()
          var token = localStorage.getItem('ws-token')
          document.getElementById('authstate').innerHTML = 'Authenticated as ' + JSON.parse(window.atob(token.split('.')[1])).name
        } else {
          setLoggedOut()
          document.getElementById('authstate').innerHTML = 'Unauthenticated'
        }
      }
    }
  }
}

function start () {
  var request = new XMLHttpRequest()
  request.open('GET', '/settings')
  request.onload = function(e) {
    var settings = JSON.parse(request.responseText)
    connect(settings)
  }
  request.send()
}

start()
