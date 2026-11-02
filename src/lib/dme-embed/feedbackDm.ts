/**
 * Web feedback entry point.
 *
 * Every "Feedback" affordance in the app funnels into a DM with the operator
 * account instead of linking out to an external form or a profile page: we
 * switch to the keep-mounted DME chat (`/messages`) and hand the embed a
 * start-chat intent for `FEEDBACK_DID` via the module-level buffer, so the
 * intent survives the iframe handshake (see `dmeStartChat`).
 *
 * Signed-out users cannot be dropped into `/messages` (the route renders an
 * empty view behind `requireAuth` and the embed has no token to handshake
 * with), so they land on the operator's profile instead — that page exposes a
 * chat button which creates the very same conversation once signed in.
 */

import {CommonActions, useNavigation} from '@react-navigation/native'

import {requestDmeStartChat} from '#/lib/dme-embed/dmeStartChat'
import {type NavigationProp} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import {IS_NATIVE} from '#/env'

/** Operator account that receives feedback DMs. */
export const FEEDBACK_DID = 'did:web:smite.hukoubook.com'

/**
 * Handle of the operator account, used for display purposes and as the
 * signed-out fallback profile. Derived from the `did:web` domain's
 * `alsoKnownAs` record.
 */
export const FEEDBACK_HANDLE = 'smitechow.com'

export const FEEDBACK_DM_PATH = '/messages'
export const FEEDBACK_PROFILE_PATH = `/profile/${FEEDBACK_HANDLE}`

function startFeedbackChat() {
  requestDmeStartChat({did: FEEDBACK_DID, handle: FEEDBACK_HANDLE})
}

/**
 * Imperative handler for button-style triggers (e.g. the drawer footer).
 */
export function useOpenFeedbackDm() {
  const navigation = useNavigation<NavigationProp>()
  const {hasSession} = useSession()

  return () => {
    if (!hasSession) {
      navigation.navigate('Profile', {name: FEEDBACK_HANDLE})
      return
    }

    if (IS_NATIVE) {
      // native keeps the bsky DM list inside the Messages tab stack
      navigation.dispatch(
        CommonActions.navigate('MessagesTab', {screen: 'Messages'}),
      )
    } else {
      // web renders a flat navigator, so `/messages` resolves from anywhere
      navigation.navigate('Messages')
    }

    startFeedbackChat()
  }
}

/**
 * Link props for inline-text triggers. The `to` keeps a real anchor href (open
 * in new tab / copy link keep working); the start-chat intent rides along on
 * the click itself.
 */
export function useFeedbackDmLink(): {
  to: string
  onPress?: () => void
} {
  const {hasSession} = useSession()

  if (!hasSession) {
    return {to: FEEDBACK_PROFILE_PATH}
  }

  return {
    to: FEEDBACK_DM_PATH,
    onPress: () => startFeedbackChat(),
  }
}
