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
		$this->base_path = $base;
		$this->app_name  = $name;
		$this->services  = $services;
	}

	protected function addAssets( $type, $asset )
	{
		if ( is_array($asset) ) {
			$this->assets[$type] = array_merge($this->assets[$type], $asset);
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
				. 'media/'
				. 'com_' . $this->app_name
				. '/css/%s.css" />';

			foreach ( $this->assets['css'] as $file ) {
				$document->addCustomTag( sprintf($csslink, $file) );
			}
		}

		if ( !empty($this->assets['js']) ) {
			$jslink = JURI::root()
				. 'media/'
				. 'com_' . $this->app_name
				. '/js/%s.js" />';

			foreach ( $this->assets['css'] as $file ) {
				$document->addScript( sprintf($jslink, $file) );
			}
		}
	}

}

