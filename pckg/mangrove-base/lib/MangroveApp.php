<?php

/**
 * Main, monolithic Facade Class for MangroveApp style software
 */
class MangroveApp
{
	public static $context;

	public static function start( $context )
	{
		self::$context = $context;

		if ( !empty( $_GET['path'] ) ) {
			S::init(
				self::$context,
				substr(filter_input(INPUT_GET, 'path', FILTER_SANITIZE_URL), 1)
			);

			S::route();
		} else {
			self::$context->getApp();
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

