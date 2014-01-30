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

		if ( empty( $path ) ) {
			if ( empty( $data ) ) {
				call_user_func( array($this, $method) );
			} else {
				call_user_func( array($this, $method), $data );
			}
		} elseif ( empty( $data ) ) {
			call_user_func( array($this, $method), $path );
		} else {
			call_user_func( array($this, $method), $path, $data );
		}
	}
}
