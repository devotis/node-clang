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

describe('Send signature', function() {
  it('Send requires 3 arguments or else should callback with an error', function(done) {
    clang.send(function(err, result) {
      (!!err).should.be.equal(true);

      done();
    });
  });
  it('Empty customer object should callback with an error', function(done) {
    clang.send({}, {}, function(err, result) {
      (!!err).should.be.equal(true);

      done();
    });
  });
  it('Send with unsupport lookup key should callback with an error', function(done) {
    clang.send({externalId: 1}, {lookup: 'some-unsupported-key'}, function(err, result) {
      (!!err).should.be.equal(true);

      done();
    });
  });
  it('Send with context without contextId should callback with an error', function(done) {
    clang.send({externalId: 1}, {context: 'group'}, function(err, result) {
      (!!err).should.be.equal(true);

      done();
    });
  });
  it('Send with unsupported context should callback with an error', function(done) {
    clang.send({externalId: 1}, {context: 'some-unsupported-context'}, function(err, result) {
      (!!err).should.be.equal(true);

      done();
    });
  });
  it('Send with lookup=externalId without an externalId should callback with an error', function(done) {
    clang.send({x: 1}, {lookup: 'externalId', context: 'group'}, function(err, result) {
      (!!err).should.be.equal(true);

      done();
    });
  });
  it('Send with lookup=customerId without an id/customerId should callback with an error', function(done) {
    clang.send({x: 1}, {lookup: 'customerId', context: 'group'}, function(err, result) {
      (!!err).should.be.equal(true);

      done();
    });
  });
  it('Send with lookup=email without an email/emailAddress should callback with an error', function(done) {
    clang.send({x: 1}, {lookup: 'email', context: 'group'}, function(err, result) {
      (!!err).should.be.equal(true);

      done();
    });
  });
});

describe('Fields', function() {
  it('Transform well', function(done) {
    var data = {
      a: 1,
      email: 'a@b.nl',
      gender: 'M',
      name: 'me'
    }
    var options = {
      fieldMap: {
        name: 'firstname'
      }
    }

    var actual = clang.transformFields(data, options)
    var expected = {
      a: 1,
      emailAddress: 'a@b.nl',
      gender: 'MAN',
      firstname: 'me'
    }

    actual.should.be.deepEqual(expected)
    setImmediate(done)
  });
  it('Transformation creates an new object', function(done) {
    var data = {
      a: 'a@b.nl'
    }

    var actual = clang.transformFields(data)

    actual.should.be.deepEqual(data)
    actual.should.not.be.equal(data)

    setImmediate(done)
  });
});
