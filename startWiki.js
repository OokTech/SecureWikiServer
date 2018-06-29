var settings = require('./LoadConfig.js')
var express = require('express')
var wiki = {}
wiki.router = express.Router()

wiki.tw = require("./TiddlyWiki5/boot/boot.js").TiddlyWiki()

var path = require('path')

var baseDir = settings.wikiPathBase === 'homedir'?require('os').homedir():settings.wikiPathBase
var wikisPath = settings.wikisPath || 'Wikis'
var indexWikiName = settings.indexWikiName || 'IndexWiki'

var IndexWikiPath = path.resolve(baseDir, wikisPath, indexWikiName)

// Fake the command line arguments
var args = [IndexWikiPath, '--externalserver']
wiki.tw.boot.argv = args

// Boot the TW5 app
wiki.tw.boot.boot()

var unauthorised = "<html><p>You don't have the authorisation to log view this wiki.</p> <p><a href='/'>Return to login</a></p></html>"

function checkAuthorisation (response, fullName) {
  settings = settings || {}
  settings.access = settings.access || {}
  settings.access.wikis = settings.access.wikis || {}
  if (response.decoded) {
    if (response.decoded.level) {
      if (settings.access.wikis[fullName]) {
        if (settings.access.wikis[fullName][response.decoded.level]) {
          if (settings.access.wikis[fullName][response.decoded.level].indexOf("view") !== -1) {
            return true
          } else {
            return false
          }
        } else {
          return false
        }
      } else {
        return false
      }
    } else {
      return false
    }
  } else {
    return false
  }
}

var addRoutes = function () {
  wiki.router.get('/', function(request,response) {
    // Add a check to make sure that the person logged in is authorised
    // to open the wiki.
    var authorised = checkAuthorisation(response, 'RootWiki')
    if (authorised) {
      // Load the wiki
      wiki.tw.ServerSide.loadWiki('RootWiki', wiki.tw.boot.wikiPath);
      // Get the raw html to send
      var text = wiki.tw.ServerSide.prepareWiki('RootWiki', true);
      // Send the html to the server
      response.writeHead(200, {"Content-Type": "text/html"});
      response.end(text,"utf8");
    } else {
      response.end(unauthorised, "utf8")
    }
  })

  wiki.router.get('/favicon', function(request,response) {
    // Add a check to make sure that the person logged in is authorised
    // to open the wiki.
    var authorised = checkAuthorisation(response, 'RootWiki')
    if (authorised) {
      response.writeHead(200, {"Content-Type": "image/x-icon"});
      var buffer = wiki.tw.wiki.getTiddlerText("$:/favicon.ico","");
      response.end(buffer,"base64");
    }
  })

  wiki.router.get('/:wikiName', function(request, response) {
    // Make sure that the logged in person is authorised to access the wiki
    var authorised = checkAuthorisation(response,request.params.wikiName)
    if (authorised) {
      // Make sure we have loaded the wiki tiddlers.
      // This does nothing if the wiki is already loaded.
      var exists = wiki.tw.ServerSide.loadWiki(request.params.wikiName, wiki.tw.settings.wikis[request.params.wikiName]);
      if (exists) {
        // If servePlugin is not false than we strip out the filesystem
        // and tiddlyweb plugins if they are there and add in the
        // multiuser plugin.
        var servePlugin = !wiki.tw.settings['ws-server'].servePlugin || wiki.tw.settings['ws-server'].servePlugin !== false;
        // Get the full text of the html wiki to send as the response.
        var text = wiki.tw.ServerSide.prepareWiki(request.params.wikiName, servePlugin);
      } else {
        var text = "<html><p>No wiki found! Either there is no usable tiddlywiki.info file in the listed location or it isn't listed.</p></html>"
      }
      response.writeHead(200, {"Content-Type": "text/html"});
      response.end(text,"utf8");
    } else {
      response.end(unauthorised, "utf8")
    }
  })

  wiki.router.get('/:wikiName/favicon.ico', function (request, response) {
    // Add a check to make sure that the person logged in is authorised
    // to open the wiki.
    var authorised = checkAuthorisation(response, request.params.wikiName)
    if (authorised) {
      response.writeHead(200, {"Content-Type": "image/x-icon"});
      var buffer = wiki.tw.wiki.getTiddlerText("{" + request.params.wikiName + "}" + "$:/favicon.ico","");
      response.end(buffer,"base64");
    }
  })
}

addRoutes()

wiki.tw.httpServer = {}

// Here these two functions are placeholders, they don't do anything here.
// They are needed to make this work with the non-express server components.
wiki.tw.httpServer.addOtherRoutes = function () {
  // Does nothing!
}

wiki.tw.httpServer.clearRoutes = function () {
  // Also does nothing!
}

module.exports = wiki
