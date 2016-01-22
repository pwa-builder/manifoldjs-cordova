'use strict';

var path = require('path'),
    url = require('url'),
    util = require('util');

var Q = require('q');

var lib = require('manifoldjs-lib');

var CustomError = lib.CustomError,
    fileTools = lib.fileTools,
    manifestTools = lib.manifestTools,
    PlatformBase = lib.PlatformBase,
    processTools = lib.processTools,
    projectTools = lib.projectTools,
    exec = lib.processTools.exec,
    utils = lib.utils;

var constants = require('./constants');
  
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
          return Q.reject('Failed to locate the Cordova shell command: \'' + cordova + '\'.');
        }
        
        return cachedCordovaPath = commandPath;
      });
    }
    
    return Q.resolve(cachedCordovaPath);
  }

  // ID or URL of the Hosted Web App plugin - THIS SETTING WILL NEED TO BE UPDATED IF THE PLUGIN IS RELOCATED
  // TODO: make this overridable via environment variable
  var pluginIdOrUrl = 'cordova-plugin-hostedwebapp@>=0.2.0 <0.3.0';
  
  function createApp (rootDir, appName, packageName, cordovaAppName, callback) {
    self.info('Creating the ' + constants.platform.name + ' project...');    
    return getCordovaPath().then(function (cordovaPath) {
      return exec(cordovaPath, ['create', appName, packageName, cordovaAppName], { cwd: rootDir });
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
      return exec(cordovaPath, ['platform', 'add'].concat(platforms), { cwd: rootDir });
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
  
    // Fixes an issue in Cordova that requires a version of cordova-ios that is not released yet
    // and stops automated plugin installations - see https://issues.apache.org/jira/browse/CB-9232
    // and https://issues.apache.org/jira/browse/CB-916) - Needs to be removed once a fix is released!!!!
    pluginList.push('cordova-plugin-whitelist@1.0.0');
  
    var allPlugins = pluginList.join(' ');
    self.info('Adding the following plugins to the Cordova project: ' + allPlugins + '...');
    
    return getCordovaPath().then(function (cordovaPath) {
      return exec(cordovaPath, ['plugin', 'add'].concat(pluginList), { cwd: rootDir });
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
          return self.writeGenerationInfo(w3cManifestInfo, platformDir);
        });
    }));
  }

  // override create function
  self.create = function (w3cManifestInfo, rootDir, options, callback) {

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
  
    // create the base Cordova app
    return createApp(rootDir, constants.platform.id, packageName, cordovaAppName)
      // persist the manifest
      .then(function () {
        self.info('Copying the ' + constants.platform.name + ' manifest to the app folder...');        
        var manifestFilePath = path.join(platformDir, 'manifest.json');
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
      // write generation info (telemetry)
      .then(function () {
        return self.writeGenerationInfo(w3cManifestInfo, platformDir);
      })
      .then(function () {
        self.info('The ' + constants.platform.name + ' apps were created successfully!');
      })
      .catch(function (err) {
        self.error(err.getMessage());
        return Q.reject(new CustomError('There was an error creating one or more ' + constants.platform.name + ' apps.'));
      })
      .nodeify(callback);            
  };
  
  // override package function
  self.package = function (rootDir, options, callback) {

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
    
    var platformDir = path.join(rootDir, constants.platform.id);
    return getCordovaPath().then(function (cordovaPath) {
      return exec(cordovaPath, ['build'].concat(validPlatforms), { cwd: platformDir });
    })
    .then(function () {
      self.info('The ' + constants.platform.name + ' app was packaged successfully!');
    })    
    .catch (function (err) {
      self.error(err.getMessage());
      return Q.reject(new CustomError('There was an error packaging one or more ' + constants.platform.name + ' platform apps.'));
    })
    .nodeify(callback);
  };
  
  self.run = function (options, callback) {
    var platform = self.platforms[0];

    if (platform === constants.platform.subPlatforms.windows && !utils.isWindows) {
      return Q.reject(new Error('Windows projects can only be executed in Windows environments.')).nodeify(callback);
    }
    
    self.info('Running app for the ' + platform + ' platform...');

    var platformDir = path.join(process.cwd(), 'cordova');
    
    return getCordovaPath().then(function (cordovaPath) {
      return exec(cordovaPath, ['run', platform], { cwd: platformDir });
    })
    .catch(function (err) {
      return Q.reject(new CustomError('Failed to run the Cordova platform: ' + platform + '.', err));
    })
    .nodeify(callback);    
  };
  
  self.open = function (options, callback) {
    var platform = self.platforms[0];
    if (platform !== constants.platform.subPlatforms.windows.id) {
      return Q.reject(new Error('The \'open\' command is not implemented for the \'' + platform + '\' platform.')).nodeify(callback);
    }
    
    if (platform === constants.platform.subPlatforms.windows.id && process.platform !== 'win32') {
      return Q.reject(new Error('Visual Studio projects can only be opened in Windows environments.')).nodeify(callback);
    }

    var platformDir = path.join(process.cwd(), constants.platform.id);
    var projectFilename = path.join(platformDir, 'platforms', platform, 'CordovaApp.sln');
    return projectTools.openVisualStudioProject(projectFilename).nodeify(callback);
  };  
}

util.inherits(Platform, PlatformBase);

module.exports = Platform;
