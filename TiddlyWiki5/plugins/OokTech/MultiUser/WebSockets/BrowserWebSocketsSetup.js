/*\
title: $:/plugins/OokTech/MultiUser/BrowserWebSocketsSetup.js
type: application/javascript
module-type: startup

This is the browser component for the web sockets. It works with the node web
socket server, but it can be extended for use with other web socket servers.

\*/
(function () {

  /*jslint node: true, browser: true */
  /*global $tw: false */
  "use strict";

  // Export name and synchronous status
  exports.name = "web-sockets-setup";
  exports.platforms = ["browser"];
  exports.after = ["render"];
  exports.synchronous = true;

  $tw.browserMessageHandlers = $tw.browserMessageHandlers || {};

  // This is needed for IE compatibility
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(search, pos) {
      return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
    };
  }

  exports.startup = function() {
    // Ensure that the needed objects exist
    $tw.MultiUser = $tw.MultiUser || {};
    $tw.MultiUser.ExcludeFilter = $tw.wiki.getTiddlerText('$:/plugins/OokTech/MultiUser/ExcludeSync');

    // Do all actions on startup.
    function setup() {
      $tw.Syncer.isDirty = false;
      var IPTiddler = $tw.wiki.getTiddler("$:/WikiSettings/split/ws-server");
      try {
        var output = JSON.parse(IPTiddler.fields.text);
      } catch (e) {
        var output = {};
      }
      var IPAddress = window.location.hostname;
      var WSSPort = output.wssport;
      var WSScheme = window.location.protocol=="https:"?"wss://":"ws://";
      $tw.socket = new WebSocket(WSScheme + IPAddress +":" + WSSPort);
      $tw.socket.onopen = openSocket;
      $tw.socket.onmessage = parseMessage;
      $tw.socket.binaryType = "arraybuffer";

      // Get the name for this wiki for websocket messages
      var tiddler = $tw.wiki.getTiddler("$:/WikiName");
      if (tiddler) {
        $tw.wikiName = tiddler.fields.text;
      } else {
        $tw.wikiName = '';
      }

      addHooks();
    }
    /*
      When the socket is opened the heartbeat process starts. This lets us know
      if the connection to the server gets interrupted.
    */
    var openSocket = function() {
      console.log('Opened socket');
      var token = localStorage.getItem('ws-token');
      // Start the heartbeat process
      $tw.socket.send(JSON.stringify({messageType: 'ping', heartbeat: true, token: token}));
    }
    /*
      This is a wrapper function, each message from the websocket server has a
      message type and if that message type matches a handler that is defined
      than the data is passed to the handler function.
    */
    var parseMessage = function(event) {
      var eventData = JSON.parse(event.data);
      if (eventData.type) {
        if (typeof $tw.browserMessageHandlers[eventData.type] === 'function') {
          $tw.browserMessageHandlers[eventData.type](eventData);
        }
      }
    }

    /*
      This adds actions for the different event hooks. Each hook sends a
      message to the node process.

      Some unused hooks have commented out skeletons for adding those hooks in
      the future if they are needed.
    */
    var addHooks = function() {
      if (!$tw.wikiName) {
        $tw.wikiName = '';
      }
      $tw.hooks.addHook("th-editing-tiddler", function(event) {
        var token = localStorage.getItem('ws-token')
        // console.log('Editing tiddler event: ', event);
        var message = JSON.stringify({messageType: 'editingTiddler', tiddler: event.tiddlerTitle, wiki: $tw.wikiName, token: token});
        $tw.socket.send(message);
        // do the normal editing actions for the event
        return true;
      });
      $tw.hooks.addHook("th-cancelling-tiddler", function(event) {
        var token = localStorage.getItem('ws-token')
        // console.log("cancel editing event: ",event);
        var message = JSON.stringify({messageType: 'cancelEditingTiddler', tiddler: event.tiddlerTitle, wiki: $tw.wikiName, token: token});
        $tw.socket.send(message);
        // Do the normal handling
        return event;
      });
      $tw.hooks.addHook("th-renaming-tiddler", function (event) {
        // For some reason this wasn't being handled by the generic 'change'
        // event. So the hook is here.
        console.log('renaming tiddler');
        console.log(event)
      });
      /*
        Listen out for changes to tiddlers
        This handles tiddlers that are edited directly or made using things
        like the setfield widget.
        This ignores tiddlers that are in the exclude filter
      */
    	$tw.wiki.addEventListener("change",function(changes) {
        for (var tiddlerTitle in changes) {
          // If the changed tiddler is the one that holds the exclude filter
          // than update the exclude filter.
          if (tiddlerTitle === '$:/plugins/OokTech/MultiUser/ExcludeSync') {
            $tw.MultiUser.ExcludeFilter = $tw.wiki.getTiddlerText('$:/plugins/OokTech/MultiUser/ExcludeSync');
          }
          var list = $tw.wiki.filterTiddlers($tw.MultiUser.ExcludeFilter);
          if (list.indexOf(tiddlerTitle) === -1) {
            if (changes[tiddlerTitle].modified) {
              var token = localStorage.getItem('ws-token')
              var tiddler = $tw.wiki.getTiddler(tiddlerTitle);
              var message = JSON.stringify({messageType: 'saveTiddler', tiddler: tiddler, wiki: $tw.wikiName, token: token});
              $tw.socket.send(message);
            } else if (changes[tiddlerTitle].deleted) {
              var token = localStorage.getItem('ws-token')
              var message = JSON.stringify({messageType: 'deleteTiddler', tiddler: tiddlerTitle, wiki: $tw.wikiName, token: token});
              $tw.socket.send(message);
            }
          } else {
            // Stop the dirty indicator from turning on.
            $tw.utils.toggleClass(document.body,"tc-dirty",false);
          }
        }
    	});
      /*
        Below here are skeletons for adding new actions to existing hooks.
        None are needed right now but the skeletons may help later.

        Other available hooks are:
        th-importing-tiddler
        th-relinking-tiddler
        th-renaming-tiddler
      */
      /*
        This handles the hook for importing tiddlers.
      */
      /*
      $tw.hooks.addHook("th-importing-tiddler", function (tiddler) {
        return tiddler;
      });
      */
      /*
        For the th-saving-tiddler hook send the saveTiddler message along with
        the tiddler object.
      */
      /*
      $tw.hooks.addHook("th-saving-tiddler",function(tiddler) {
        // do the normal saving actions for the event
        return tiddler;
      });
      */
      /*
        For the th-deleting-tiddler hook send the deleteTiddler message along
        with the tiddler object.
      */
      /*
      $tw.hooks.addHook("th-deleting-tiddler",function(tiddler) {
        // do the normal deleting actions for the event
        return true;
      });
      */
      /*
      $tw.hooks.addHook("th-new-tiddler", function(event) {
        console.log("new tiddler hook: ", event);
        return event;
      })
      $tw.hooks.addHook("th-navigating", function(event) {
        console.log("navigating event: ",event);
        return event;
      })
      */
    }
    // Send the message to node using the websocket
    setup();
  }
})();
