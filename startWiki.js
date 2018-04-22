var express = require('express')
var wiki = {}
wiki.router = express.Router()

wiki.tw = require("./TiddlyWiki5/boot/boot.js").TiddlyWiki()

// Fake the command line arguments
//var args = ['./Wikis/IndexWiki','--wsserver']
var args = ['./Wikis/IndexWiki','--externalserver']
wiki.tw.boot.argv = args//Array.prototype.slice.call(process.argv,2)

// Boot the TW5 app
wiki.tw.boot.boot()

var unauthorised = "<html><p>You don't have the authorisation to log view this wiki.</p> <p><a href='/'>Return to login</a></p></html>"

var settings = require('./LoadConfig.js')

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

var addBasicRoutes = function () {
  wiki.router.get('/', function(request,response) {
    // Add a check to make sure that the person logged in is authorised
    // to open the wiki.
    var authorised = checkAuthorisation(response, fullName)
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
    response.writeHead(200, {"Content-Type": "image/x-icon"});
    var buffer = wiki.tw.wiki.getTiddlerText("$:/favicon.ico","");
    response.end(buffer,"base64");
  })

  wiki.addRoutes = function (inputObject, prefix) {
    if (typeof inputObject === 'object') {
      Object.keys(inputObject).forEach(function (wikiName) {
        if (typeof inputObject[wikiName] === 'string') {
          if (prefix === '') {
            var fullName = wikiName;
          } else {
            fullName = prefix + '/' + wikiName;
          }

          // Make route handler
          wiki.router.get(new RegExp('^\/' + fullName + '\/?$'), function(request, response, next) {
            // Add a check to make sure that the person logged in is authorised
            // to open the wiki.
            var authorised = checkAuthorisation(response, fullName)
            if (authorised) {
              // Make sure we have loaded the wiki tiddlers.
              // This does nothing if the wiki is already loaded.
              var exists = wiki.tw.ServerSide.loadWiki(fullName, inputObject[wikiName]);
              if (exists) {
                // If servePlugin is not false than we strip out the filesystem
                // and tiddlyweb plugins if they are there and add in the
                // multiuser plugin.
                var servePlugin = !wiki.tw.settings['ws-server'].servePlugin || wiki.tw.settings['ws-server'].servePlugin !== false;
                // Get the full text of the html wiki to send as the response.
                var text = wiki.tw.ServerSide.prepareWiki(fullName, servePlugin);
              } else {
                var text = "<html><p>No wiki found! Either there is no usable tiddlywiki.info file in the listed location or it isn't listed.</p></html>"
              }

              response.writeHead(200, {"Content-Type": "text/html"});
              response.end(text,"utf8");
            } else {
              response.end(unauthorised, "utf8")
            }
          })


          // And add the favicon route for the child wikis
          wiki.router.get(/^\/' + fullName + '\/favicon.ico$/, function(request,response,next) {
            // Add a check to make sure that the person logged in is authorised
            // to open the wiki.
            var authorised = checkAuthorisation(response, fullName)
            if (authorised) {
              response.writeHead(200, {"Content-Type": "image/x-icon"});
              var buffer = wiki.tw.wiki.getTiddlerText("{" + fullName + "}" + "$:/favicon.ico","");
              response.end(buffer,"base64");
            }
          })
          console.log("Added route " + String(new RegExp('^\/' + fullName + '\/?$')))
        } else {
          // recurse!
          // This needs to be a new variable or else the rest of the wikis at
          // this level will get the longer prefix as well.
          var nextPrefix = prefix===''?wikiName:prefix + '/' + wikiName;
          wiki.addRoutesThing(inputObject[wikiName], nextPrefix);
        }
      })
    }
  }
}

addBasicRoutes()

wiki.tw.httpServer = {}

wiki.tw.httpServer.addOtherRoutes = function () {
  wiki.addRoutes(wiki.tw.settings.wikis, '')
}

wiki.tw.httpServer.clearRoutes = function () {
  wiki.router = express.Router()
  addBasicRoutes()
}

module.exports = wiki
