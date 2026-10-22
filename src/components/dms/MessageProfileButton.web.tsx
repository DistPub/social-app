import React from 'react'
import {type AppBskyActorDefs} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {requestDmeStartChat} from '#/lib/dme-embed/dmeStartChat'
import {type NavigationProp} from '#/lib/routes/types'
import {atoms as a} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {Message_Stroke2_Corner0_Rounded as Message} from '#/components/icons/Message'
import {useAnalytics} from '#/analytics'

/**
 * Web-only profile "chat" button. Unlike the native variant, this does NOT
 * consult bsky's convo availability (`canChat`/`canBeMessaged`) — DME is the
 * sole chat system on web and owns its own availability policy, so the button
 * is ALWAYS visible. Tapping it routes to /messages (where the keep-mounted
 * DME iframe lives) and hands over a `DME_START_CHAT` intent; the bridge
 * buffers the intent until the embed's handshake completes, so this is safe
 * even before the iframe has authenticated.
 */
export function MessageProfileButton({
  profile,
}: {
  profile: AppBskyActorDefs.ProfileViewDetailed
}) {
  const {_} = useLingui()
  const ax = useAnalytics()
  const navigation = useNavigation<NavigationProp>()

  const onPress = () => {
    ax.metric('chat:open', {logContext: 'ProfileHeader'})
    navigation.navigate('Messages')
    requestDmeStartChat({did: profile.did, handle: profile.handle})
  }

  return (
    <Button
      accessibilityRole="button"
      testID="dmBtn"
      size="small"
      color="secondary"
      variant="solid"
      shape="round"
      label={_(msg`Message ${profile.handle}`)}
      style={[a.justify_center]}
      onPress={onPress}>
      <ButtonIcon icon={Message} size="md" />
    </Button>
  )
}
