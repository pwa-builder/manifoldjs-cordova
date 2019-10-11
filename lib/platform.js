'use strict';

var path = require('path'),
    url = require('url'),
    util = require('util');

var Q = require('q');

var lib = require('pwabuilder-lib');

var CustomError = lib.CustomError,
    fileTools = lib.fileTools,
    manifestTools = lib.manifestTools,
    PlatformBase = lib.PlatformBase,
    processTools = lib.processTools,
    projectTools = lib.projectTools,
    exec = lib.processTools.exec,
    utils = lib.utils;

var constants = require('./constants');

// ID or URL of the Hosted Web App plugin
// Specifies the location and version constraints (if applicable) of the plugin.
// Can be overriden by defining a CORDOVA_PLUGIN_HOSTEDWEBAPP environment variable. For example:
//   SET "CORDOVA_PLUGIN_HOSTEDWEBAPP=cordova-plugin-hostedwebapp@0.4.5"
var pluginIdOrUrl = process.env.CORDOVA_PLUGIN_HOSTEDWEBAPP || 'cordova-plugin-hostedwebapp@0.3.x';

function Platform (packageName, platforms) {

  var self = this;

  PlatformBase.call(this, constants.platform.id, constants.platform.name, packageName, __dirname);

  // save platform list
  self.platforms = platforms;

  // returns the path to the cordova shell command
  var cachedCordovaPath;
  function getCordovaPath () {

    if (!cachedCordovaPath) {
      // npm command in Windows is a batch file and needs to include extension to be resolved by spawn call
      var cordova = (process.platform === 'win32' ? 'cordova.cmd' : 'cordova');
      return processTools.getCommandPath(__dirname, cordova)
      .then(function (commandPath) {
        cachedCordovaPath = commandPath;
        if (!commandPath) {
          return Q.reject(new Error('Failed to locate the Cordova shell command: \'' + cordova + '\'.'));
        }

        return cachedCordovaPath = commandPath;
      });
    }

    return Q.resolve(cachedCordovaPath);
  }

  function createApp (rootDir, appName, packageName, cordovaAppName, href, callback) {
    self.info('Creating the ' + constants.platform.name + ' project...');
    return getCordovaPath().then(function (cordovaPath) {
      return exec(cordovaPath, ['create', appName, packageName, cordovaAppName], { cwd: rootDir, statusMessage: 'Creating app ' });
    })
    .catch(function (err) {
      return Q.reject(new CustomError('Failed to create the base Cordova application.', err));
    })
    .nodeify(callback);
  }

  function addPlatforms (rootDir, platforms, callback) {
    var allPlatforms = platforms.join(' ');
    self.info('Adding the following Cordova platforms: ' + allPlatforms + '...');
    return getCordovaPath().then(function (cordovaPath) {
      return exec(cordovaPath, ['platform', 'add'].concat(platforms), { cwd: rootDir, statusMessage: 'Adding platforms ' });
    })
    .catch(function (err) {
      return Q.reject(new CustomError('Failed to add the Cordova platforms: ' + allPlatforms + '.', err));
    })
    .nodeify(callback);
  }

  function addPlugins (rootDir, options, callback) {
    var pluginList = [pluginIdOrUrl];
    if (options.crosswalk) {
      pluginList.push('cordova-plugin-crosswalk-webview');
    }

    if (options.webAppToolkit) {
      pluginList.push('cordova-plugin-webapptoolkit');
      self.warn('\n*******************************************************************************');
      self.warn('The WAT plugin requires you to perform manual steps before running the app');
      self.warn('Follow the steps described here: https://github.com/manifoldjs/Web-App-ToolKit');
      self.warn('*******************************************************************************\n');
    }

    pluginList.push('cordova-plugin-whitelist');

    var allPlugins = pluginList.join(' ');
    self.info('Adding the following plugins to the Cordova project: ' + allPlugins + '...');

    return getCordovaPath().then(function (cordovaPath) {
      return exec(cordovaPath, ['plugin', 'add'].concat(pluginList), { cwd: rootDir, statusMessage: 'Adding plugins ' });
    })
    .catch(function (err) {
      return Q.reject(new CustomError('Failed to add one or more plugins.', err));
    })
    .nodeify(callback);
  }

  function processPlatforms (w3cManifestInfo, rootDir, platformDir, platforms) {

    return Q.allSettled(platforms.map(function (platform) {
      self.info('Processing the \'' + platform + '\' Cordova platform...');

      var cordovaPlatformPath = path.join(platformDir, 'platforms', platform);

      // copy the documentation file
      return self.copyDocumentation(cordovaPlatformPath, platform)
        // create top-level platform shortcut
        .then(function () {
          // don't create a shortcut for the Windows platform
          if (platform.toUpperCase() !== 'WINDOWS') {
            self.info('Creating a shortcut for the \'' + platform + '\' Cordova platform...');
            var srcpath = path.resolve(platformDir, 'platforms', platform);
            var dstpath = path.resolve(rootDir, platform);
            return fileTools.createShortcut(srcpath, dstpath);
          }
        })
        // write generation info (telemetry)
        .then(function () {
          return self.writeGenerationInfo(w3cManifestInfo, cordovaPlatformPath);
        });
    }));
  }

  // override create function
  self.create = function (w3cManifestInfo, rootDir, options, href, callback) {
    if (w3cManifestInfo.format !== lib.constants.BASE_MANIFEST_FORMAT) {
      return Q.reject(new CustomError('The \'' + w3cManifestInfo.format + '\' manifest format is not valid for this platform.'));
    }

    var allPlatforms = self.platforms.map(function (platformId) {
      return constants.platform.subPlatforms[platformId].name;
    }).join(', ');

    self.info('Generating the ' + allPlatforms + ' app(s)...');

    var platformDir = path.join(rootDir, constants.platform.id);

    // generate a reverse-domain-style package name from the manifest's start_url
    var packageName = '';
    url.parse(w3cManifestInfo.content.start_url)
              .hostname
              .replace(/-/g, '')
              .split('.')
              .map(function (segment) {
                // BUG:  Issue 149 aparently "in" is a reserved word for android package names
                if(segment === 'in') {
                  segment = segment.replace('in', 'ind');
                }

                packageName = segment + (packageName ? '.' : '') + packageName;
              });

    var cordovaAppName = utils.sanitizeName(w3cManifestInfo.content.short_name);
    packageName = utils.sanitizeName(packageName);

    // package name must look like: com.company.name - required when start_url is http://localhost, for example
    if (packageName.indexOf('.') < 0) {
      packageName += '.pwabuilder';
    }

    // create the base Cordova app
    var manifestFilePath = path.join(platformDir, 'manifest.json');
    return createApp(rootDir, constants.platform.id, packageName, cordovaAppName)
      // persist the manifest
      .then(function () {
        self.info('Copying the ' + constants.platform.name + ' manifest to the app folder...');
        return manifestTools.writeToFile(w3cManifestInfo, manifestFilePath);
      })
      // add the plugins
      .then (function () {
        return addPlugins(platformDir, options);
      })
      // add the platforms
      .then (function () {
        return addPlatforms(platformDir, self.platforms);
      })
      // process individual platforms
      .then (function () {
        return processPlatforms(w3cManifestInfo, rootDir, platformDir, self.platforms);
      })
      // copy the updated manifest after plugins processed it
      .then (function() {
        var appManifestFilePath = path.join(platformDir, 'www', 'manifest.json');

        var manifestFiles = [ manifestFilePath, appManifestFilePath ];

        return Q.allSettled(manifestFiles.map(function(manifestFile) {
          var sourceFilename = manifestFile + '.updated';
          return fileTools.existsFile(sourceFilename).then(function(exists) {
            if (!exists) { return Q.resolve(); }

            self.debug('Overwriting manifest file: ' + manifestFile);

            return fileTools.copyFile(sourceFilename, manifestFile).then(function() {
              return fileTools.deleteFile(sourceFilename);
            });
          });
        }));
      })
      // write generation info (telemetry)
      .then(function () {
        return self.writeGenerationInfo(w3cManifestInfo, platformDir);
      })
      .nodeify(callback);
  };

  // override package function
  self.package = function (projectDir, options, callback) {

    var allPlatforms = self.platforms.map(function (platformId) {
      return constants.platform.subPlatforms[platformId].name;
    }).join(', ');

    self.info('Creating app packages for the following Cordova platforms: ' + allPlatforms + '...');

    var validPlatforms = self.platforms.filter(function (platform) {
      if (platform === constants.platform.subPlatforms.ios.id && process.platform !== 'darwin') {
        self.warn('Packaging apps for the \'' + constants.platform.subPlatforms.ios.name + '\' is not supported in this environment.');
        return false;
      }

      return true;
    });

    var platformDir = path.join(projectDir || process.cwd(), constants.platform.id);
    return getCordovaPath().then(function (cordovaPath) {
      return exec(cordovaPath, ['build'].concat(validPlatforms), { cwd: platformDir });
    })
    .nodeify(callback);
  };

  self.run = function (projectDir, options, callback) {
    var platform = self.platforms[0];

    if (platform === constants.platform.subPlatforms.windows && !utils.isWindows) {
      return Q.reject(new Error('Windows projects can only be executed in Windows environments.')).nodeify(callback);
    }

    self.info('Running app for the ' + platform + ' platform...');

    var platformDir = path.join(projectDir || process.cwd(), 'cordova');

    return getCordovaPath().then(function (cordovaPath) {
      return exec(cordovaPath, ['run', platform], { cwd: platformDir, statusMessage: 'Launching app ' });
    })
    .nodeify(callback);
  };

  self.open = function (projectDir, options, callback) {
    var platform = self.platforms[0];
    if (platform !== constants.platform.subPlatforms.windows.id) {
      return Q.reject(new Error('The \'open\' command is not implemented for the \'' + platform + '\' platform.')).nodeify(callback);
    }

    if (platform === constants.platform.subPlatforms.windows.id && process.platform !== 'win32') {
      return Q.reject(new Error('Visual Studio projects can only be opened in Windows environments.')).nodeify(callback);
    }

    var platformDir = path.join(projectDir || process.cwd(), constants.platform.id);
    var projectFilename = path.join(platformDir, 'platforms', platform, 'CordovaApp.sln');
    return projectTools.openVisualStudioProject(projectFilename).nodeify(callback);
  };
}

util.inherits(Platform, PlatformBase);

module.exports = Platform;
