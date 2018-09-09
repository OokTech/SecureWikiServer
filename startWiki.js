var settings = require('./LoadConfig.js')
var express = require('express')
var wiki = {}
wiki.router = express.Router()

const path = require('path')
const fs = require('fs')
const jwt = require('jsonwebtoken')

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
  This is a generic function to check if a person has a permission on a wiki
  based on the token they sent.
*/
function checkPermission (response, fullName, permission) {
  settings = require('./LoadConfig.js')
  settings.wikis = settings.wikis || {}
  settings.wikis[fullName] = settings.wikis[fullName] || {}
  settings.wikis[fullName].access = settings.wikis[fullName].access || {}
  // If the wiki is set as public than anyone can view it
  if (settings.wikis[fullName].public && permission === 'view') {
    return true
  } else if (response.decoded) {
    // If the logged in person is the owner than they can view and edit it
    if (typeof response.decoded.name === 'string' && response.decoded.name === settings.wikis[fullName].owner && ['view', 'edit'].indexOf(permission) !== -1) {
      return true
    } else if (settings.wikis[fullName].access[response.decoded.level]) {
      // If the logged in level of the person can view the wiki than they
      // can view it.
      if (settings.wikis[fullName].access[response.decoded.level].indexOf(permission) !== -1) {
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

/*
  This function returns true if the logged in person has authorisation to
  upload images for this wiki.
  Wiki owners do not automatically get upload privlidges
*/
function checkUploadAuthorisation (response, fullName) {
  settings = require('./LoadConfig.js')
  settings.wikis = settings.wikis || {}
  settings.wikis[fullName] = settings.wikis[fullName] || {}
  settings.wikis[fullName].access = settings.wikis[fullName].access || {}
  if (response.decoded) {
    if (settings.wikis[fullName].access[response.decoded.level]) {
      if (settings.wikis[fullName].access[response.decoded.level].indexOf("upload") !== -1) {
        // If the person is authenticated and has upload permissions on this
        // wiki than allow uploads.
        return true
      } else {
        // No upload permissions given to the logged in level
        return false
      }
    } else {
      // No access for this wiki at the authenticated level
      return false
    }
  } else {
    // Unauthenticated people can't upload things.
    return false
  }
}

var addRoutes = function () {
  /*
    This is for getting the root wiki
  */
  wiki.router.get('/', function(request,response) {
    // Add a check to make sure that the person logged in is authorised
    // to open the wiki.
    var authorised = checkAuthorisation(response, 'RootWiki')
    if (authorised) {
      // Load the wiki
      wiki.tw.ServerSide.loadWiki('RootWiki', wiki.tw.boot.wikiPath)
      // Get the raw html to send
      var text = wiki.tw.ServerSide.prepareWiki('RootWiki', true)
      // Send the html to the server
      response.writeHead(200, {"Content-Type": "text/html"})
      response.end(text,"utf8")
    } else {
      response.end(unauthorised, "utf8")
    }
  })

  /*
    This is for uploading media files
  */
  wiki.router.post('/upload', function (request, response) {
    var authorised = checkUploadAuthorisation(response, request.get('x-wiki-name'))
    if (authorised) {
      var body = ''
      request.on('data', function (data) {
        body += data
        if (body.length > 10e6) {
          request.connection.destroy()
        }
      });
      request.on('end', function () {
        var parsedBody = JSON.parse(body)
        var filesPath = path.join(wiki.tw.Bob.Wikis[parsedBody.wiki].wikiPath, 'files')
        console.log('Uploaded ',filesPath,'/',parsedBody.tiddler.fields.title,' for ',parsedBody.wiki)
        var buf = Buffer.from(parsedBody.tiddler.fields.text,'base64')
        //Make sure that the folder exists
        try {
          fs.mkdirSync(filesPath)
        } catch (e) {
          console.log(e)
        }
        fs.writeFile(path.join(filesPath, parsedBody.tiddler.fields.title), buf, function(error) {
          if (error) {
            console.log(error)
          } else {
            console.log("C'est fini!")
            return true
          }
        })
      })
      // TODO return some sort of response!
      response.end()
    } else {
      response.writeHead(404)
      response.end()
    }
  })

  wiki.router.get('/files/:filePath', function (request, response) {
    loadMediaFile(request, response)
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

  settings.API = settings.API || {}
  // Check bodyData and response.decoded to see if pushing is allowed
  function canPushToWiki(bodyData, response) {
    // Check if the token response.decoded gives write access to bodyData.toWiki
    settings = require('./LoadConfig.js')
    settings.wikis = settings.wikis || {}
    settings.wikis[bodyData.toWiki] = settings.wikis[bodyData.toWiki] || {}
    settings.wikis[bodyData.toWiki].access = settings.wikis[bodyData.toWiki].access || {}
    var key = fs.readFileSync(path.join(require('os').homedir(), settings.tokenPrivateKeyPath))
    var decoded = jwt.verify(bodyData.token, key)
    if (decoded) {
      if (settings.wikis[bodyData.toWiki].access[decoded.level]) {
        if (settings.wikis[bodyData.toWiki].access[decoded.level].indexOf("edit") !== -1) {
          // If the person is authenticated and has upload permissions on this
          // wiki than allow uploads.
          return true
        } else {
          // No upload permissions given to the logged in level
          return false
        }
      } else {
        // No access for this wiki at the authenticated level
        return false
      }
    } else {
      // Unauthenticated people can't upload things.
      return false
    }
  }
  function canFetchFromwiki (bodyData, response) {
    // Check if the token response.decoded gives view access to
    // bodyData.fromWiki
    settings = require('./LoadConfig.js')
    settings.wikis = settings.wikis || {}
    settings.wikis[bodyData.fromWiki] = settings.wikis[bodyData.fromWiki] || {}
    settings.wikis[bodyData.fromWiki].access = settings.wikis[bodyData.fromWiki].access || {}
    // People can fetch from public wikis without authentication
    if (settings.wikis[bodyData.fromWiki].public) {
      return true
    } else {
      var key = fs.readFileSync(path.join(require('os').homedir(), settings.tokenPrivateKeyPath))
      var decoded = jwt.verify(bodyData.token, key)
      if (decoded) {
        if (settings.wikis[bodyData.fromWiki].access[decoded.level]) {
          if (settings.wikis[bodyData.fromWiki].access[decoded.level].indexOf("view") !== -1) {
            // If the person is authenticated and has upload permissions on this
            // wiki than allow uploads.
            return true
          } else {
            // No upload permissions given to the logged in level
            return false
          }
        } else {
          // No access for this wiki at the authenticated level
          return false
        }
      } else {
        return false
      }
    }
  }
  if (settings.API.pluginLibrary === 'yes') {
    // List the available plugins
    /*
      The response is a pluginInfoList where:
      pluginInfoList = [pluginInfo]
      pluginInfo = {name, tiddlerName, version, readme}
    */
    wiki.router.post('/api/plugins/list', function(request, response) {
      var wikiPluginsPath = path.resolve(require('os').homedir(), settings.pluginsPath, './OokTech')
      var pluginList = []
    	if(fs.existsSync(wikiPluginsPath)) {
    		var pluginFolders = fs.readdirSync(wikiPluginsPath)
    		for(var t=0; t<pluginFolders.length; t++) {
    			pluginFields = wiki.tw.loadPluginFolder(path.resolve(wikiPluginsPath,"./" + pluginFolders[t]))
    			if(pluginFields) {
            var readme = ""
    				try {
              // Try pulling out the plugin readme
              var pluginJSON = JSON.parse(pluginFields.text).tiddlers
              readme = pluginJSON[Object.keys(pluginJSON).filter(function(title) {
                return title.toLowerCase().endsWith('/readme')
              })[0]]
            } catch (e) {
              console.log('Error parsing plugin', e)
            }
            if (readme) {
              readmeText = readme.text
            } else {
              readmeText = ''
            }
            var nameParts = pluginFields.title.split('/')
            var name = nameParts[nameParts.length-2] + '/' + nameParts[nameParts.length-1]
            var listInfo = {
              name: name,
              description: pluginFields.description,
              tiddlerName: pluginFields.title,
              version: pluginFields.version,
              author: pluginFields.author,
              readme: readmeText
            }
            pluginList.push(listInfo)
    			}
    		}
    	}
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.status(200)
      response.end(JSON.stringify(pluginList))
    })
    // Fetch a specific plugin
    wiki.router.post('/api/plugins/fetch/:author/:pluginName', function(request, response) {
      var wikiPluginsPath = path.resolve(require('os').homedir(), settings.pluginsPath, request.params.author, request.params.pluginName)
      // Make sure that we don't allow url tricks to access things people
      // aren't supposed to
      if (wikiPluginsPath.startsWith(path.resolve(require('os').homedir(), settings.pluginsPath))) {
        var pluginFields = wiki.tw.loadPluginFolder(wikiPluginsPath)
        if (pluginFields) {
          response.setHeader('Access-Control-Allow-Origin', '*')
          response.status(200)
          response.end(JSON.stringify(pluginFields))
        } else {
          response.status(403)
          response.end()
        }
      } else {
        response.status(403)
        response.end()
      }
    })
  }
  if (settings.API.enableFetch === 'yes') {
    wiki.router.post('/api/fetch/list', function(request, response) {
      var body = ''
      var list
      var data = {}
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.writeHead(200, {"Content-Type": "application/json"});
      try {
        var bodyData = JSON.parse(request.body.message)
        hasAccess = canFetchFromwiki(bodyData, response)
        if (hasAccess) {
          if (bodyData.filter && bodyData.fromWiki) {
            // Make sure that the wiki is listed
            if (wiki.tw.settings.wikis[bodyData.fromWiki] || bodyData.fromWiki === 'RootWiki') {
              if (!wiki.tw.Bob.Wikis) {
                wiki.tw.ServerSide.loadWiki(bodyData.fromWiki, wiki.tw.boot.wikiPath);
              }
              // If the wiki isn't loaded than load it
              if (!wiki.tw.Bob.Wikis[bodyData.fromWiki]) {
                wiki.tw.ServerSide.loadWiki(bodyData.fromWiki, wiki.tw.settings.wikis[bodyData.fromWiki]);
              } else if (wiki.tw.Bob.Wikis[bodyData.fromWiki].State !== 'loaded') {
                wiki.tw.ServerSide.loadWiki(bodyData.fromWiki, wiki.tw.settings.wikis[bodyData.fromWiki]);
              }
              // Make sure that the wiki exists and is loaded
              if (wiki.tw.Bob.Wikis[bodyData.fromWiki]) {
                if (wiki.tw.Bob.Wikis[bodyData.fromWiki].State === 'loaded') {
                  // Make a temp wiki to run the filter on
                  var tempWiki = new wiki.tw.Wiki();
                  wiki.tw.Bob.Wikis[bodyData.fromWiki].tiddlers.forEach(function(internalTitle) {
                    var tiddler = wiki.tw.wiki.getTiddler(internalTitle);
                    var newTiddler = JSON.parse(JSON.stringify(tiddler));
                    newTiddler.fields.modified = wiki.tw.utils.stringifyDate(new Date(newTiddler.fields.modified));
                    newTiddler.fields.created = wiki.tw.utils.stringifyDate(new Date(newTiddler.fields.created));
                    newTiddler.fields.title = newTiddler.fields.title.replace('{' + bodyData.fromWiki + '}', '');
                    // Add all the tiddlers that belong in wiki
                    tempWiki.addTiddler(new wiki.tw.Tiddler(newTiddler.fields));
                  })
                  // Use the filter
                  list = tempWiki.filterTiddlers(bodyData.filter);
                }
              }
            }
            // Send the tiddlers
            data = {list: list}
            data = JSON.stringify(data) || "";
            response.end(data);
          }
        } else {
          // Don't have access
          data = "";
          response.status(403);
          response.end(false);
        }
      } catch (e) {
        data = JSON.stringify(data) || "";
        response.end(data);
      }
      response.status(403);
      response.end()
    })
    wiki.router.post('/api/fetch', function(request, response) {
      var body = ''
      var list
      var data = {}
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.writeHead(200, {"Content-Type": "application/json"});
      try {
        var bodyData = JSON.parse(request.body.message)
        hasAccess = canFetchFromwiki(bodyData, response)
        if (hasAccess) {
          if (bodyData.filter && bodyData.fromWiki) {
            // Make sure that the wiki is listed
            if (wiki.tw.settings.wikis[bodyData.fromWiki] || bodyData.fromWiki === 'RootWiki') {
              if (!wiki.tw.Bob.Wikis) {
                wiki.tw.ServerSide.loadWiki(bodyData.fromWiki, wiki.tw.boot.wikiPath);
              }
              // If the wiki isn't loaded than load it
              if (!wiki.tw.Bob.Wikis[bodyData.fromWiki]) {
                wiki.tw.ServerSide.loadWiki(bodyData.fromWiki, wiki.tw.settings.wikis[bodyData.fromWiki]);
              } else if (wiki.tw.Bob.Wikis[bodyData.fromWiki].State !== 'loaded') {
                wiki.tw.ServerSide.loadWiki(bodyData.fromWiki, wiki.tw.settings.wikis[bodyData.fromWiki]);
              }
              // Make sure that the wiki exists and is loaded
              if (wiki.tw.Bob.Wikis[bodyData.fromWiki]) {
                if (wiki.tw.Bob.Wikis[bodyData.fromWiki].State === 'loaded') {
                  // Make a temp wiki to run the filter on
                  var tempWiki = new wiki.tw.Wiki();
                  wiki.tw.Bob.Wikis[bodyData.fromWiki].tiddlers.forEach(function(internalTitle) {
                    var tiddler = wiki.tw.wiki.getTiddler(internalTitle);
                    var newTiddler = JSON.parse(JSON.stringify(tiddler));
                    newTiddler.fields.modified = wiki.tw.utils.stringifyDate(new Date(newTiddler.fields.modified));
                    newTiddler.fields.created = wiki.tw.utils.stringifyDate(new Date(newTiddler.fields.created));
                    newTiddler.fields.title = newTiddler.fields.title.replace('{' + bodyData.fromWiki + '}', '');
                    // Add all the tiddlers that belong in wiki
                    tempWiki.addTiddler(new wiki.tw.Tiddler(newTiddler.fields));
                  })
                  // Use the filter
                  list = tempWiki.filterTiddlers(bodyData.filter);
                }
              }
            }
            var tiddlers = {}
            list.forEach(function(title) {
              tiddlers[title] = tempWiki.getTiddler(title)
            })
            // Send the tiddlers
            data = {list: list, tiddlers: tiddlers}
            data = JSON.stringify(data) || "";
            response.end(data);
          }
        } else {
          // Don't have access
          data = "";
          response.status(403);
          response.end(false);
        }
      } catch (e) {
        data = JSON.stringify(data) || "";
        response.end(data);
      }
      response.status(403);
      response.end()
    })
  }

  if (settings.API.enablePush === 'yes') {
    wiki.router.post('/api/push', function(request, response) {
      response.setHeader('Access-Control-Allow-Origin', '*')
      try {
        var bodyData = JSON.parse(request.body.message)
        // Make sure that the token sent here matches the https header
        // and that the token has push access to the toWiki
        var allowed = canPushToWiki(bodyData, response)
        if (allowed) {
          if (wiki.tw.settings.wikis[bodyData.toWiki] || bodyData.toWiki === 'RootWiki') {
            wiki.tw.ServerSide.loadWiki(bodyData.toWiki, wiki.tw.settings.wikis[bodyData.toWiki]);
            // Make sure that the wiki exists and is loaded
            if (wiki.tw.Bob.Wikis[bodyData.toWiki]) {
              if (wiki.tw.Bob.Wikis[bodyData.toWiki].State === 'loaded') {
                if (bodyData.tiddlers && bodyData.toWiki) {
                  Object.keys(bodyData.tiddlers).forEach(function(title) {
                    bodyData.tiddlers[title].fields.modified = wiki.tw.utils.stringifyDate(new Date(bodyData.tiddlers[title].fields.modified));
                    bodyData.tiddlers[title].fields.created = wiki.tw.utils.stringifyDate(new Date(bodyData.tiddlers[title].fields.created));
                    wiki.tw.syncadaptor.saveTiddler(bodyData.tiddlers[title], bodyData.toWiki);
                  });
                  response.writeHead(200)
                  response.end()
                }
              }
            }
          }
        } else {
          response.writeHead(400)
          response.end()
        }
      } catch (e) {
        response.writeHead(403)
        response.end()
      }
    })
  }

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

  wiki.router.get('/:wikiName/files/:filePath', function (request, response) {
    loadMediaFile(request, response)
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

function loadMediaFile(request, response) {
  var wikiName = request.params.wikiName;
  wiki.tw.settings.mimeMap = wiki.tw.settings.mimeMap || {
    '.aac': 'audio/aac',
    '.avi': 'video/x-msvideo',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.epub': 'application/epub+zip',
    '.gif': 'image/gif',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.mpeg': 'video/mpeg',
    '.oga': 'audio/ogg',
    '.ogv': 'video/ogg',
    '.ogx': 'application/ogg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.weba': 'audio/weba',
    '.webm': 'video/webm',
    '.wav': 'audio/wav'
  }
  var authorised = checkAuthorisation(response, wikiName)
  if (authorised) {
    //Make sure that the file type is listed in the mimeMap
    if (wiki.tw.settings.mimeMap[path.extname(request.params.filePath).toLowerCase()]) {
      var fileFolderPath = path.join(wiki.tw.Bob.Wikis[wikiName].wikiPath, 'files')
      var file = path.join(fileFolderPath, request.params.filePath)
      // Make sure that there aren't any sneaky things like '../../../.ssh' in
      // the resolved file path.
      if (file.startsWith(fileFolderPath)) {
        fs.access(file, fs.constants.F_OK, function (error) {
          if (error) {
            console.log(error)
            // File doesn't exist, reply with 404 or something like that
          } else {
            // File exists! Reply with the file.
            fs.readFile(file, function (err, data) {
              if (err) {
                // Problem, return 404
                response.writeHead(404)
                response.end()
              } else {
                // return file with mimetype
                response.writeHead(200, {"Content-Type": wiki.tw.settings.mimeMap[path.extname(request.params.filePath).toLowerCase()]})
                response.end(data)
              }
            })
          }
        })
      }
    } else {
      response.writeHead(404)
    }
  }
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
