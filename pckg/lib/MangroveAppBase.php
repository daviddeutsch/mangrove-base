<?php

class MangroveAppBase
{
	/**
	 * @var RedBean_Instance
	 */
	public static $r;

	public static $base_path;

	public static $app_name;

	public static $services;

	public static $assets;

	public static function init( $base='', $name='', $services=array() )
	{
		if ( !empty($base) ) {
			self::$base_path = $base;
		}

		if ( !empty($name) ) {
			self::$app_name = $name;
		}


		if ( !empty($services) ) {
			self::$services = $services;
		}

		self::getDB();
	}

	public static function start()
	{
		if ( !empty( $_GET['path'] ) ) {
			self::resolve( substr($_GET['path'], 1) );
		} else {
			self::getApp();

			include self::$base_path . '/templates/main.html';
		}
	}

	public static function resolve( $path )
	{
		if ( empty($path) ) return self::getApp();

		$p = explode('/', $path);

		$service = ucfirst($p[0]) . 'Service';

		if ( !class_exists($service) ) {
			if ( !in_array($p[0], self::$services) ) {
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

		exit;
	}

	private static function getDB()
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

		self::$r->prefix($japp->getCfg('dbprefix') . self::$app_name . '_');

		self::$r->setupPipeline($japp->getCfg('dbprefix'));

		self::$r->redbean->beanhelper->setModelFormatter(new MangroveTodoModelFormatter);
	}

	public static function returnJSON( $data )
	{
		echo stripslashes(json_encode($data));

		exit;
	}

	protected static function addAssets( $type, $asset )
	{
		if ( is_array($asset) ) {
			self::$assets[$type] = array_merge(self::$assets[$type], $asset);
		} else {
			self::$assets[$type][] = $asset;
		}
	}

	protected static function prepareDocument()
	{
		$document = JFactory::getDocument();

		if ( !empty(self::$assets['css']) ) {
			$csslink = '<link rel="stylesheet" type="text/css" media="all" href="'
				. JURI::root()
				. 'media/'
				. 'com_' . self::$app_name
				. '/css/%s.css" />';

			foreach ( self::$assets['css'] as $file ) {
				$document->addCustomTag( sprintf($csslink, $file) );
			}
		}

		if ( !empty(self::$assets['js']) ) {
			$jslink = JURI::root()
				. 'media/'
				. 'com_' . self::$app_name
				. '/js/%s.js" />';

			foreach ( self::$assets['css'] as $file ) {
				$document->addScript( sprintf($jslink, $file) );
			}
		}
	}

}

