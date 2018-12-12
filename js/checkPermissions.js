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
function checkPermission (fullName, response, permission) {
  var nameParts = fullName.split('/')
  var permissionsObject = wikiPermissions.wikis || {}
  nameParts.forEach(function(part) {
    permissionsObject = permissionsObject[part] || {};
  })
  permissionsObject.access = permissionsObject.access || {};
  // If the wiki is set as public than anyone can view it
  if (permissionsObject.public && permission === 'view') {
    return true
  } else if (response.decoded) {
    // If the logged in person is the owner than they can view and edit it
    if (typeof response.decoded.name === 'string' && response.decoded.name === permissionsObject.owner && ['view', 'edit'].indexOf(permission) !== -1) {
      return true
    } else if (permissionsObject.access[response.decoded.level]) {
      // If the logged in level of the person includes the permission return
      // true
      if (permissionsObject.access[response.decoded.level].indexOf(permission) !== -1) {
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

module.exports = checkPermission
module.exports.wikiPermissions = wikiPermissions
