var settings = require('./LoadConfig.js')
var express = require('express')
var wiki = {}
wiki.router = express.Router()
var fileRouter = express.Router()

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

var checkPermission = require('./js/checkPermissions.js')

var addRoutes = function () {
  /*
    This is for getting the root wiki
  */
  wiki.router.get('/', function(request,response) {
    // Add a check to make sure that the person logged in is authorised
    // to open the wiki.
    var authorised = checkPermission('RootWiki', response, 'view')
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
    var authorised = checkPermission(request.get('x-wiki-name'), response, 'upload')
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
    loadMediaFile(request, response, "RootWiki")
  })

  wiki.router.get('/favicon', function(request,response) {
    // Add a check to make sure that the person logged in is authorised
    // to open the wiki.
    var authorised = checkPermission('RootWiki', response, 'view')
    if (authorised) {
      response.writeHead(200, {"Content-Type": "image/x-icon"});
      var buffer = wiki.tw.wiki.getTiddlerText("$:/favicon.ico","");
      response.end(buffer,"base64");
    }
  })

  settings.API = settings.API || {}
  // Check if the access token gives the privlidegs needed to push plugins to
  // the library
  function canPushPlugin (bodyData, response) {
    settings = require('./LoadConfig.js')
    if (settings.admin) {
      if (settings.admin.pushPlugins) {
        var key = require('./js/loadSecrets.js')
        var decoded = jwt.verify(bodyData.token, key)
        if (decoded) {
          if (settings.admin.pushPlugins.indexOf(decoded.level) !== -1) {
            return true
          }
        }
      }
    }
    return false
  }
  if (settings.API.pluginLibrary === 'yes') {
    // List the available plugins
    /*
      The response is a pluginInfoList where:
      pluginInfoList = [pluginInfo]
      pluginInfo = {name, tiddlerName, version, readme}
    */
    var getPluginList = function () {
      var pluginList = []
      if (typeof settings.pluginsPath === 'string') {
        var pluginsPath = path.resolve(settings.pluginsPath)
        if(fs.existsSync(pluginsPath)) {
          var pluginAuthors = fs.readdirSync(pluginsPath)
          pluginAuthors.forEach(function (author) {
            var pluginAuthorPath = path.join(pluginsPath, './', author)
            if (fs.statSync(pluginAuthorPath).isDirectory()) {
              var pluginAuthorFolders = fs.readdirSync(pluginAuthorPath)
              for(var t=0; t<pluginAuthorFolders.length; t++) {
                var fullPluginFolder = path.join(pluginAuthorPath,pluginAuthorFolders[t])
                var pluginFields = wiki.tw.loadPluginFolder(fullPluginFolder)
                if(pluginFields) {
                  var readme = ""
                  var readmeText = ''
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
          })
        }
      }
      return pluginList
    }
    wiki.router.post('/api/plugins/list', function(request, response) {
      var pluginList = getPluginList()
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
    // Add a plugin to the library
    wiki.router.post('/api/plugins/upload', function(request, response) {
      try {
        var bodyData = JSON.parse(request.body.message)
        var canPush = canPushPlugin(bodyData, response)
        if (canPush) {
          // Save plugin
          const fs = require('fs')
          const path = require('path')
          var tempWiki = new wiki.tw.Wiki()
          var pluginName = data.plugin.title.replace('^$:/plugins')
          // Make sure plugin folder exists
          var pluginFolderPath = path.resolve(wiki.tw.settings.pluginsPath, pluginName)
          var error = wiki.tw.utils.createDirectory(pluginFolderPath);

          Object.keys(data.plugin.text).forEach(function(tidTitle) {
            var tiddler = new wiki.tw.Tiddler(data.plugin.text[tidTitle], {title: tidTitle})
            if (tiddler) {
              tempWiki.addTiddler(tiddler)
              var title = tiddler.fields.title;
              var filepath = pluginFolderPath + path.sep + pluginName
              // Save the tiddler as a self contained templated file
              var content = tempWiki.renderTiddler("text/plain", "$:/core/templates/tid-tiddler", {variables: {currentTiddler: title}});
              // If we aren't passed a path
              fs.writeFile(filepath,content,{encoding: "utf8"},function (err) {
                if(err) {
                  console.log(err);
                } else {
                  console.log('saved file', filepath)
                }
              });
            }
          })
          // Build the plugin.info file
          var pluginInfo = {}
          Object.keys(data.plugin).forEach(function(field) {
            if (field !== 'text') {
              pluginInfo[field] = data.plugin[field]
            }
          })
          filepath = pluginFolderPath + path.sep + 'plugin.info'
          fs.writeFile(filepath, JSON.stringify(pluginInfo, null, 2), function (err) {
            if (err) {
              console.log(err)
            } else {
              console.log('save plugin.info')
            }
          })
        }
      } catch (e) {

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
        var hasAccess = checkPermission(bodyData.fromWiki, response, 'fetch')
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
                    if (tiddler) {
                      var newTiddler = JSON.parse(JSON.stringify(tiddler));
                      newTiddler.fields.modified = wiki.tw.utils.stringifyDate(new Date(newTiddler.fields.modified));
                      newTiddler.fields.created = wiki.tw.utils.stringifyDate(new Date(newTiddler.fields.created));
                      newTiddler.fields.title = newTiddler.fields.title.replace('{' + bodyData.fromWiki + '}', '');
                      // Add all the tiddlers that belong in wiki
                      tempWiki.addTiddler(new wiki.tw.Tiddler(newTiddler.fields));
                    }
                  })
                  // Use the filter
                  list = tempWiki.filterTiddlers(bodyData.filter);
                }
              }
            }
            var info = {}
            list.forEach(function(title) {
              var tempTid = tempWiki.getTiddler(title)
              info[title] = {}
              if (bodyData.fieldList) {
                bodyData.fieldList.split(' ').forEach(function(field) {
                  info[title][field] = tempTid.fields[field]
                })
              } else {
                info[title]['modified'] = tempTid.fields.modified
              }
            })
            // Send the tiddlers
            data = {list: list, info: info}
            data = JSON.stringify(data) || "";
            response.end(data);
          }
        } else {
          // Don't have access
          response.status(403);
          response.end(false);
        }
      } catch (e) {
        console.log(e)
        //data = JSON.stringify(data) || "";
        response.status(403);
        response.end();
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
        var hasAccess = checkPermission(bodyData.fromWiki, response, 'fetch')
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
                    if (tiddler) {
                      var newTiddler = JSON.parse(JSON.stringify(tiddler));
                      newTiddler.fields.modified = wiki.tw.utils.stringifyDate(new Date(newTiddler.fields.modified));
                      newTiddler.fields.created = wiki.tw.utils.stringifyDate(new Date(newTiddler.fields.created));
                      newTiddler.fields.title = newTiddler.fields.title.replace('{' + bodyData.fromWiki + '}', '');
                      // Add all the tiddlers that belong in wiki
                      tempWiki.addTiddler(new wiki.tw.Tiddler(newTiddler.fields));
                    }
                  })
                  // Use the filter
                  list = tempWiki.filterTiddlers(bodyData.filter);
                }
              }
            }
            var tiddlers = {}
            var info = {}
            list.forEach(function(title) {
              var tempTid = tempWiki.getTiddler(title)
              tiddlers[title] = tempTid
              info[title] = {}
              if (bodyData.fieldList) {
                bodyData.fieldList.split(' ').forEach(function(field) {
                  info[title][field] = tempTid.fields[field];
                })
              } else {
                info[title]['modified'] = tempTid.fields.modified;
              }
            })
            // Send the tiddlers
            data = {list: list, tiddlers: tiddlers, info: info}
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
        var allowed = checkPermission(bodyData.toWiki, response, 'push')
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
    var authorised = checkPermission(request.params.wikiName, response, 'view')
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
    var authorised = checkPermission(request.params.wikiName, response, 'view')
    if (authorised) {
      response.writeHead(200, {"Content-Type": "image/x-icon"})
      var buffer = wiki.tw.Bob.Wikis[request.params.wikiName].wiki.getTiddlerText("$:/favicon.ico","")
      response.end(buffer,"base64")
    } else {
      response.writeHead(403)
      response.end()
    }
  })

  wiki.router.get('/:wikiName/files/:filePath', function (request, response) {
    loadMediaFile(request, response, request.params.wikiName)
  })

  wiki.router.get('/*/files/*', function (request, response) {
    function findName(url) {
      var pieces = url.split('/')
      var name = pieces[0]
      var settingsObj = wiki.tw.settings.wikis[name]
      for (var i = 1; i < pieces.length; i++) {
        if (typeof settingsObj[pieces[i]] === 'object') {
          name = name + '/' + pieces[i]
          settingsObj = settingsObj[pieces[i]]
        } else if (typeof settingsObj[pieces[i]] === 'string') {
          name = name + '/' + pieces[i]
          break
        } else {
          break
        }
      }
      return name
    }
    var wikiName = findName(request.url.slice(1))
    var filePath = request.url.slice(7+wikiName.length)
    request.params.wikiName = wikiName
    request.params.filePath = filePath
    loadMediaFile(request, response, wikiName)
  })

  wiki.router.get('/*/favicon.ico', function(request, response) {
    var wikiName = request.url.slice(1, -12)
    var authorised = checkPermission(wikiName, response, 'view')
    if (authorised) {
      response.writeHead(200, {"Content-Type": "image/x-icon"})
      var buffer = wiki.tw.Bob.Wikis[request.params.wikiName].wiki.getTiddlerText("$:/favicon.ico","")
      response.end(buffer,"base64")
    } else {
      response.writeHead(403)
      response.end()
    }
  })

  wiki.router.get('/*', function(request, response) {
    var wikiName = request.url.slice(1)
    var authorised = checkPermission(wikiName, response, 'view')
    if (authorised) {
      // Get wiki path
      var nameParts = wikiName.split('/')
      var pathsObject = wiki.tw.settings.wikis || {}
      nameParts.forEach(function(part) {
        pathsObject = pathsObject[part] || "";
      })
      // Make sure we have loaded the wiki tiddlers.
      // This does nothing if the wiki is already loaded.
      var exists = wiki.tw.ServerSide.loadWiki(wikiName, pathsObject);
      if (exists) {
        // If servePlugin is not false than we strip out the filesystem
        // and tiddlyweb plugins if they are there and add in the
        // multiuser plugin.
        var servePlugin = !wiki.tw.settings['ws-server'].servePlugin || wiki.tw.settings['ws-server'].servePlugin !== false;
        // Get the full text of the html wiki to send as the response.
        var text = wiki.tw.ServerSide.prepareWiki(wikiName, servePlugin);
      } else {
        var text = "<html><p>No wiki found! Either there is no usable tiddlywiki.info file in the listed location or it isn't listed.</p></html>"
      }
      response.writeHead(200, {"Content-Type": "text/html"});
      response.end(text,"utf8");
    } else {
      response.end(unauthorised, "utf8")
    }
  })
}

