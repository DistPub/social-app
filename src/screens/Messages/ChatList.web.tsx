/**
 * Web-only override for the `/messages` route — keep-mounted placeholder.
 *
 * Expo/Metro platform resolution picks this `.web.tsx` file INSTEAD of the
 * suffix-less `ChatList.tsx` on web builds, so `Navigation.tsx`'s
 * `import {MessagesScreen} from '#/screens/Messages/ChatList'` resolves here
 * on web. The native DM list is untouched and still serves native builds.
 *
 * The real DME embed is mounted once, at the shell layer
 * (`src/view/shell/index.web.tsx`), so it survives route changes. That is why
 * this screen body is intentionally empty: rendering the embed here would
 * unmount it every time the user navigates away from `/messages`. This file
 * exists purely to keep a valid `MessagesScreen` for the route.
 *
 * Rollback: delete this file to restore the old web DM list.
 */

import React from 'react'
import {View} from 'react-native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type MessagesTabNavigatorParams} from '#/lib/routes/types'
import {atoms as a} from '#/alf'

type Props = NativeStackScreenProps<MessagesTabNavigatorParams, 'Messages'>

export function MessagesScreen(_props: Props): React.JSX.Element {
  return <View style={a.flex_1} />
}
