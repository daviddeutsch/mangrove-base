<?php

class HookService extends Saltwater_Service
{
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
		RedBean_Pipeline::subscribe( $this->getClient(), $data->resource );
	}

	public function removeSubscription( $data )
	{
		RedBean_Pipeline::unsubscribe( $this->getClient(), $data->resource );
	}

	public function getUpdates()
	{
		$updates = RedBean_Pipeline::getUpdatesForSubscriber($this->getClient());

		if ( empty($updates) ) return null;

		foreach ( $updates as $k => $v ) {
			$updates[$k] = $this->convertNumeric($v);

			$path = explode('/', $updates[$k]->path);

			if ( count($path) > 2 ) {
				$updates[$k]->object = S::$r->_($path[2], $path[3]);

				$updates[$k]->object = $updates[$k]->object->export();
			}
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

	protected function getClient()
	{
		if ( !empty(S::$session->id) ) {
			return 'session-' . S::$session->id;
		}

		if ( is_a(S::$subject, 'RedBean_OODBBean') ) {
			$class = S::$subject->getMeta('type');
		} else {
			$class = explode('\\', get_class(S::$subject));

			$class = implode('', array_slice($class, -1));
		}

		return strtolower($class) . '-' . S::$subject->id;
	}
}
