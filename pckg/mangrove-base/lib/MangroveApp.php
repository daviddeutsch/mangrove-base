<?php

/**
 * Main, monolithic Facade Class for MangroveApp style software
 */
class MangroveApp
{
	/**
	 * @var array List of applications active in the current request
	 */
	private static $apps = array();

	/**
	 * @var object Currently active application
	 */
	public static $app;

	/**
	 * @var RedBean_Instance
	 */
	public static $r;

	public static function addSimple( $base='', $name='', $services=array() )
	{
		self::$apps[$name] = new MangroveAppInstance();

		self::$apps[$name]->create($base, $name, $services);

		self::select($name);
	}

	public static function add( $class )
	{
		if ( !class_exists($class) ) return false;

		$instance = new $class();

		self::$apps[$instance->name] = $instance;

		return self::select($instance->name);
	}

	public static function select( $name )
	{
		if ( !array_key_exists($name, self::$apps) ) return false;

		self::$app =& self::$apps[$name];

		self::getDB();

		self::$app->ready();

		return true;
	}

	public static function start()
	{
		if ( !empty( $_GET['path'] ) ) {
			self::resolve(
				substr(
					filter_input(INPUT_GET, 'path', FILTER_SANITIZE_URL),
					1
				)
			);
		} else {
			self::$app->getApp();
		}
	}

	public static function resolve( $path )
	{
		if ( empty($path) ) return self::$app->getApp();

		if ( strpos($path, '/') === 0 ) $path = substr($path, 1);

		$p = explode('/', $path);

		foreach ( $p as $k => $v ) {
			$p[$k] = preg_replace("/[^a-z0-9.]+/i", "", $v);
		}

		$service = ucfirst($p[0]) . 'Service';

		if ( !class_exists($service) ) {
			if ( !in_array($p[0], self::$app->services) ) {
				exit;
			}

			$service = 'RestService';
		}

		if ( isset($p[1]) ) {
			$method = strtolower($_SERVER['REQUEST_METHOD']) . ucfirst($p[1]);
		} else {
			$method = strtolower($_SERVER['REQUEST_METHOD']) . ucfirst($p[0]);
		}

		$input = @file_get_contents('php://input');

		if ( !$input ) {
			$input = '';
		} else {
			$input = json_decode($input);
		}

		$service = new $service();

		$result = $service->call($method, $path, $input);

		self::returnJSON($result);
	}

	private static function getDB()
	{
		$japp = JFactory::getApplication();

		if ( !is_object(self::$r) ) self::createDB();

		self::$r->prefix(
			$japp->getCfg('dbprefix') . self::$app->name . '_'
		);

		self::$r->setupPipeline($japp->getCfg('dbprefix'));

		self::$r->redbean->beanhelper->setModelFormatter(
			new MangroveModelFormatter
		);

		return true;
	}

	private static function createDB()
	{
		$japp = JFactory::getApplication();

		self::$r = new RedBean_Instance();

		if ( $japp->getCfg('dbtype') == 'mysqli' ) {
			$type = 'mysql';
		} else {
			$type = $japp->getCfg('dbtype');
		}

		self::$r->addDatabase(
			'joomla',
			$type . ':'
			. 'host=' . $japp->getCfg('host') . ';'
			. 'dbname=' . $japp->getCfg('db'),
			$japp->getCfg('user'),
			$japp->getCfg('password')
		);

		self::$r->selectDatabase('joomla');
	}

	public static function returnJSON( $data )
	{
		echo stripslashes(json_encode($data));

		exit;
	}

	protected static function prepareDocument()
	{
		$document = JFactory::getDocument();

		if ( !empty(self::$app->assets['css']) ) {
			$csslink = '<link rel="stylesheet" type="text/css" media="all" href="'
				. JURI::root()
				. 'media/'
				. 'com_' . self::$app->name
				. '/css/%s.css" />';

			foreach ( self::$app->assets['css'] as $file ) {
				$document->addCustomTag( sprintf($csslink, $file) );
			}
		}

		if ( !empty(self::$app->assets['js']) ) {
			$jslink = JURI::root()
				. 'media/'
				. 'com_' . self::$app->name
				. '/js/%s.js" />';

			foreach ( self::$app->assets['css'] as $file ) {
				$document->addScript( sprintf($jslink, $file) );
			}
		}
	}

}

