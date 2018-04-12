/*
  This is what you use to add a new person to the server. It adds them with a
  name and password.

  So we should make a way for people to change their passwords after they
  authenticate.

  Usage:

  node addperson.js name password level

  name and password are required, level is optional and defaults to guest

  Stuff this shows:
  - Getting and using commandline arguments
  - Hash passwords using bcrypt
  - Create folders if they don't already exist
  - Save information to a file and set appropriate file permissions
*/

var fs = require('fs')
var path = require('path')
var os = require('os')
var bcrypt = require('bcrypt')

var settings = require('./LoadConfig.js')

// Make sure that the people dir exists
var peopleDir = path.join(path.dirname(require.main.filename), 'people')
if (!fs.existsSync(peopleDir)){
  fs.mkdirSync(peopleDir, {mode: 0o700})
}

if (process.argv.length < 3) {
  console.log('Usage: node ./addperson.js name password level')
} else {
  var name = process.argv[2]
  var password = process.argv[3]
  var level = 'guest'
  if (process.argv.length >= 4) {
    level = process.argv[4]
  }
  var update = false
  if (process.argv.length >= 5) {
    if (process.argv[5]) {
      update = true
    }
  }

  // Check to make sure that the persons info doesn't already exist on the
  // server
  // Get the folder name for the current person
  var dir = path.join(path.dirname(require.main.filename), 'people', name)
  // If the folder exists and you are not updating
  if (!update && fs.existsSync(dir)) {
    console.log('Person already exists!')
  } else {
    // Make the folder if it doesn't exist
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, {mode: 0o700})
    }
    // Make the file info
    var info = {level: level}
    // Create the password hash
    // Use 10 salt rounds for now (make it configurable later)
    info.hash = bcrypt.hashSync(password, settings.saltRounds)
    // Write the info file, only the current user can read or write the file.
    fs.writeFileSync(path.join(dir, 'info.hash'), JSON.stringify(info, '', 2), {mode: 0o600})
  }
}
