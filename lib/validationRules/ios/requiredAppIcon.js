'use strict';

var pwabuilderLib = require('pwabuilder-lib');

var validationConstants = pwabuilderLib.constants.validation,
    imageValidation =  pwabuilderLib.manifestTools.imageValidation;

var constants = require('../../constants');

module.exports = function (manifestContent, callback) {
  var description = 'An app icon of the following sizes is required: 76x76, 120x120, 152x152 and 180x180',
  platform = constants.platform.subPlatforms.ios.id,
  level = validationConstants.levels.suggestion,
  requiredIconSizes = ['76x76', '120x120', '152x152', '180x180'];

  imageValidation(manifestContent, description, platform, level, requiredIconSizes, callback);
};
