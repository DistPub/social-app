import React from 'react'
import {
  ActivityIndicator,
  type GestureResponderEvent,
  Pressable,
  type View,
} from 'react-native'
import {Image, type ImageLoadEventData} from 'expo-image'
import {type AppBskyEmbedExternal} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {type EmbedPlayerParams} from '#/lib/strings/embed-player'
import {useAutoplayDisabled, useExternalEmbedsPrefs} from '#/state/preferences'
import {atoms as a, useTheme} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import {EmbedConsentDialog} from '#/components/dialogs/EmbedConsent'
import {Fill} from '#/components/Fill'
import {PlayButtonIcon} from '#/components/video/PlayButtonIcon'
import {IS_IOS, IS_NATIVE, IS_WEB} from '#/env'

/**
 * Renders a GIF stored as an external embed. The static `link.thumb` is shown
 * first; the HD animation (`params.playerUri`, loaded straight from the GIF
 * host) replaces it once loaded.
 *
 * The frame sizes itself to the GIF's intrinsic aspect ratio (learned from the
 * loaded image's dimensions) so there are no letterbox bars — it reads like an
 * image, not a fixed-height player.
 *
 * Playback follows the autoplay preference, like videos do:
 * - autoplay enabled (default): the animation loads and plays as soon as the
 *   embed scrolls into view — no play button.
 * - autoplay disabled: only the static thumb is shown until the user taps.
 *
 * A tap also toggles play/pause once the animation is running.
 */
export function ExternalGif({
  link,
  params,
}: {
  link: AppBskyEmbedExternal.ViewExternal
  params: EmbedPlayerParams
}) {
  const t = useTheme()
  const externalEmbedsPrefs = useExternalEmbedsPrefs()
  const autoplayDisabled = useAutoplayDisabled()
  const {_} = useLingui()
  const consentDialogControl = useDialogControl()

  // Whether the user has consented to loading embeds from this source.
  const hasConsent = externalEmbedsPrefs?.[params.source] !== undefined

  // Tracking if the player has been activated (started loading the HD gif)
  const [isPlayerActive, setIsPlayerActive] = React.useState(false)
  // Tracking whether the gif has been loaded yet
  const [isPrefetched, setIsPrefetched] = React.useState(false)
  // Tracking whether the image is animating
  const [isAnimating, setIsAnimating] = React.useState(true)
  // Whether the embed is within (or near) the viewport
  const [isVisible, setIsVisible] = React.useState(false)
  // Intrinsic aspect ratio of the GIF, learned once an image frame loads.
  const [aspectRatio, setAspectRatio] = React.useState<number | undefined>(
    params.dimensions && params.dimensions.height > 0
      ? params.dimensions.width / params.dimensions.height
      : undefined,
  )

  // Used for controlling animation
  const imageRef = React.useRef<Image>(null)
  const containerRef = React.useRef<View>(null)

  const load = React.useCallback(() => {
    setIsPlayerActive(true)
    Image.prefetch(params.playerUri).then(() => {
      // Replace the image once it's fetched
      setIsPrefetched(true)
    })
  }, [params.playerUri])

  const onImageLoad = React.useCallback((event: ImageLoadEventData) => {
    const {width, height} = event.source
    if (width > 0 && height > 0) {
      setAspectRatio(width / height)
    }
  }, [])

  // Track viewport visibility so autoplay only kicks in for on-screen GIFs.
  React.useEffect(() => {
    const node = containerRef.current
    if (!(node instanceof HTMLElement)) {
      // Native: no IntersectionObserver, treat as always visible.
      setIsVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      {threshold: 0.1},
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Autoplay: once the GIF is on screen and consent has been granted, load and
  // play without requiring a tap. We skip this when autoplay is disabled, when
  // the user hasn't consented yet, and when the player is already active.
  React.useEffect(() => {
    if (autoplayDisabled) return
    if (!isVisible) return
    if (!hasConsent) return
    if (isPlayerActive) return
    load()
  }, [autoplayDisabled, isVisible, hasConsent, isPlayerActive, load])

  const onPlayPress = React.useCallback(
    (event: GestureResponderEvent) => {
      // Don't propagate on web
      event.preventDefault()

      // Show consent if this is the first load
      if (!hasConsent) {
        consentDialogControl.open()
        return
      }
      // If the player isn't active, we want to activate it and prefetch the gif
      if (!isPlayerActive) {
        load()
        return
      }
      // Control animation on native
      setIsAnimating(prev => {
        if (prev) {
          if (IS_NATIVE) {
            imageRef.current?.stopAnimating()
          }
          return false
        } else {
          if (IS_NATIVE) {
            imageRef.current?.startAnimating()
          }
          return true
        }
      })
    },
    [consentDialogControl, hasConsent, isPlayerActive, load],
  )

  // Show a play button only when the user has to tap to start (autoplay off or
  // no consent yet), or when the animation is paused.
  const showPlayButton =
    !isAnimating || (!isPlayerActive && (autoplayDisabled || !hasConsent))

  return (
    <>
      <EmbedConsentDialog
        control={consentDialogControl}
        source={params.source}
        onAccept={load}
      />

      <Pressable
        ref={containerRef}
        style={[
          a.w_full,
          a.overflow_hidden,
          // Size to the GIF's own aspect ratio; fall back to 16:9 until the
          // first frame reports its dimensions so there's no layout jump.
          {aspectRatio: aspectRatio ?? 16 / 9},
        ]}
        onPress={onPlayPress}
        accessibilityRole="button"
        accessibilityHint={_(msg`Plays the GIF`)}
        accessibilityLabel={_(msg`Play ${link.title}`)}>
        <Image
          source={{
            uri:
              !isPrefetched || (IS_WEB && !isAnimating)
                ? link.thumb
                : params.playerUri,
          }} // Web uses the thumb to control playback
          style={{flex: 1}}
          ref={imageRef}
          autoplay={isAnimating}
          contentFit="cover"
          onLoad={onImageLoad}
          accessibilityIgnoresInvertColors
          accessibilityLabel={link.title}
          accessibilityHint={link.title}
          cachePolicy={IS_IOS ? 'disk' : 'memory-disk'} // cant control playback with memory-disk on ios
        />

        {(!isPrefetched || !isAnimating) && (
          <Fill style={[a.align_center, a.justify_center]}>
            <Fill
              style={[
                t.name === 'light' ? t.atoms.bg_contrast_975 : t.atoms.bg,
                {
                  opacity: 0.3,
                },
              ]}
            />

            {showPlayButton ? (
              <PlayButtonIcon />
            ) : (
              <ActivityIndicator size="large" color="white" />
            )}
          </Fill>
        )}
      </Pressable>
    </>
  )
}
