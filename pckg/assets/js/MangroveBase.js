var mangroveBase = angular.module("mangroveBase", ['restangular', 'OmniBinder']);

mangroveBase
	.config(
		[
		'RestangularProvider',
		function (RestangularProvider)
		{
			RestangularProvider.setResponseExtractor(function(response) {
				var newResponse = response;
				if ( angular.isArray(response) ) {
					angular.forEach(newResponse, function(value, key) {
						newResponse[key].originalElement = angular.copy(value);
					});
				} else {
					newResponse.originalElement = angular.copy(response);
				}

				return newResponse;
			});
		}
		]
	);

mangroveBase
	.service('dataPersist',
		[
		'obBinder', 'obBinderTypes', 'restangularBinder', 'Restangular', 'appStatus',
		function(obBinder, obBinderTypes, restangularBinder, Restangular, appStatus)
		{
			var IsNumeric = function (input) {
				return (input - 0) == input && (input+'').replace(/^\s+|\s+$/g, "").length > 0;
			};

			this.getList = function (scope, model, resource, callback) {
				if ( typeof callback == 'undefined' ) {
					callback = {};
				}

				appStatus.loading();

				scope[model] = [];

				scope.add = function(item) {
					scope[model].push(item);

					Platform.performMicrotaskCheckpoint();

					if ( typeof callback.add !== 'undefined' ) {
						callback.add();
					}
				};

				scope.remove = function(id) {
					var item;
					for ( var i = 0; i < scope[model].length; i++ ) {
						item = scope[model][i];
						if (item.id == id) {
							scope[model].splice(i, 1);

							Platform.performMicrotaskCheckpoint();

							if ( typeof callback.remove !== 'undefined' ) {
								callback.remove();
							}
						}
					}
				};

				scope.load = function() {
					var res = resource.split('/');
					var request = Restangular;

					if ( res.length == 1 ) {
						request = request.all(res[0]).getList();
					} else if ( res.length == 2 && !IsNumeric(res[1]) ) {
						request = request.one(res[0]+'/'+res[1]).get();
					}  else if ( res.length == 2 ) {
						request = request.one(res[0], res[1]).get();
					} else if ( res.length == 3 ) {
						request = request.one(res[0], res[1]).all(res[2]).getList();
					} else if ( res.length == 4 ) {
						request = request.one(res[0]+'/'+res[1], res[2]).all(res[3]).getList();
					}

					request
						.then(function(items) {
							angular.forEach(items, function(item) {
								scope[model].push(item.originalElement);
							});

							appStatus.ready(500);
						})
						.then(function(){
							scope.binder = obBinder(
								scope,
								model,
								restangularBinder,
								{
									key: 'id',
									query: resource,
									type: obBinderTypes.COLLECTION
								}
							);
						})
						.then(function(){
							if ( typeof callback.load !== 'undefined' ) {
								callback.load();
							}
						});
				};

				scope.load();
			}
		}
		]
	);

