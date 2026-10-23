/**
 * Web-only override for the `/messages/:conversation` route — the old bsky DM
 * conversation screen.
 *
 * Expo/Metro platform resolution picks this `.web.tsx` file INSTEAD of the
 * suffix-less `Conversation.tsx` on web builds, so `Navigation.tsx`'s
 * `import {MessagesConversationScreen} from '#/screens/Messages/Conversation'`
 * resolves here on web. The native conversation screen is untouched and still
 * serves native builds.
 *
 * The native screen mounts `ConvoProvider`, which depends on the bsky DM
 * provider stack (`MessagesEventBusProvider`) that web no longer mounts (see
 * `src/state/messages/index.web.tsx` — DME is the sole chat system on web), so
 * it would crash if rendered here. Old deep links to conversation URLs are
 * redirected to `/messages`, where the keep-mounted DME iframe lives.
 *
 * Rollback: delete this file to restore the old web conversation screen.
 */

import {useEffect} from 'react'
import {useNavigation} from '@react-navigation/native'
import type React from 'react'

import {type NavigationProp} from '#/lib/routes/types'

export function MessagesConversationScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>()

  useEffect(() => {
    navigation.navigate('Messages')
  }, [navigation])

  return null
}
