<?php

class MangroveAppBase
{
	/**
	 * @var RedBean_Instance
	 */
	public static $r;

	public static $base_path;

	public static $services;

	public static function init( $base='', $services=array() )
	{
		if ( !empty($base) ) {
			self::$base_path = $base;
		}

		if ( !empty($services) ) {
			self::$services = $services;
		}

		self::getDB();
	}

	public static function resolve( $path )
	{
		if ( empty($path) ) return self::getApp();

		$p = explode('/', $path);

		$service = ucfirst($p[0]) . 'Service';

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

		if ( class_exists($service) ) {
			$service = new $service();

			$result = $service->call($method, $path, $input);

			echo stripslashes(json_encode($result));

			exit;
		}

		exit;
	}

	/**
	 * @param object $japp JApplication
	 */
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

		self::$r->prefix($japp->getCfg('dbprefix') . 'mangrovetodo_');

		self::$r->setupPipeline($japp->getCfg('dbprefix'));

		self::$r->redbean->beanhelper->setModelFormatter(new MangroveTodoModelFormatter);
	}

}

