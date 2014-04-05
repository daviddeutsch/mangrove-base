var mangroveBase = angular.module("mangroveBase", ['OctoBinder']);

mangroveBase
	.service('dataPersist',
	[
	'obBinder', 'obBinderTypes', 'mgAppStatus', 'restBinder', 'mgAppHttp', '$q', '$rootScope',
	function(obBinder, obBinderTypes, mgAppStatus, restBinder, mgAppHttp, $q, $rootScope)
	{
		this.storage = $rootScope.$new();

		this.meta = {};

		var self = this;

		this.bindResource = function(scope, entry) {
			var deferred = $q.defer();

			mgAppStatus.loading();

			this.assureResource(entry.res)
				.then(
					function() {
						// For nested path resources, we bind the scope to the last one
						var parts = entry.res.split('/');

						scope[parts[parts.length-1]] = self.storage[entry.res];

						if ( typeof entry.callback !== 'undefined') {
							self.meta[entry.res].callback = entry.callback;
						} else {
							self.meta[entry.res].callback = {};
						}

						self.augmentScope(scope);

						deferred.resolve();
					}
				)
				.catch(function() {
					deferred.reject();
				})
				["finally"](function() {
					mgAppStatus.ready(500);
				});

			return deferred.promise;
		};

		this.augmentScope = function(scope) {
			// Adding convenience functions
			if ( typeof scope.add != 'undefined' ) return;

			scope.add    = this.add;
			scope.remove = this.remove;
		};

		this.assureResource = function(resource) {
			var deferred = $q.defer();

			if ( typeof this.storage[resource] == 'undefined') {
				this.load(resource)
					.then(
						function() { deferred.resolve(); },
						function() { deferred.reject(); }
					);
			} else {
				deferred.resolve();
			}

			return deferred.promise;
		};

		this.bindItem = function(scope, type, id, name, key) {
			if ( typeof name == 'undefined' ) name = 'item';

			if ( typeof key == 'undefined' ) key = 'id';

			var deferred = $q.defer();

			for ( var i = 0; i < this.storage[type].length; i++ ) {
				if (this.storage[type][i][key] !== id) {
					if ( i === this.storage[type].length ) {
						deferred.reject();
					}
				} else {
					scope[name] = this.storage[type][i];

					deferred.resolve();

					break;
				}
			}

			return deferred.promise;
		};

		this.load = function(resource) {
			var deferred = $q.defer();

			mgAppHttp.get('/'+resource)
				.success(
					function (data) {
						self.setList(resource, data);

						deferred.resolve();
					}
				)
				.error( function() {
					deferred.reject();
				} );

			return deferred.promise;
		};

		this.setList = function(type, data) {
			if ( typeof this.storage[type] == 'undefined' ) {
				this.storage[type] = [];

				this.meta[type] = {
					binder: {},
					callback: {}
				}
			}

			this.storage[type] = data;

			this.meta[type].binder = obBinder(
				this.storage,
				type,
				restBinder,
				{
					key: 'id',
					query: type,
					type: obBinderTypes.COLLECTION
				}
			);

			this.meta[type].binder.persist.on('remove', type,
				function(update) {
					self.callback(this.query, 'remove', update.id);
				}
			);
		};

		this.add = function(item, type) {
			var list = self.storage[type];

			list.push(item);

			// Callback when we have an id set for the new item
			var observer = new ObjectObserver(
				list[list.length-1],
				function(change) {
					if ( typeof change.id == 'undefined' ) return;

					self.callback(type, 'add', item.id);

					observer.close();
				}
			);

			Platform.performMicrotaskCheckpoint();
		};

		this.remove = function(id, type) {
			var list = self.storage[type];

			for ( var i = 0; i < list.length; i++ ) {
				if (list[i].id != id) continue;

				list.splice(i, 1);

				self.callback(type, 'remove', id);

				Platform.performMicrotaskCheckpoint();

				break;
			}
		};

		this.callback = function(type, event, id) {
			if ( typeof self.meta[type].callback[event] !== 'undefined' ) {
				self.meta[type].callback[event](id);
			}
		}
	}
	]
);

