var clang = require('clang');

clang.uuid('your_clang_api_key_aka_uuid');
clang.init(function(err, api) {
	if (err) {
		console.log('err', err.message);	
	}

	//Example calls after initialization are shown below.
	//Another great example is this implementation: https://github.com/devotis/node-clang-rest
	
	api.objects.group.getByObject({
		name: 'mailing18092012'
	}, function(err, rows) {

		console.log(err, rows);

	});
	
	api.objects.customer.getByObject({
		emailAddress: 'a@b.nl',
		vraag32d: 'qwerty1'
	}, function(err, rows) {

		console.log('errhere', err, rows);

	});
	
	api.objects.customer.insert({
		firstname: 'Christiaan',
		emailAddress: 'a@b.nl',
		vraag32d: 'qwerty1',
		vraag32g: 'qwerty2',
		vraag37d: 'qwerty3',
		vraag32h: 'qwerty4'
	}, function(err, rows) {

		console.log(err, rows);

	});
	
	
	api.objects.customer.update({
		id: 39532,
		firstname: 'Christiaan333',
		emailAddress: 'a@b.nl',
		vraag32d: 'xqwerty1',
		vraag32g: 'xqwerty2',
		vraag32h: 'xqwerty4'
	}, function(err, rows) {

		console.log(err, rows);

	});
	
	
	api.objects.customer.delete({
		id: 39532,
		firstname: 'Christiaan333',
		emailAddress: 'a@b.nl'
	}, function(err, rows) {

		console.log(err, rows);

	});
	
});


/*Interesting
turns modules into RESTFul web-services: https://npmjs.org/package/webservice
wrap webservice into functions https://npmjs.org/package/imjs

patterns for modules: http://darrenderidder.github.io/talks/ModulePatterns/#/9
*/
