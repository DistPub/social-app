import {useRef} from 'react'
import {StyleSheet, View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {DME_EMBED_ORIGIN} from '#/lib/dme-embed/constants'
import {type DmeTokenPayload} from '#/lib/dme-embed/useDmeEmbedBridge'
import {useDmeEmbedBridge} from '#/lib/dme-embed/useDmeEmbedBridge'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

export type DmeEmbedProps = {
  /**
   * Returns the current session token for the embed, or null while no session
   * exists. Supplied by the consumer (task 6's token provider hook) — this
   * component never touches `useSession`/`useAgent` itself.
   */
  getToken: () => DmeTokenPayload | null
  /**
   * Invoked by the bridge when the embed rejects the delivered credentials
   * (DME_SESSION_INVALID), e.g. to force a re-login.
   */
  onSessionInvalid: () => void
  /**
   * Invoked once the embed has sent DME_READY and a token has been delivered.
   * The consumer can use this to send initial post-handshake state (e.g. the
   * current chat-active visibility) without racing the iframe startup.
   */
  onReady?: () => void
  /**
   * See `UseDmeEmbedBridgeOptions.onNavigate`. Wired through from the consumer
   * (shell); the bridge pre-validates the path before calling this.
   */
  onNavigate: (path: string) => void
  /**
   * See `UseDmeEmbedBridgeOptions.onOpenExternalUrl`. Wired through from the
   * consumer (shell); the bridge pre-validates the url before calling this.
   */
  onOpenExternalUrl: (url: string) => void
}

/**
 * Full-viewport embed of the DME chat app (web only).
 *
 * Renders the DME iframe once the bridge reports it alive and authenticated,
 * a loader while the handshake is in flight, and a fallback panel with an
 * escape hatch (open dme in a new tab) when the embed is unavailable or has
 * degraded. The frame is deliberately left un-isolated from its own storage:
 * any attribute of the kind that would block the dme's
 * localStorage/IndexedDB session persistence is omitted. The `allow` list
 * covers exactly three permissions the embed needs: `clipboard-write` for the
 * message copy button, `fullscreen` for the in-iframe video viewer, and
 * `autoplay` for message sounds and the muted video-preview autoplay.
 */
export function DmeEmbed({
  getToken,
  onSessionInvalid,
  onReady,
  onNavigate,
  onOpenExternalUrl,
}: DmeEmbedProps) {
  const {_} = useLingui()
  const t = useTheme()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const bridge = useDmeEmbedBridge({
    iframeRef,
    getToken,
    onSessionInvalid,
    onNavigate,
    onOpenExternalUrl,
  })

  // Notify the consumer once the handshake has completed and the embed is
  // authenticated. This is the right time to push one-way visibility state
  // such as DME_CHAT_ACTIVE.
  const wasReadyRef = useRef(false)
  if (bridge.status === 'ready' && !wasReadyRef.current) {
    wasReadyRef.current = true
    onReady?.()
  }

  // The iframe must be in the tree from the FIRST commit: the handshake is
  // driven BY the iframe (it sends DME_READY, and its `load` event starts the
  // READY watchdog). Gating the frame on `status === 'ready'` would deadlock —
  // `ready` can only be reached through a frame that is already mounted. The
  // frame is therefore unmounted ONLY in the terminal failure states.
  const showIframe =
    bridge.status !== 'unavailable' && bridge.status !== 'degraded'
  const showLoader = bridge.status === 'waiting'

  return (
    <View style={[a.flex_1, a.overflow_hidden]}>
      {showIframe && (
        <iframe
          ref={iframeRef}
          src={`${DME_EMBED_ORIGIN}/?goto=ChatList`}
          onLoad={bridge.onIframeLoad}
          title={_(msg({message: 'DME Chat'}))}
          allow="clipboard-write; fullscreen; autoplay"
          style={{flex: 1, width: '100%', border: 'none'}}
        />
      )}

      {showLoader && (
        <View
          style={[
            a.flex_1,
            a.justify_center,
            a.align_center,
            // Overlay the freshly-mounted frame: it is still handshaking, so
            // covering it prevents a flash of the embed's own loading state.
            styles.loaderOverlay,
          ]}>
          <Loader size="lg" />
        </View>
      )}

      {!showIframe && (
        <View style={[a.flex_1, a.justify_center, a.align_center, a.p_lg]}>
          <Text style={[a.text_center, a.text_lg, t.atoms.text_contrast_high]}>
            <Trans>Chat is unavailable right now.</Trans>
          </Text>
          <Text style={[a.text_center, t.atoms.text_contrast_low]}>
            <Trans>Try again, or open DME in a new tab.</Trans>
          </Text>
          <Button
            variant="solid"
            color="primary"
            size="small"
            label={_(msg({message: 'Open DME in new tab'}))}
            style={[a.mt_md]}
            onPress={() => {
              window.open(DME_EMBED_ORIGIN, '_blank', 'noopener,noreferrer')
            }}>
            <ButtonText>
              <Trans>Open DME in new tab</Trans>
            </ButtonText>
          </Button>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // The loader covers the frame while the handshake is in flight; the frame
  // underneath is already mounted so it can send DME_READY.
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
})
