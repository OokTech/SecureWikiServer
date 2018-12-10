const settings = require('../LoadConfig.js')
const fs = require('fs')
const path = require('path')

var key = fs.readFileSync(path.join(require('os').homedir(), settings.tokenPrivateKeyPath))

module.exports = key