mangroveBase
	.service('restBinder',
	[
	'DirtyPersist', 'obBinderTypes', '$parse', 'mgAppHttp', '$q',
	function (DirtyPersist, obBinderTypes, $parse, mgAppHttp, $q)
	{
		var that = this;

		function getIndexOfItem (list, id, key) {
			for ( var i=0; i<list.length; i++ ) {
				if (list[i][key] === id) return i;
			}

			return null;
		}

		function addCallback(binder, update) {
			var defer = $q.defer(),
				index = getIndexOfItem(binder.scope[binder.model], update.id, binder.key);

			// Check if item already exists
			if (typeof index === 'number') {
				defer.resolve();
			} else {
				index = binder.scope[binder.model].length;

				binder.onProtocolChange.call(binder, [{
					addedCount: 1,
					added: [update],
					index: index,
					removed: []
				}])
				.then(function(){
					defer.resolve();
				});
			}

			return defer.promise;
		}

		function removeCallback(binder, update) {
			var defer = $q.defer(),
				index = getIndexOfItem(binder.scope[binder.model], update.id, binder.key);

			// Check if item is already gone
			if (typeof index !== 'number') {
				defer.resolve();
			} else {
				var change = {
					removed: [update],
					addedCount: 0,
					index: index
				};

				binder.onProtocolChange.call(binder, [change])
					.then(function(){
						defer.resolve();
					});
			}

			return defer.promise;
		}

		function updateCallback(binder, update) {
			var defer = $q.defer(),
				index,
				removed;

			index = getIndexOfItem(binder.scope[binder.model], update.id, binder.key);

			index = typeof index === 'number' ? index : binder.scope[binder.model].length - 1;

			removed = angular.copy(binder.scope[binder.model][index]);

			binder.onProtocolChange.call(binder, [{
				index: index,
				addedCount: 1,
				removed: [removed],
				added: [update]
			}])
			.then(function(){
				defer.resolve();
			});

			return defer.promise;
		}

		this.subscribe = function (binder) {
			binder.index = [];

			binder.persist = DirtyPersist;
			binder.persist.subscribe(binder.query);

			if ( binder.type !== obBinderTypes.COLLECTION ) return;

			binder.persist.on('add', binder.query,
				function(update){ return addCallback(binder, update); }
			);

			binder.persist.on('remove', binder.query,
				function(update){ return removeCallback(binder, update); }
			);

			binder.persist.on('update', binder.query,
				function(update){ return updateCallback(binder, update); }
			);
		};

		function postAdditions(binder, change, getter) {
			var defer = $q.defer(),
				promises = [];

			for (var j = change.index; j < change.addedCount + change.index; j++) {
				promises.push(
					function() {
						var elem = getter(binder.scope)[j];

						// Post to server, assign the id we get back
						return mgAppHttp.post('/'+binder.query, elem)
							.success(
							function(data) {
								elem.id = Number(data);
							}
						);
					}(binder)
				);
			}

			$q.all(promises).then(function(){
				defer.resolve();
			});

			return defer.promise;
		}

		function postRemoves(binder, change) {
			var defer = $q.defer(),
				promises = [];

			for (var k = 0; k < change.removed.length; k++) {
				promises.push(
					function(){
						var object = change.removed[k];

						return mgAppHttp.delete('/'+binder.query+'/'+object.id);
					}(change)
				);
			}

			$q.all(promises).then(function(){ defer.resolve(); });

			return defer.promise;
		}

		function postChanges(binder, change) {
			change.changed.id = change.index;

			return mgAppHttp.post('/'+binder.query, JSON.stringify(change.changed));
		}

		this.processChanges = function (binder, delta) {
			var change,
				getter = $parse(binder.model),
				defer = $q.defer(),
				promises = [];

			for ( var i = 0; i < delta.changes.length; i++ ) {
				change = delta.changes[i];

				if ( change.addedCount ) {
					promises.push(function(){
						return postAdditions(binder, change, getter);
					}(change));
				}

				if ( change.removed.length ) {
					promises.push(function(){
						return postRemoves(binder, change);
					}(change));
				}

				if ( !$.isEmptyObject(change.changed) ) {
					promises.push(function(){
						return postChanges(binder, change);
					}(change));
				}
			}

			$q.all(promises).then(function(){ defer.resolve(); });

			return defer.promise;
		};
	}
	]
);

