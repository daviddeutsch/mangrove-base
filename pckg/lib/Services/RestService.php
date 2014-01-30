<?php

class RestService extends AbstractService
{
	public function call( $method, $path, $data=null )
	{
		$p = explode('/', $path);

		$rootmethod = strtolower($_SERVER['REQUEST_METHOD']);

		$submethod = '';
		$subaction = '';
		$subpath   = '';
		if ( count($p) > 2 ) {
			$submethod = $rootmethod;

			$subaction = $submethod . ucfirst($p[2]);

			if ( $this->is_callable($subaction) ) {
				$path = $p[0] . '/' . $p[1];

				unset($p[0], $p[1], $p[2]);

				if ( !empty($p) ) {
					$subpath = implode('/', $p);
				}
			}

			$rootmethod = 'get';
		}

		$rest = $this->restHandler();

		$return = $rest->handleRESTRequest(
			$rootmethod, $path, $data
		);

		if ( $rootmethod == 'get' ) {
			if ( is_array($return) ) {
				foreach ( $return as $k => $v ) {
					$return[$k] = $this->convertNumeric($v);
				}
			} else {
				$return = $this->convertNumeric($return);
			}
		}

		if ( !empty($subaction) ) {
			if ( strtolower($submethod) == 'post' ) {
				$return = $this->$subaction($subpath, $return, $data);
			} else {
				$return = $this->$subaction($subpath, $return);
			}
		}

		return $return;
	}

	protected function convertNumeric( $object )
	{
		foreach ( get_object_vars($object) as $k => $v ) {
			if ( is_numeric($v) ) {
				if ( strpos($v, '.') != false ) {
					$object->$k = (float) $v;
				} else {
					$object->$k = (int) $v;
				}
			}
		}

		return $object;
	}

	protected function restHandler()
	{
		return new \RedBean_Plugin_BeanCan(MangroveTodoApp::$r);
	}
}
