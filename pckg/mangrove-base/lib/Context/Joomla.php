<?php

class Saltwater_Context_Joomla extends Saltwater_Context_Context
{
	public function __construct( $parent=null )
	{
		parent::__construct($parent);

		$japp = JFactory::getApplication();

		if ( $japp->getCfg('dbtype') == 'mysqli' ) {
			$type = 'mysql';
		} else {
			$type = $japp->getCfg('dbtype');
		}

		$this->config = (object) array(
			'database' => (object) array(
					'type' => $type,
					'host' => 'localhost',
					'name' => 'valanx_packages',
					'user' => 'valanx_ASkj',
					'password' => 'QeNPeK18asd324S'
				);
		);
	}
}
