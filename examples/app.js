var clang = require('clang');


clang.init('your_uuid', '1.18', function(err, api) {
	if (err) {
		console.log('err', err.message);	
	}

	//Example calls after initialisation are shown below.
	//Another great example is this implementations: https://github.com/devotis/node-clang-rest

	/*
	api.objects.group.getAll({}, function(err, rows) {

		console.log(err, rows);

	});
	*/
	
	/*
	api.objects.customer.getByObject({
		customer: {
			emailAddress: 'c.westerbeek@gmail.com'
		}
	}, function(err, rows) {

		console.log('errhere', err, rows);

	});
	*/
	
	/*
	api.objects.customer.insert({
		customer: {
			firstname: 'Christiaan',
			emailAddress: 'c.westerbeek@gmail.com'
		}
	}, function(err, rows) {

		console.log(err, rows);

	});
	*/

	/*
	api.objects.customer.update({
		customer: {
			id: 39514,
			firstname: 'Christiaan333',
			emailAddress: 'c.westerbeek@gmail.com'
		}
	}, function(err, rows) {

		console.log(err, rows);

	});
	*/
	/*
	api.objects.customer.delete({
		customer: {
			id: 39514,
			firstname: 'Christiaan333',
			emailAddress: 'c.westerbeek@gmail.com'
		}
	}, function(err, rows) {

		console.log(err, rows);

	});
	*/
});


/*Interesting
turns modules into RESTFul web-services: https://npmjs.org/package/webservice
wrap webservice into functions https://npmjs.org/package/imjs

patterns for modules: http://darrenderidder.github.io/talks/ModulePatterns/#/9
*/
