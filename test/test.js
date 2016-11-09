var should = require('should');

var Clang = require('../index');
var clang = new Clang();

describe('Class instantiation', function() {
  it('Clang instantiation should work', function() {

    (clang instanceof Clang).should.be.equal(true);
  });
  it('Clang instantiation without new keyword should work', function() {
    var x = Clang();

    (x instanceof Clang).should.be.equal(true);
  });
});

describe('Request signature', function() {
  it('Request without methodName and arguments should callback with an error', function(done) {
    clang.request(function(err, result) {
      (!!err).should.be.equal(true);

      done();
    });
  });
  it('Request without uuid in arguments should callback with an error', function(done) {
    clang.request('someMethod', function(err, result) {
      (!!err).should.be.equal(true);

      done();
    });
  });
});
