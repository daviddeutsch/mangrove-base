<?php

class AbstractService
{
	public function is_callable( $method )
	{
		return method_exists($this, $method);
	}

	public function call( $method, $path, $data=null )
	{
		if ( !$this->is_callable($method) ) return null;

		$params = array();
		if ( !empty($path) ) $params[] = $path;
		if ( !empty($data) ) $params[] = $data;

		call_user_func_array( array($this, $method), $params );
	}
}
