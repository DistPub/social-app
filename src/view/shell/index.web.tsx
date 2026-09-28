import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {StyleSheet, TouchableWithoutFeedback, View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

import {sendToDme} from '#/lib/dme-embed/useDmeEmbedBridge'
import {useDmeTokenProvider} from '#/lib/dme-embed/useDmeTokenProvider'
import {useIntentHandler} from '#/lib/hooks/useIntentHandler'
import {useNavigationTabState} from '#/lib/hooks/useNavigationTabState'
import {type NavigationProp} from '#/lib/routes/types'
import {reportDmeUnread} from '#/state/dme/useDmeUnreadCount'
import {useSession} from '#/state/session'
import {useIsDrawerOpen, useSetDrawerOpen} from '#/state/shell'
import {useComposerKeyboardShortcut} from '#/state/shell/composer/useComposerKeyboardShortcut'
import {useCloseAllActiveElements} from '#/state/util'
import {Lightbox} from '#/view/com/lightbox/Lightbox'
import {ModalsContainer} from '#/view/com/modals/Modal'
import {ErrorBoundary} from '#/view/com/util/ErrorBoundary'
import {Deactivated} from '#/screens/Deactivated'
import {DmeEmbed} from '#/screens/Messages/DmeEmbed'
import {Takendown} from '#/screens/Takendown'
import {
  atoms as a,
  select,
  useBreakpoints,
  useLayoutBreakpoints,
  useTheme,
} from '#/alf'
import {AgeAssuranceRedirectDialog} from '#/components/ageAssurance/AgeAssuranceRedirectDialog'
import {EmailDialog} from '#/components/dialogs/EmailDialog'
import {LinkWarningDialog} from '#/components/dialogs/LinkWarning'
import {MutedWordsDialog} from '#/components/dialogs/MutedWords'
import {NuxDialogs} from '#/components/dialogs/nuxs'
import {SigninDialog} from '#/components/dialogs/Signin'
import {useWelcomeModal} from '#/components/hooks/useWelcomeModal'
import {CENTER_COLUMN_OFFSET} from '#/components/Layout'
import {GlobalReportDialog} from '#/components/moderation/ReportDialog'
import {
  Outlet as PolicyUpdateOverlayPortalOutlet,
  usePolicyUpdateContext,
} from '#/components/PolicyUpdateOverlay'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {WelcomeModal} from '#/components/WelcomeModal'
import {useAgeAssurance} from '#/ageAssurance'
import {NoAccessScreen} from '#/ageAssurance/components/NoAccessScreen'
import {RedirectOverlay} from '#/ageAssurance/components/RedirectOverlay'
import {PassiveAnalytics} from '#/analytics/PassiveAnalytics'
import {FlatNavigator, RoutesContainer} from '#/Navigation'
import {Composer} from './Composer.web'
import {DrawerContent} from './Drawer'

/**
 * Height of the mobile web bottom bar. Mirrors the value Composer.web uses to
 * keep its content clear of the bar; the DME embed layer reserves the same
 * strip so the bar stays tappable while the embed is on screen.
 */
const DME_MOBILE_BOTTOM_INSET = 61

function ShellInner() {
  const navigator = useNavigation<NavigationProp>()
  const closeAllActiveElements = useCloseAllActiveElements()
  const {state: policyUpdateState} = usePolicyUpdateContext()
  const welcomeModalControl = useWelcomeModal()
  const {hasSession, currentAccount} = useSession()
  const {isAtMessages} = useNavigationTabState()
  const {gtMobile} = useBreakpoints()
  const {centerColumnOffset} = useLayoutBreakpoints()
  const tokenProvider = useDmeTokenProvider({sendToDme})

  useComposerKeyboardShortcut()
  useIntentHandler()

  useEffect(() => {
    const unsubscribe = navigator.addListener('state', () => {
      closeAllActiveElements()
    })
    return unsubscribe
  }, [navigator, closeAllActiveElements])

  // Clear the DME unread badge whenever the signed-in account changes
  // (account switch or logout). The ref makes this fire only on a genuine
  // did change, never on every render. `reportDmeUnread` is idempotent.
  const prevDidRef = useRef(currentAccount?.did)
  useEffect(() => {
    const did = currentAccount?.did
    if (prevDidRef.current !== did) {
      prevDidRef.current = did
      reportDmeUnread(null)
    }
  }, [currentAccount?.did])

  const drawerLayout = useCallback(
    ({children}: {children: React.ReactNode}) => (
      <DrawerLayout>{children}</DrawerLayout>
    ),
    [],
  )
  return (
    <>
      <ErrorBoundary>
        <FlatNavigator layout={drawerLayout} />
      </ErrorBoundary>
      {/*
        Persistent DME embed layer — mounted OUTSIDE the navigator so route
        changes never unmount the iframe (its in-frame polling must survive
        navigation). Visibility is toggled with `display`, which hides the
        frame without tearing it down; the browser keeps its timers running.
        It is deliberately NOT rendered conditionally on `isAtMessages` —
        only the account did is allowed to remount it.
        Geometry keeps it inside the centre content column (desktop) / above
        the bottom bar (mobile) so the left nav, right rail, and bottom bar
        remain clickable.
      */}
      {hasSession && (
        <View
          style={[
            styles.dmeLayer,
            gtMobile
              ? {
                  left: '50%',
                  width: '100%',
                  maxWidth: 600,
                  transform: [
                    {translateX: '-50%'},
                    {translateX: centerColumnOffset ? CENTER_COLUMN_OFFSET : 0},
                    ...a.scrollbar_offset.transform,
                  ],
                }
              : {left: 0, right: 0, bottom: DME_MOBILE_BOTTOM_INSET},
            {display: isAtMessages ? 'flex' : 'none'},
          ]}>
          <DmeEmbed
            key={currentAccount?.did ?? 'signed-out'}
            getToken={tokenProvider.getToken}
            onSessionInvalid={tokenProvider.onSessionInvalid}
          />
        </View>
      )}
      <Composer winHeight={0} />
      <ModalsContainer />
      <MutedWordsDialog />
      <SigninDialog />
      <EmailDialog />
      <AgeAssuranceRedirectDialog />
      <LinkWarningDialog />
      <Lightbox />
      <NuxDialogs />
      <GlobalReportDialog />

      {welcomeModalControl.isOpen && (
        <WelcomeModal control={welcomeModalControl} />
      )}

      {/* Until policy update has been completed by the user, don't render anything that is portaled */}
      {policyUpdateState.completed && (
        <>
          <PortalOutlet />
        </>
      )}

      <PolicyUpdateOverlayPortalOutlet />
    </>
  )
}

function DrawerLayout({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const isDrawerOpen = useIsDrawerOpen()
  const setDrawerOpen = useSetDrawerOpen()
  const {gtTablet} = useBreakpoints()
  const {_} = useLingui()
  const showDrawer = !gtTablet && isDrawerOpen
  const [showDrawerDelayedExit, setShowDrawerDelayedExit] = useState(showDrawer)

  useLayoutEffect(() => {
    if (showDrawer !== showDrawerDelayedExit) {
      if (showDrawer) {
        setShowDrawerDelayedExit(true)
      } else {
        const timeout = setTimeout(() => {
          setShowDrawerDelayedExit(false)
        }, 160)
        return () => clearTimeout(timeout)
      }
    }
  }, [showDrawer, showDrawerDelayedExit])

  return (
    <>
      {children}
      {showDrawerDelayedExit && (
        <>
          <RemoveScrollBar />
          <TouchableWithoutFeedback
            onPress={ev => {
              // Only close if press happens outside of the drawer
              if (ev.target === ev.currentTarget) {
                setDrawerOpen(false)
              }
            }}
            accessibilityLabel={_(msg`Close drawer menu`)}
            accessibilityHint="">
            <View
              style={[
                styles.drawerMask,
                {
                  backgroundColor: showDrawer
                    ? select(t.name, {
                        light: 'rgba(0, 57, 117, 0.1)',
                        dark: 'rgba(1, 82, 168, 0.1)',
                        dim: 'rgba(10, 13, 16, 0.8)',
                      })
                    : 'transparent',
                },
                a.transition_color,
              ]}>
              <View
                style={[
                  styles.drawerContainer,
                  showDrawer ? a.slide_in_left : a.slide_out_left,
                ]}>
                <DrawerContent />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </>
      )}
    </>
  )
}

export function Shell() {
  const t = useTheme()
  const aa = useAgeAssurance()
  const {currentAccount} = useSession()
  return (
    <View style={[a.util_screen_outer, t.atoms.bg]}>
      {currentAccount?.status === 'takendown' ? (
        <Takendown />
      ) : currentAccount?.status === 'deactivated' ? (
        <Deactivated />
      ) : (
        <>
          {aa.state.access === aa.Access.None ? (
            <NoAccessScreen />
          ) : (
            <RoutesContainer>
              <ShellInner />
            </RoutesContainer>
          )}

          <RedirectOverlay />
        </>
      )}

      <PassiveAnalytics />
    </View>
  )
}

const styles = StyleSheet.create({
  dmeLayer: {
    ...a.fixed,
    top: 0,
    bottom: 0,
  },
  drawerMask: {
    ...a.fixed,
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
  },
  drawerContainer: {
    display: 'flex',
    ...a.fixed,
    top: 0,
    left: 0,
    height: '100%',
    width: 330,
    maxWidth: '80%',
  },
})
