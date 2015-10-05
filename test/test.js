var should = require('should');

var Clang = require('../index');

describe('Class instantiation', function() {
  it('Clang instantiation should work', function() {
    var x = new Clang();

    (x instanceof Clang).should.be.equal(true);
  });
  it('Clang instantiation without new keyword should work', function() {
    var x = Clang();

    (x instanceof Clang).should.be.equal(true);
  });
});