mangroveBase
	.service( 'DirtyPersist',
	[
	'$q', '$timeout', 'mgAppHttp', '$state', 'mgAppStatus',
	function ($q, $timeout, mgAppHttp, $state, mgAppStatus)
	{
		var callbacks = [];

		var delay = 1000;

		var keepalive;

		var self = this;

		// Poll the server every interval if we're listening for something
		this.tick = function () {
			mgAppStatus.ready(500);

			self.query().then(
				function () {
					Platform.performMicrotaskCheckpoint();

					keepalive = $timeout(self.tick, delay);
				}(delay)
			);
		};

		// When polling, trigger callbacks
		this.query = function () {
			var defer = $q.defer();

			self.updateCheck()
				.then(function(){
					defer.resolve();

					mgAppStatus.ready(500);
				});

			return defer.promise;
		};

		this.updateCheck = function () {
			var defer = $q.defer();

			mgAppHttp.get('/hook/updates')
				.success(
					function(data, status) {
						if ( data.length < 1 ) {
							// If we find nothing right now, slow down a little
							delay = 2000;

							return;
						}

						mgAppStatus.loading();

						// Regular speed now
						delay = 1000;

						self.processUpdates(data, status)
							.then(function() {
								defer.resolve();
							});
					}
				)
				.error(
				function(data, status) {
					if ( status == 401 ) {
						$state.transitionTo('terminate');
					} else {
						delay = 2000;
					}

					defer.resolve();
				}
			);

			return defer.promise;
		};

		this.processUpdates = function(updates, status) {
			var defer = $q.defer(),
				promises = [];

			for ( var i=0; i<updates.length; i++ ) {
				for ( var j=0; j<callbacks.length; j++ ) {
					if (
						( updates[i].operation === callbacks[j].operation )
							&& ( updates[i].type === callbacks[j].query )
						) {
						promises.push(
							function() {
								callbacks[j].callback(updates[i].object);
							}(j,i)
						);
					}


				}
			}

			$q.all(promises).then(function(){ defer.resolve(); });

			return defer.promise;
		};

		this.cycleStart = function() {
			self.tick();
		};

		this.cycleStop = function() {
			$timeout.cancel(keepalive);
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
			mgAppHttp.post('/hook/subscription', {resource:res});
		}
	}
	]
);

mangroveBase
	.service( 'mgAppSession',
	[
	'mgAppHttp',
	function( mgAppHttp )
	{
		function Session() {
			var session = this;

			this.init = function(component) {
				mgAppHttp.baseUrl = 'index.php?option='+component+'&path='
			};
		}

		return new Session();
	}
	]
);

mangroveBase
	.service( 'mgAppHttp',
	[
	'$http',
	function( $http )
	{
		this.baseUrl = '';

		this.get = function(path) {
			return $http.get(this.baseUrl+path);
		};

		this.post = function(path, data) {
			return $http.post(this.baseUrl+path, data);
		};

		this['delete'] = function(path) {
			return $http.delete(this.baseUrl+path);
		};

		this.setCommonHeader = function(name, value)
		{
			$http.defaults.headers.common[name] = value;
		}
	}
	]
);

mangroveBase
	.service('mgAppStatus',
	[
	'$rootScope',
	function ( $rootScope )
	{
		var timer;

		this.loading = function () {
			clearTimeout( timer );

			$rootScope.loading = 1;
		};

		this.ready = function ( delay ) {
			function ready() {
				$rootScope.loading = 0;
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
