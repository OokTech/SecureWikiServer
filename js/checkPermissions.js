const path = require('path')
const fs = require('fs')

var settings = require('../LoadConfig.js')

var baseDir = settings.filePathBase === 'homedir'?require('os').homedir():settings.filePathBase
var defaultPath = path.resolve(baseDir,settings.wikiPermissionsPath)
var localPath = path.resolve(baseDir,settings.localWikiPermissionsPath)
var wikiPermissions = settings.loadConfig(defaultPath, localPath).config

/*
  This updates the permissions whenever the local permissions file changes.
  The default file should never change so we don't need to watch that
*/
fs.watch(localPath, function(eventType, filename) {
  wikiPermissions = settings.loadConfig(defaultPath, localPath).config
})

/*
  This is a generic function to check if a person has a permission on a wiki
  based on the token they sent.
*/
function checkPermission (fullName, response, permission, action) {
  var nameParts = fullName.split('/')
  var permissionsObject = wikiPermissions.wikis || {}
  nameParts.forEach(function(part) {
    permissionsObject = permissionsObject[part] || {};
  })
  permissionsObject.access = permissionsObject.access || {};
  if (response.decoded && (action === 'announce' || action === 'credentialCheck' || (action === 'ping' && response.decoded.level !== 'Guest'))) {
    return true
  } else if (permissionsObject.public && permission === 'view') {
    // If the wiki is set as public than anyone can view it
    return true
  } else if (response.decoded.level) {
    if (permissionsObject.access[response.decoded.level] || (typeof response.decoded.name === 'string' && response.decoded.name !== '' && response.decoded.name === permissionsObject.owner)) {
      var levels = permissionsObject.access[response.decoded.level] || []
      // If the logged in person is the wiki owner than add the 'owner'
      // level to the list of permissions
      if (typeof response.decoded.name === 'string' && response.decoded.name !== '' && response.decoded.name === permissionsObject.owner) {
        levels.push('owner')
        levels.push('view')
        levels.push('edit')
      }
      var allowed = false
      if (permission) {
        // If the permission level requested is listed than it is allowed
        allowed = (levels.indexOf(permission) !== -1)
      } else if (action) {
        // If the action listed is part of one of the allowed permission levels
        // it is allowed.
        levels.forEach(function(level, index) {
          if (settings.actions[level].indexOf(action) !== -1) {
            allowed = true
          }
        })
      }
      return allowed
    } else {
      // The attempted operation isn't allowed by the persons
      // authorisation level.
      return false
    }
  } else {
    // No valid token was supplied
    return false
  }
}

module.exports = checkPermission
module.exports.wikiPermissions = wikiPermissions
