import {useMemo} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'

import {cleanError} from '#/lib/strings/errors'
import {useResolveLinkQuery} from '#/state/queries/resolve-link'
import {ExternalEmbedRemoveBtn} from '#/view/com/composer/ExternalEmbedRemoveBtn'
import {atoms as a, useTheme} from '#/alf'
import {Loader} from '#/components/Loader'
import {ExternalEmbed} from '#/components/Post/Embed/ExternalEmbed'
import {ModeratedFeedEmbed} from '#/components/Post/Embed/FeedEmbed'
import {ModeratedListEmbed} from '#/components/Post/Embed/ListEmbed'
import {Embed as StarterPackEmbed} from '#/components/StarterPack/StarterPackCard'
import {Text} from '#/components/Typography'

export const ExternalEmbedLink = ({
  uri,
  hasQuote,
  onRemove,
}: {
  uri: string
  hasQuote: boolean
  onRemove: () => void
}) => {
  const t = useTheme()
  const {data, error} = useResolveLinkQuery(uri)
  const linkComponent = useMemo(() => {
    if (data) {
      if (data.type === 'external') {
        return (
          <ExternalEmbed
            link={{
              title: data.title || uri,
              uri,
              description: data.description,
              thumb: data.thumb?.source.path,
            }}
          />
        )
      } else if (data.kind === 'feed') {
        return (
          <ModeratedFeedEmbed
            embed={{
              type: 'feed',
              view: {
                $type: 'app.bsky.feed.defs#generatorView',
                ...data.view,
              },
            }}
          />
        )
      } else if (data.kind === 'list') {
        return (
          <ModeratedListEmbed
            embed={{
              type: 'list',
              view: {
                $type: 'app.bsky.graph.defs#listView',
                ...data.view,
              },
            }}
          />
        )
      } else if (data.kind === 'starter-pack') {
        return <StarterPackEmbed starterPack={data.view} />
      }
    }
  }, [data, uri])

  if (data?.type === 'record' && hasQuote) {
    // This is not currently supported by the data model so don't preview it.
    return null
  }

  return (
    <View style={[a.mb_xl, a.overflow_hidden, t.atoms.border_contrast_medium]}>
      {linkComponent ? (
        <View style={{pointerEvents: 'none'}}>{linkComponent}</View>
      ) : error ? (
        <Container style={[a.align_start, a.p_md, a.gap_xs]}>
          <Text numberOfLines={1} style={t.atoms.text_contrast_high}>
            {uri}
          </Text>
          <Text numberOfLines={2} style={[{color: t.palette.negative_400}]}>
            {cleanError(error)}
          </Text>
        </Container>
      ) : (
        <Container>
          <Loader size="xl" />
        </Container>
      )}
      <ExternalEmbedRemoveBtn onRemove={onRemove} />
    </View>
  )
}

function Container({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.rounded_sm,
        a.border,
        a.align_center,
        a.justify_center,
        a.py_5xl,
        t.atoms.bg_contrast_25,
        t.atoms.border_contrast_medium,
        style,
      ]}>
      {children}
    </View>
  )
}
