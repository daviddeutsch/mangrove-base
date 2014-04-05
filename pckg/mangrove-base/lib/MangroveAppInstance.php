<?php

/**
 * Main, monolithic Facade Class for MangroveApp style software
 */
class MangroveAppInstance
{
	public $name;

	public $base_path;

	public $services;

	public $assets;

	public function create( $base='', $name='', $services=array() )
	{
		$this->name      = $name;
		$this->base_path = $base;
		$this->services  = $services;
	}

	public function getApp()
	{
		$this->addAssets('css', 'app');

		$this->addAssets('js', 'app');

		$this->prepareDocument();

		include $this->base_path . '/templates/main.html';
	}

	protected function addAssets( $type, $asset )
	{
		if ( is_array($asset) ) {
			if ( !empty($this->assets[$type]) ) {
				$this->assets[$type] = array_merge($this->assets[$type], $asset);
			} else {
				$this->assets[$type] = $asset;
			}
		} else {
			$this->assets[$type][] = $asset;
		}
	}

	protected function prepareDocument()
	{
		$document = JFactory::getDocument();

		if ( !empty($this->assets['css']) ) {
			$csslink = '<link rel="stylesheet" type="text/css" media="all" href="'
				. JURI::root()
				. 'media/com_' . $this->name
				. '/css/%s.css" />';

			foreach ( $this->assets['css'] as $file ) {
				$document->addCustomTag( sprintf($csslink, $file) );
			}
		}

		if ( !empty($this->assets['js']) ) {
			$jslink = JURI::root()
				. 'media/com_' . $this->name
				. '/js/%s.js" />';

			foreach ( $this->assets['js'] as $file ) {
				if ( $file == 'angular.min' ) {
					$document->addScript( 'https://ajax.googleapis.com/ajax/libs/angularjs/1.2.10/angular.js' );
				} else {
					$document->addScript( sprintf($jslink, $file) );
				}

			}
		}
	}

}

