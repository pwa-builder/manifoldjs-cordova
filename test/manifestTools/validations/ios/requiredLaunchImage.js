'use strict';

var should = require('should');

var lib = require('manifoldjs-lib');
var validationConstants = lib.constants.validation;

var constants = require('../../../../lib/constants'),  
    validation = require('../../../../lib/validationRules/ios/requiredLaunchImage');

var requiredIconSizes = ['750x1334', '1334x750', '1242x2208', '2208x1242', '640x1136', '640x960', '1536x2048', '2048x1536', '768x1024', '1024x768'];
var manifestWithRequiredIconSizes = [{sizes : '750x1334'}, {sizes : '1334x750'}, {sizes : '1242x2208'}, {sizes : '2208x1242'},
                {sizes : '640x1136'}, {sizes : '640x960'}, {sizes : '1536x2048'}, {sizes : '2048x1536'}, {sizes : '768x1024'}, {sizes : '1024x768'}];

describe('Validation - iOS', function () {
  describe('requiredLaunchImage', function () {
    it('Should return a suggestion if manifest does not contains icons', function(done) {
      validation({}, function(err, suggestion) {
        should.not.exist(err);
        should.exist(suggestion);
        suggestion.should.have.property('platform', constants.platform.subPlatforms.ios.id);
        suggestion.should.have.property('level', validationConstants.levels.suggestion);
        suggestion.should.have.property('member', validationConstants.manifestMembers.icons);
        suggestion.should.have.property('code', validationConstants.codes.missingImage);
        suggestion.should.have.property('data', requiredIconSizes);
        done();
      });
    });

    it('Should return a suggestion if manifest icons is empty', function(done) {
      validation({ icons: [] }, function(err, suggestion) {
        should.not.exist(err);
        should.exist(suggestion);
        suggestion.should.have.property('platform', constants.platform.subPlatforms.ios.id);
        suggestion.should.have.property('level', validationConstants.levels.suggestion);
        suggestion.should.have.property('member', validationConstants.manifestMembers.icons);
        suggestion.should.have.property('code', validationConstants.codes.missingImage);
        suggestion.should.have.property('data', requiredIconSizes);
        done();
      });
    });

    it('Should return a suggestion if manifest icons does not contains the required sizes', function(done) {
      validation({ icons: [{sizes : '1x1'}] }, function(err, suggestion) {
        should.not.exist(err);
        should.exist(suggestion);
        suggestion.should.have.property('platform', constants.platform.subPlatforms.ios.id);
        suggestion.should.have.property('level', validationConstants.levels.suggestion);
        suggestion.should.have.property('member', validationConstants.manifestMembers.icons);
        suggestion.should.have.property('code', validationConstants.codes.missingImage);
        suggestion.should.have.property('data', requiredIconSizes);
        done();
      });
    });

    it('Should return a suggestion if manifest icons contains only one of the required sizes', function(done) {
      validation({ icons: manifestWithRequiredIconSizes.slice(0,1) }, function(err, suggestion) {
        should.not.exist(err);
        should.exist(suggestion);
        suggestion.should.have.property('platform', constants.platform.subPlatforms.ios.id);
        suggestion.should.have.property('level', validationConstants.levels.suggestion);
        suggestion.should.have.property('member', validationConstants.manifestMembers.icons);
        suggestion.should.have.property('code', validationConstants.codes.missingImage);
        suggestion.should.have.property('data', requiredIconSizes.slice(1));
        done();
      });
    });

    it('Should not return a suggestion if manifest icons contains all of the required sizes', function(done) {
      validation({ icons: manifestWithRequiredIconSizes }, function(err, suggestion) {
        should.not.exist(err);
        should.not.exist(suggestion);
        done();
      });
    });

    it('Should not return a suggestion if manifest icons contains all the required sizes and others at the end', function(done) {
      var icons = manifestWithRequiredIconSizes.slice();
      icons.push({sizes : '1x1'});
      validation({ icons: icons }, function(err, suggestion) {
        should.not.exist(err);
        should.not.exist(suggestion);
        done();
      });
    });

    it('Should not return a suggestion if manifest icons contains all the required sizes and others at the begining', function(done) {
      var icons = [{sizes : '1x1'}];

      for (var i = 0; i < manifestWithRequiredIconSizes.length; i++) {
        icons.push(manifestWithRequiredIconSizes[i]);
      }

      validation({ icons: icons }, function(err, suggestion) {
        should.not.exist(err);
        should.not.exist(suggestion);
        done();
      });
    });
  });
});