mangroveBase
	.service('restangularBinder',
		[
		'DirtyPersist', 'obBinderTypes', '$parse', 'Restangular',
		function (DirtyPersist, obBinderTypes, $parse, Restangular)
		{
			this.subscribe = function (binder) {
				binder.index = [];

				binder.persist = DirtyPersist;
				binder.persist.subscribe(binder.query);

				if ( binder.type === obBinderTypes.COLLECTION ) {
					binder.persist.on('add', binder.query, function (update) {
						var index = getIndexOfItem(binder.scope[binder.model], update.id, binder.key);

						index = typeof index === 'number' ? index : binder.scope[binder.model].length;

						binder.onProtocolChange.call(binder, [{
							addedCount: 1,
							added: [update],
							index: index,
							removed: []
						}]);
					});

					binder.persist.on('remove', binder.query, function (update) {
						var index = getIndexOfItem(binder.scope[binder.model], update.id, binder.key);

						if (typeof index !== 'number') return;

						var change = {
							removed: [update],
							addedCount: 0,
							index: index
						};

						binder.onProtocolChange.call(binder, [change]);
					});

					binder.persist.on('update', binder.query, function (update) {
						var index, removed;

						index = getIndexOfItem(binder.scope[binder.model], update.id, binder.key);

						index = typeof index === 'number' ? index : binder.scope[binder.model].length - 1;

						removed = angular.copy(binder.scope[binder.model][index]);

						binder.onProtocolChange.call(binder, [{
							index: index,
							addedCount: 1,
							removed: [removed],
							added: [update]
						}]);
					});
				}

				function getIndexOfItem (list, id, key) {
					var itemIndex;

					angular.forEach(list, function (item, i) {
						if (itemIndex) return itemIndex;
						if (item[key] === id) itemIndex = i;
					});

					return itemIndex;
				}
			};

			this.processChanges = function (binder, delta) {
				var change,
					getter = $parse(binder.model);

				for ( var i = 0; i < delta.changes.length; i++ ) {
					change = delta.changes[i];

					if ( change.addedCount ) {
						for (var j = change.index; j < change.addedCount + change.index; j++) {
							binder.ignoreNProtocolChanges++;

							var elem = getter(binder.scope)[j];

							Restangular.all(binder.query).post(elem)
								.then(function(reply) {
									elem.id = reply;
								});
						}
					}

					if ( change.removed.length ) {
						for (var k = 0; k < change.removed.length; k++) {
							binder.ignoreNProtocolChanges++;

							var object = change.removed[k];

							Restangular.one(binder.query, object.id).remove();
						}
					}

					if ( !$.isEmptyObject(change.changed) ) {
						binder.ignoreNProtocolChanges++;

						Restangular.one(binder.query, change.index)
							.customPOST(JSON.stringify(change.changed));
					}
				}
			};
		}
		]
	);

mangroveBase
	.service( 'DirtyPersist',
		[
		'$q', '$timeout', 'Restangular', 'appStatus',
		function ($q, $timeout, Restangular, appStatus)
		{
			appStatus.loading();

			var callbacks = [];

			var delay = 1000;

			var client = makeid();

			function makeid() {
				var text = "";
				var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

				for( var i=0; i < 12; i++ )
					text += possible.charAt(Math.floor(Math.random() * possible.length));

				return text;
			}

			// Register listener client, start polling
			Restangular.all('hook/subscriber').post({name:client}).then(
				function() {
					tick();
				}
			);

			// Poll the server every interval if we're listening for something
			var tick = function () {
				appStatus.ready(500);

				query().then(
					function () {
						Platform.performMicrotaskCheckpoint();

						$timeout(tick, delay);
					}
				);
			};

			// When polling, trigger callbacks
			var query = function () {
				var deferred = $q.defer();

				if ( callbacks.length ) {
					deferred.promise
						.then(updateCheck)
						.then(function(){
							appStatus.ready(500);
						})
				}

				deferred.resolve();

				return deferred.promise;
			};

			var updateCheck = function () {
				appStatus.loading();

				Restangular.all('hook/updates/'+client).getList().then(
					function (reply) {
						// If we find nothing right now, slow down a little
						if ( !reply || reply == "null" ) {
							delay = 2000;
							return;
						}

						var updates = [];

						angular.forEach(reply, function(update) {
							updates.push(update.originalElement);
						});

						if ( updates.length < 1 ) {
							delay = 2000;
							return;
						}

						// Regular speed now
						delay = 1000;

						angular.forEach(updates, function(update) {
							angular.forEach(callbacks, function(callback) {
								if (
									( update.operation == callback.operation )
										&& ( update.type == callback.query )
									) {
									callback.callback(update.object);
								}
							});
						});
					}
				);
			};

			this.on = function (operation, query, callback) {
				callbacks.push(
					{
						operation: operation,
						query:     query,
						callback:  callback
					}
				);
			};

			this.subscribe = function (res) {
				Restangular.all('hook/subscription').post(
					{client:client, resource:res}
				);
			}
		}
		]
	);

mangroveBase
	.service( 'appStatus',
		[
		'$rootScope',
		function ( $rootScope )
		{
			var timer;

			this.loading = function () {
				clearTimeout( timer );

				$rootScope.status = 1;
			};

			this.ready = function ( delay ) {
				function ready() {
					$rootScope.status = 0;
				}

				clearTimeout( timer );

				delay = delay == null ? 500 : false;

				if ( delay ) {
					timer = setTimeout( ready, delay );
				} else {
					ready();
				}
			};
		}
		]
	);
