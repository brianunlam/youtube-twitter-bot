import { MILLISECONDS_IN_SECOND, SECONDS_IN_MINUTE } from '../constants';

export function fromMinutesToMilliseconds(inMinute: number) {
  return inMinute * MILLISECONDS_IN_SECOND * SECONDS_IN_MINUTE;
}
