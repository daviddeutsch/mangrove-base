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

	public static function start( $context )
	{
		if ( !empty( $_GET['path'] ) ) {
			S::init(
				$context,
				substr(filter_input(INPUT_GET, 'path', FILTER_SANITIZE_URL), 1)
			);
		} else {
			self::$app->getApp();
		}
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

