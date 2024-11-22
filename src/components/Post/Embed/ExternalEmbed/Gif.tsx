import React, {useEffect, useRef, useState} from 'react'
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {clamp} from '#/lib/numbers'
import {type EmbedPlayerParams} from '#/lib/strings/embed-player'
import {useAutoplayDisabled} from '#/state/preferences'
import {atoms as a, useTheme} from '#/alf'
import {Fill} from '#/components/Fill'
import {MediaInsetBorder} from '#/components/MediaInsetBorder'
import {GifView} from '../../../../../modules/expo-bluesky-gif-view'
import {type GifViewStateChangeEvent} from '../../../../../modules/expo-bluesky-gif-view/src/GifView.types'
import {GifPresentationControls} from '../VideoEmbed/GifPresentationControls'

export function GifEmbed({
  params,
  thumb,
  altText,
  isPreferredAltText,
  hideAlt,
  style = {width: '100%'},
}: {
  params: EmbedPlayerParams
  thumb: string | undefined
  altText: string
  isPreferredAltText: boolean
  hideAlt?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {_} = useLingui()
  const autoplayDisabled = useAutoplayDisabled()

  const playerRef = useRef<GifView>(null)

  const [playerState, setPlayerState] = useState<{
    isPlaying: boolean
    isLoaded: boolean
  }>({
    isPlaying: !autoplayDisabled,
    isLoaded: false,
  })

  const onPlayerStateChange = (e: GifViewStateChangeEvent) => {
    setPlayerState(e.nativeEvent)
  }

  const onPress = () => {
    void playerRef.current?.toggleAsync()
  }

  let aspectRatio = 1
  if (params.dimensions) {
    const ratio = params.dimensions.width / params.dimensions.height
    aspectRatio = clamp(ratio, 0.75, 4)
  }

  const [shown, setShown] = useState(false);
  const containerRef = useRef<any>(null)
  useEffect(() => {
    const node = containerRef.current;
    if (!(node instanceof HTMLElement)) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 当图片进入或离开视口时自动切换
        setShown(entry.isIntersecting);
      },
      { threshold: 0.1 } // 露出来 10% 执行
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  return (
    <View
      style={[
        a.rounded_md,
        a.overflow_hidden,
        {backgroundColor: t.palette.black},
        {aspectRatio},
        style,
      ]}>
      <View
        ref={containerRef}
        style={[
          a.absolute,
          /*
           * Aspect ratio was being clipped weirdly on web -esb
           */
          {
            top: -2,
            bottom: -2,
            left: -2,
            right: -2,
          },
        ]}>
        <MediaInsetBorder />
        <GifPresentationControls
          onPress={onPress}
          isPlaying={playerState.isPlaying}
          isLoading={!playerState.isLoaded}
          altText={!hideAlt && isPreferredAltText ? altText : undefined}
        />
        <GifView
          source={params.playerUri}
          placeholderSource={shown ? thumb : undefined}
          style={[a.flex_1]}
          autoplay={!autoplayDisabled}
          onPlayerStateChange={onPlayerStateChange}
          ref={playerRef}
          accessibilityHint={_(msg`Animated GIF`)}
          accessibilityLabel={altText}
        />
        {!playerState.isPlaying && (
          <Fill
            style={[
              t.name === 'light' ? t.atoms.bg_contrast_975 : t.atoms.bg,
              {
                opacity: 0.3,
              },
            ]}
          />
        )}
      </View>
    </View>
  )
}
