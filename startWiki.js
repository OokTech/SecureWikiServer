var settings = require('./LoadConfig.js')
var express = require('express')
var wiki = {}
wiki.router = express.Router()

const path = require('path')

/*
  This next block lets us set environment variables from the config files
  instead of the command line.
*/
if (typeof settings.pluginsPath === 'string') {
  var resolvedpluginspath = path.resolve(settings.pluginsPath);
  if (process.env["TIDDLYWIKI_PLUGIN_PATH"] !== undefined && process.env["TIDDLYWIKI_PLUGIN_PATH"] !== '') {
    process.env["TIDDLYWIKI_PLUGIN_PATH"] = process.env["TIDDLYWIKI_PLUGIN_PATH"] + path.delimiter + resolvedpluginspath;
  } else {
    process.env["TIDDLYWIKI_PLUGIN_PATH"] = resolvedpluginspath;
  }
}
if (typeof settings.themesPath === 'string') {
  var resolvedthemespath = path.resolve(settings.themesPath);
  if (process.env["TIDDLYWIKI_THEME_PATH"] !== undefined && process.env["TIDDLYWIKI_THEME_PATH"] !== '') {
    process.env["TIDDLYWIKI_THEME_PATH"] = process.env["TIDDLYWIKI_THEME_PATH"] + path.delimiter + resolvedthemespath;
  } else {
    process.env["TIDDLYWIKI_THEME_PATH"] = resolvedthemespath;
  }
}
if (typeof settings.editionsPath === 'string') {
  var resolvededitionspath = path.resolve(settings.editionsPath)
  if (process.env["TIDDLYWIKI_EDITION_PATH"] !== undefined && process.env["TIDDLYWIKI_EDITION_PATH"] !== '') {
    process.env["TIDDLYWIKI_EDITION_PATH"] = process.env["TIDDLYWIKI_EDITION_PATH"] + path.delimiter + resolvededitionspath;
  } else {
    process.env["TIDDLYWIKI_EDITION_PATH"] = resolvededitionspath;
  }
}

wiki.tw = require("./TiddlyWiki5/boot/boot.js").TiddlyWiki()

var baseDir = settings.wikiPathBase === 'homedir'?require('os').homedir():settings.wikiPathBase
var wikisPath = settings.wikisPath || 'Wikis'
var rootWikiName = settings.rootWikiName || 'IndexWiki'

var RootWikiPath = path.resolve(baseDir, wikisPath, rootWikiName)

// Fake the command line arguments
var args = [RootWikiPath, '--externalserver']
wiki.tw.boot.argv = args

// Boot the TW5 app
wiki.tw.boot.boot()

var unauthorised = "<html><p>You don't have the authorisation to view this wiki.</p> <p><a href='/'>Return to login</a></p></html>"

/*
  This checks to see if the person has viewing permissions.
  Other permisions (edit, etc.) are checked when the person tries to use them.
*/
function checkAuthorisation (response, fullName) {
  settings = require('./LoadConfig.js')
  settings.wikis = settings.wikis || {}
  settings.wikis[fullName] = settings.wikis[fullName] || {}
  settings.wikis[fullName].access = settings.wikis[fullName].access || {}
  // If the wiki is set as public than anyone can view it
  if (settings.wikis[fullName].public) {
    return true
  } else if (response.decoded) {
    // If the logged in person is the owner than they can view it
    if (typeof response.decoded.name === 'string' && response.decoded.name === settings.wikis[fullName].owner) {
      return true
    } else if (settings.wikis[fullName].access[response.decoded.level]) {
      // If the logged in level of the person can view the wiki than they
      // can view it.
      if (settings.wikis[fullName].access[response.decoded.level].indexOf("view") !== -1) {
        return true
      } else {
        // No view permissions given to the logged in level
        return false
      }
    } else {
      // No access for the logged in level
      return false
    }
  } else {
    // No valid token was supplied
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

/*
  This function initialises the access settings for a new wiki

  name is the name of the wiki actually used (it may be different than what
  is supplied in data due to naming conflicts)
  data is the message from the browser. data.name is the person who made the
  wiki.

  data can have permissions listed in it, but only up as high as the person
  has permissions.

  So if the person making the wiki has edit, view and admin access they
  couldn't give script access to anyone on the new wiki.

  owner = data.name
  public = data.public || false
  [wikis.(name).access]
    (optional access things here)
    Guest=["view"]

  All of these settings go into Local.toml
*/
wiki.tw.ExternalServer = wiki.tw.ExternalServer || {}
wiki.tw.ExternalServer.initialiseWikiSettings = function(name, data) {
  localSettings = settings.Local
  localSettings.wikis = localSettings.wikis || {}
  localSettings.wikis[name] = {}
  localSettings.wikis[name].public = data.public || false
  localSettings.wikis[name].owner = data.decoded.name
  settings.saveSetting(localSettings)
}

// Here these two functions are placeholders, they don't do anything here.
// They are needed to make this work with the non-express server components.
wiki.tw.httpServer = {}
wiki.tw.httpServer.addOtherRoutes = function () {
  // Does nothing!
}
wiki.tw.httpServer.clearRoutes = function () {
  // Also does nothing!
}

module.exports = wiki