/*
  This is used to load a media file from the server
  It needs to be updated to support files for individual wikis
*/
function loadMediaFile(request, response, wikiName) {
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
  var authorised = checkPermission(wikiName, response, 'view')
  if (authorised) {
    //Make sure that the file type is listed in the mimeMap
    if (wiki.tw.settings.mimeMap[path.extname(request.params.filePath).toLowerCase()]) {
      var fileFolderPath = path.resolve(wiki.tw.Bob.Wikis[wikiName].wikiPath, 'files')
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
  var baseDir = settings.filePathBase === 'homedir'?require('os').homedir():settings.filePathBase
  var defaultPath = path.resolve(baseDir,settings.wikiPermissionsPath)
  var localPath = path.resolve(baseDir,settings.localWikiPermissionsPath)
  var localWikiPermissions = settings.loadConfig(defaultPath, localPath).local
  localWikiPermissions.wikis = localWikiPermissions.wikis || {}
  localWikiPermissions.wikis[name] = {}
  localWikiPermissions.wikis[name].public = data.public || false
  localWikiPermissions.wikis[name].owner = data.decoded.name
  settings.saveSetting(localWikiPermissions, localPath)
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

// Set the access control function for Bob
wiki.tw.Bob.AccessCheck = function(wikiName, token, action) {
  return checkPermission(wikiName, token, action)
}

module.exports = wiki
