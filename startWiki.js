var path = require('path')
var fs = require('fs')
var express = require('express')
var wiki = {}
wiki.router = express.Router()
var fileRouter = express.Router()

wiki.tw = require("./TiddlyWiki5/boot/boot.js").TiddlyWiki()

// Fake the command line arguments
var args = ['./Wikis/IndexWiki','--externalserver']
wiki.tw.boot.argv = args

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
      response.writeHead(200, {"Content-Type": "image/x-icon"})
      var buffer = wiki.tw.wiki.getTiddlerText("{" + request.params.wikiName + "}" + "$:/favicon.ico","")
      response.end(buffer,"base64")
    }
  })

  if (wiki.tw.settings.filePathRoot) {
    // If we have a path for files add the file server route
    wiki.router.get('/file/:name', function (request, response) {
      var pathname = path.join(wiki.tw.settings.filePathRoot, request.params.name)
      // Make sure that someone doesn't try to do something like ../../ to get to things they shouldn't get.
      if (pathname.startsWith(wiki.tw.settings.filePathRoot)) {
        fs.exists(pathname, function(exists) {
          if (!exists || fs.statSync(pathname).isDirectory()) {
            response.statusCode = 404;
            response.end();
          }
          fs.readFile(pathname, function(err, data) {
            if (err) {
              console.log(err)
              response.statusCode = 500;
              response.end()
            } else {
              var ext = path.parse(pathname).ext;
              var mimeMap = wiki.tw.settings.mimeMap || {
                '.ico': 'image/x-icon',
                '.html': 'text/html',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.wav': 'audio/wav',
                '.mp3': 'audio/mpeg',
                '.svg': 'image/svg+xml',
                '.pdf': 'application/pdf',
                '.doc': 'application/msword',
                '.gif': 'image/gif'
              }
              if (mimeMap[ext] || (wiki.tw.settings.allowUnsafeMimeTypes && wiki.tw.settings.accptance === "I Will Not Get Tech Support For This")) {
                response.writeHead(200, {"Content-type": mimeMap[ext] || "text/plain"})
                response.end(data)
              } else {
                response.writeHead(403)
                response.end()
              }
            }
          })
        })
      } else {
        response.writeHead(403)
        response.end()
      }
    })
  }
}

addRoutes()

wiki.tw.httpServer = {}

// Here these two functions are placeholders, they don't do anything here.
wiki.tw.httpServer.addOtherRoutes = function () {

}

wiki.tw.httpServer.clearRoutes = function () {

}

module.exports = wiki
