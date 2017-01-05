'use strict';

var should = require('should');

var lib = require('xanifoldjs-lib');
var validationConstants = lib.constants.validation;

var constants = require('../../../../lib/constants'),  
    validation = require('../../../../lib/validationRules/windows/requiredSmallSquareLogo');

var validIconSizes = ['24x24', '30x30', '42x42', '54x54'];
var manifestWithValidIconSizes = [{sizes : '24x24'}, {sizes : '30x30'}, {sizes : '42x42'}, {sizes : '54x54'}];

describe('Validation - Windows', function () {
  describe('requiredSmallSquareLogo', function () {
    it('Should return a suggestion if manifest does not contains icons', function(done) {
      validation({}, function(err, suggestion) {
        should.not.exist(err);
        should.exist(suggestion);
        suggestion.should.have.property('platform', constants.platform.subPlatforms.windows.id);
        suggestion.should.have.property('level', validationConstants.levels.suggestion);
        suggestion.should.have.property('member', validationConstants.manifestMembers.icons);
        suggestion.should.have.property('code', validationConstants.codes.missingImageGroup);
        suggestion.should.have.property('data', validIconSizes);
        done();
      });
    });

    it('Should return a suggestion if manifest icons is empty', function(done) {
      validation({ icons: [] }, function(err, suggestion) {
        should.not.exist(err);
        should.exist(suggestion);
        suggestion.should.have.property('platform', constants.platform.subPlatforms.windows.id);
        suggestion.should.have.property('level', validationConstants.levels.suggestion);
        suggestion.should.have.property('member', validationConstants.manifestMembers.icons);
        suggestion.should.have.property('code', validationConstants.codes.missingImageGroup);
        suggestion.should.have.property('data', validIconSizes);
        done();
      });
    });

    it('Should return a suggestion if manifest icons does not contains the required sizes', function(done) {
      validation({ icons: [{sizes : '1x1'}] }, function(err, suggestion) {
        should.not.exist(err);
        should.exist(suggestion);
        suggestion.should.have.property('platform', constants.platform.subPlatforms.windows.id);
        suggestion.should.have.property('level', validationConstants.levels.suggestion);
        suggestion.should.have.property('member', validationConstants.manifestMembers.icons);
        suggestion.should.have.property('code', validationConstants.codes.missingImageGroup);
        suggestion.should.have.property('data', validIconSizes);
        done();
      });
    });

    it('Should not return a suggestion if manifest icons contains one of the required sizes', function(done) {
      validation({ icons: manifestWithValidIconSizes.slice(1,2) }, function(err, suggestion) {
        should.not.exist(err);
        should.not.exist(suggestion);
        done();
      });
    });

    it('Should not return a suggestion if manifest icons contains all of the required sizes', function(done) {
      validation({ icons: manifestWithValidIconSizes }, function(err, suggestion) {
        should.not.exist(err);
        should.not.exist(suggestion);
        done();
      });
    });

    it('Should not return a suggestion if manifest icons contains one of the required sizes and others at the end', function(done) {
      var icons = manifestWithValidIconSizes.slice(1,3);
      icons.push({sizes : '1x1'});
      validation({ icons: icons }, function(err, suggestion) {
        should.not.exist(err);
        should.not.exist(suggestion);
        done();
      });
    });

    it('Should not return a suggestion if manifest icons contains one of the required sizes and others at the begining', function(done) {
      var icons = [{sizes : '1x1'}];
      icons.push(manifestWithValidIconSizes[1]);

      validation({ icons: icons }, function(err, suggestion) {
        should.not.exist(err);
        should.not.exist(suggestion);
        done();
      });
    });
  });
});
