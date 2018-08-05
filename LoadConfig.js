/*
 * Copyright (C) OokTech LLC 2017
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Written by Jedediah and Joshua Carty <ook@ooktech.com>
 *
 * Description: Determines which configuration and then exposes it as an object,
 * acting as the initial state through the Status module. Configurations are
 * created by a tool but can be hand edited if need be. Note that the parser is
 * extremely strict as to what is a valid JSON file (beware extra commas!).
 */

var fs = require('fs')
var TOML = require('@iarna/toml')

// Fallback to known default file.
//const defaultConfig = './Config/Config.json'
const defaultConfig = './Config/Config.toml'

var LocalConfig = {}
var config = {}

var loadConfiguration = function () {
  // If path argument exists, use it. Otherwise fall back to defaultConfig.
  var configPath = defaultConfig
  var rawConfig

  // Nested try/catch in case user defined path is invalid.
  try {
    rawConfig = fs.readFileSync(configPath, {encoding: 'utf8'})
  } catch (err) {
    // Try default fallback next.
    console.log('Failed to load configuration, falling back to default.')
    try {
      rawConfig = fs.readFileSync(defaultConfig, {encoding: 'utf8'})
    } catch (err) {
      // Failed to load default as well.
      console.log('Failed to load default config!')
    }
  }

  // Try to parse the JSON after loading the file.
  try {
    //config = JSON.parse(rawConfig)
    config = TOML.parse(rawConfig)
  } catch (err) {
    console.log('Failed to parse configuration file! Continuing with an empty configuration.')
    // Create an empty default configuration.
    config = {}
  }

  // We need to load the local configuration that may be different from the
  // global defaults. The local configuration is preferentially used over the
  // global defaults.
  //var localConfigPath = './Config/Local.json'
  var localConfigPath = './Config/Local.toml'
  var rawLocalConfig

  try {
    rawLocalConfig = fs.readFileSync(localConfigPath, {encoding: 'utf8'})
  } catch (e) {
    // If failure return an empty json object
    //rawLocalConfig = {}
    // We need an empty string for TOML
    rawLocalConfig = ""
    console.log('failed to load local config')
  }

  try {
    // Try parsing the local config json file
    if (typeof rawLocalConfig === 'string') {
      //LocalConfig = JSON.parse(rawLocalConfig)
      LocalConfig = TOML.parse(rawLocalConfig)
    } else {
      LocalConfig = rawLocalConfig
    }
    updateConfig(config, LocalConfig)
  } catch (e) {
    // If we can't parse it what do we do?
    console.log('failed to parse local config')
  }
  // Watch the local config file for changes and reload the configuration when
  // anything changes.
  fs.watch(localConfigPath, function (eventType, fileName) {
    loadConfiguration()
  })
}

/*
  given a local and a global config, this returns the global config but with
  any properties that are also in the local config changed to the values given
  in the local config.
  Changes to the configuration are later saved to the local config.
*/
var updateConfig = function (globalConfig, localConfig) {
  // Walk though the properties in the localConfig, for each property set the
  // global config equal to it, but only for singleton properties. Don't set
  // something like GlobalConfig.Accelerometer = localConfig.Accelerometer, set
  // globalConfig.Accelerometer.Controller =
  // localConfig.Accelerometer.Contorller
  Object.keys(localConfig).forEach(function (key, index) {
    if (typeof localConfig[key] === 'object' && !(localConfig[key] instanceof Array)) {
      if (!globalConfig[key]) {
        globalConfig[key] = {}
      }
      // do this again!
      updateConfig(globalConfig[key], localConfig[key])
    } else {
      globalConfig[key] = localConfig[key]
    }
  })
}

/*
  This saves a setting to the local config file.
  the input setting
*/
var saveConfigSetting = function (setting) {
  // We need to load the local configuration that may be different from the
  // global defaults. The local configuration is preferentially used over the
  // global defaults.
  //var localConfigPath = './Config/Local.json'
  var localConfigPath = './Config/Local.toml'
  var rawLocalConfig

  try {
    rawLocalConfig = fs.readFileSync(localConfigPath, {encoding: 'utf8'})
  } catch (e) {
    // If failure return an empty json object
    //rawLocalConfig = {}
    console.log('failed to load local config')
  }

  if (rawLocalConfig) {
    try {
      // Try parsing the local config json file
      if (typeof rawLocalConfig === 'string') {
        //LocalConfig = JSON.parse(rawLocalConfig)
        LocalConfig = TOML.parse(rawLocalConfig)
      } else {
        LocalConfig = rawLocalConfig
      }
      updateConfig(LocalConfig, setting)
      // Save the updated Local.toml file.
      fs.writeFileSync(localConfigPath, TOML.stringify(LocalConfig))
      updateConfig(config, LocalConfig)
    } catch (e) {
      // If we can't parse it what do we do?
      console.log('failed to parse local config')
    }
  }
}

// Returns the parsed configuration.
loadConfiguration()

module.exports = config
module.exports.Local = LocalConfig
module.exports.saveSetting = saveConfigSetting
