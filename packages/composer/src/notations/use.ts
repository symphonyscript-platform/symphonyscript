import { Composable } from '../interfaces/composable'
import { LinkBuilder } from '../builders/LinkBuilder'

/** Insert another clip's content at the current tick. Returns LinkBuilder for configuration. */
export function use(clip: Composable): LinkBuilder {
  return new LinkBuilder({ clip })
}
