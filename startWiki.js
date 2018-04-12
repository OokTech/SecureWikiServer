var express = require('express')
var wiki = {}
wiki.router = express.Router()

wiki.tw = require("./TiddlyWiki5/boot/boot.js").TiddlyWiki()

// Fake the command line arguments
//var args = ['./Wikis/IndexWiki','--wsserver']
var args = ['./Wikis/IndexWiki','--secure']
wiki.tw.boot.argv = args//Array.prototype.slice.call(process.argv,2)

// Boot the TW5 app
wiki.tw.boot.boot()

wiki.router.get('/', function(request,response) {
  // Load the wiki
  wiki.tw.ServerSide.loadWiki('RootWiki', wiki.tw.boot.wikiPath);
  // Get the raw html to send
  var text = wiki.tw.ServerSide.prepareWiki('RootWiki', true);
  // Send the html to the server
  response.writeHead(200, {"Content-Type": "text/html"});
  response.end(text,"utf8");
})

wiki.router.get('/favicon', function(request,response) {
  response.writeHead(200, {"Content-Type": "image/x-icon"});
  var buffer = wiki.tw.wiki.getTiddlerText("$:/favicon.ico","");
  response.end(buffer,"base64");
})

wiki.router.prototype.addRoutesThing = function (inputObject, prefix) {
  if (typeof inputObject === 'object') {
    Object.keys(inputObject).forEach(function (wikiName) {
      if (typeof inputObject[wikiName] === 'string') {
        if (prefix === '') {
          var fullName = wikiName;
        } else {
          fullName = prefix + '/' + wikiName;
        }

        // Make route handler
        this.get(new RegExp('^\/' + fullName + '\/?$'), function(request, response, next) {
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
        })


        // And add the favicon route for the child wikis
        this.get(/^\/' + fullName + '\/favicon.ico$/, function(request,response,next) {
          response.writeHead(200, {"Content-Type": "image/x-icon"});
          var buffer = wiki.tw.wiki.getTiddlerText("{" + fullName + "}" + "$:/favicon.ico","");
          response.end(buffer,"base64");
        })
        console.log("Added route " + String(new RegExp('^\/' + fullName + '\/?$')))
      } else {
        // recurse!
        // This needs to be a new variable or else the rest of the wikis at
        // this level will get the longer prefix as well.
        var nextPrefix = prefix===''?wikiName:prefix + '/' + wikiName;
        this.addRoutesThing(inputObject[wikiName], nextPrefix);
      }
    })
  }
}

module.exports = wiki
