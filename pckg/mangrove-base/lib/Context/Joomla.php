<?php

class Saltwater_Context_Joomla extends Saltwater_Context_Context
{
	public function __construct( $parent=null )
	{
		parent::__construct($parent);

		$japp = JFactory::getApplication();

		$type = $japp->getCfg('dbtype');

		if ( $type == 'mysqli' ) $type = 'mysql';

		$this->config = (object) array(
			'database' => (object) array(
					'type' => $type,
					'host' => $japp->getCfg('host'),
					'name' => $japp->getCfg('db'),
					'user' => $japp->getCfg('user'),
					'password' => $japp->getCfg('password')
				)
		);
	}
}
