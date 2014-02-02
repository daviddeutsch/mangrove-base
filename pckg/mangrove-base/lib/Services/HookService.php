<?php

class HookService extends AbstractService
{
	public function call( $method, $path, $data=null )
	{
		if ( !$this->is_callable($method) ) return null;

		if ( $method == 'getUpdates' ) {
			$p = explode('/', $path);
			$s = array_pop($p);

			return call_user_func( array($this, $method), $s );
		} else {
			call_user_func( array($this, $method), $data );

			return null;
		}
	}

	public function postSubscriber( $data )
	{
		RedBean_Pipeline::addSubscriber( $data );
	}

	public function removeSubscriber( $subscriber )
	{
		RedBean_Pipeline::removeSubscriber( $subscriber );
	}

	public function postPublisher( $data )
	{
		RedBean_Pipeline::addPublisher( $data );
	}

	public function removePublisher( $publisher )
	{
		RedBean_Pipeline::removePublisher( $publisher );
	}

	public function postSubscription( $data )
	{
		RedBean_Pipeline::subscribe( $data->client, $data->resource );
	}

	public function removeSubscription( $data )
	{
		RedBean_Pipeline::unsubscribe( $data->client, $data->resource );
	}

	public function getUpdates( $subscriber )
	{
		$updates = RedBean_Pipeline::getUpdatesForSubscriber( $subscriber );

		if ( empty($updates) ) return $updates;

		foreach ( $updates as $k => $v ) {
			$updates[$k] = $this->convertNumeric($v);
		}

		return $updates;
	}

	protected function convertNumeric( $object )
	{
		foreach ( get_object_vars($object) as $k => $v ) {
			if ( $k == 'object' ) {
				if ( is_string($v) ) $v = json_decode($v);

				$object->$k = $this->convertNumeric($v);
			} elseif ( is_numeric($v) ) {
				if ( strpos($v, '.') != false ) {
					$object->$k = (float) $v;
				} else {
					$object->$k = (int) $v;
				}
			}
		}

		return $object;
	}

}
