import {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {type TextInput, View} from 'react-native'
import {useWindowDimensions} from 'react-native'
import {Image} from 'expo-image'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {cleanError} from '#/lib/strings/errors'
import {
  type GiphyGif,
  useGifSearchQuery,
  useTrendingGifsQuery,
} from '#/state/queries/giphy'
import {ErrorScreen} from '#/view/com/util/error/ErrorScreen'
import {ErrorBoundary} from '#/view/com/util/ErrorBoundary'
import {type ListMethods} from '#/view/com/util/List'
import {atoms as a, ios, native, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {useThrottledValue} from '#/components/hooks/useThrottledValue'
import {ArrowLeft_Stroke2_Corner0_Rounded as Arrow} from '#/components/icons/Arrow'
import {MagnifyingGlass_Stroke2_Corner0_Rounded as Search} from '#/components/icons/MagnifyingGlass'
import {ListFooter, ListMaybePlaceholder} from '#/components/Lists'
import {Loader} from '#/components/Loader'
import {useAnalytics} from '#/analytics'
import {IS_WEB} from '#/env'

/**
 * A selected GIF. We only download the low-res `preview_webp` as a blob and use
 * it as the external embed's thumbnail. The post keeps the Giphy page URI, and
 * the renderer derives the full-quality animated WebP from `gifId` at display
 * time — so we never upload the (large) HD WebP as a static blob.
 */
export type SelectedGif = {
  /** Low-res animated WebP preview, uploaded later as the external thumb. */
  blob: Blob
  width: number
  height: number
  alt: string
  /** Giphy id — used to build the page URI and derive the HD WebP at render. */
  gifId: string
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

export function GifSelectDialog({
  controlRef,
  onClose,
  onSelectGif: onSelectGifProp,
}: {
  controlRef: React.RefObject<{open: () => void} | null>
  onClose?: () => void
  /** Called with the downloaded WebP blob once the user picks a GIF. */
  onSelectGif: (gif: SelectedGif) => void
}) {
  const control = Dialog.useDialogControl()

  useImperativeHandle(controlRef, () => ({
    open: () => control.open(),
  }))

  const onSelectGif = useCallback(
    (gif: SelectedGif) => {
      control.close(() => onSelectGifProp(gif))
    },
    [control, onSelectGifProp],
  )

  const renderErrorBoundary = useCallback(
    (error: any) => <DialogError details={String(error)} />,
    [],
  )

  return (
    <Dialog.Outer
      control={control}
      onClose={onClose}
      nativeOptions={{
        bottomInset: 0,
        // use system corner radius on iOS
        ...ios({cornerRadius: undefined}),
      }}>
      <Dialog.Handle />
      <ErrorBoundary renderError={renderErrorBoundary}>
        <GifList control={control} onSelectGif={onSelectGif} />
      </ErrorBoundary>
    </Dialog.Outer>
  )
}

function GifList({
  control,
  onSelectGif,
}: {
  control: Dialog.DialogControlProps
  onSelectGif: (gif: SelectedGif) => void
}) {
  const {_} = useLingui()
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const textInputRef = useRef<TextInput>(null)
  const listRef = useRef<ListMethods>(null)
  const [undeferredSearch, setSearch] = useState('')
  const search = useThrottledValue(undeferredSearch, 500)
  const {height} = useWindowDimensions()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const isSearching = search.length > 0

  const trendingQuery = useTrendingGifsQuery()
  const searchQuery = useGifSearchQuery(search)

  const {
    data,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
    error,
    isPending,
    isError,
    refetch,
  } = isSearching ? searchQuery : trendingQuery

  const flattenedData = useMemo(() => {
    return data?.pages.flatMap(page => page.results) || []
  }, [data])

  const handleSelect = useCallback(
    async (gif: GiphyGif) => {
      try {
        setLoadingId(gif.id)
        const blob = await fetchBlob(gif.previewUrl)
        if (!blob) throw new Error('Failed to download GIF preview')
        onSelectGif({
          blob,
          width: gif.width,
          height: gif.height,
          alt: gif.title,
          gifId: gif.id,
        })
      } catch {
        setLoadingId(null)
      }
    },
    [onSelectGif],
  )

  const renderItem = useCallback(
    ({item}: {item: GiphyGif}) => {
      return (
        <GifPreview
          gif={item}
          loading={loadingId === item.id}
          onSelectGif={handleSelect}
        />
      )
    },
    [handleSelect, loadingId],
  )

  const onEndReached = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage || error) return
    fetchNextPage()
  }, [isFetchingNextPage, hasNextPage, error, fetchNextPage])

  const hasData = flattenedData.length > 0

  const onGoBack = useCallback(() => {
    if (isSearching) {
      // clear the input and reset the state
      textInputRef.current?.clear()
      setSearch('')
    } else {
      control.close()
    }
  }, [control, isSearching])

  const listHeader = useMemo(() => {
    return (
      <View
        style={[
          native(a.pt_4xl),
          a.relative,
          a.mb_lg,
          a.flex_row,
          a.align_center,
          !gtMobile && web(a.gap_md),
          a.pb_sm,
          t.atoms.bg,
        ]}>
        {!gtMobile && IS_WEB && (
          <Button
            size="small"
            variant="ghost"
            color="secondary"
            shape="round"
            onPress={() => control.close()}
            label={_(msg`Close GIF dialog`)}>
            <ButtonIcon icon={Arrow} size="md" />
          </Button>
        )}

        <TextField.Root style={[!gtMobile && IS_WEB && a.flex_1]}>
          <TextField.Icon icon={Search} />
          <TextField.Input
            label={_(msg`Search GIFs`)}
            placeholder={_(msg`Search GIFs`)}
            onChangeText={text => {
              setSearch(text)
              listRef.current?.scrollToOffset({offset: 0, animated: false})
            }}
            returnKeyType="search"
            clearButtonMode="while-editing"
            inputRef={textInputRef}
            maxLength={50}
            onKeyPress={({nativeEvent}) => {
              if (nativeEvent.key === 'Escape') {
                control.close()
              }
            }}
          />
        </TextField.Root>
      </View>
    )
  }, [gtMobile, t.atoms.bg, _, control])

  return (
    <>
      {gtMobile && <Dialog.Close />}
      <Dialog.InnerFlatList
        ref={listRef}
        key={gtMobile ? '3 cols' : '2 cols'}
        data={flattenedData}
        renderItem={renderItem}
        numColumns={gtMobile ? 3 : 2}
        columnWrapperStyle={[a.gap_sm]}
        contentContainerStyle={[native([a.px_xl, {minHeight: height}])]}
        webInnerStyle={[web({minHeight: '80vh'})]}
        webInnerContentContainerStyle={[web(a.pb_0)]}
        ListHeaderComponent={
          <>
            {listHeader}
            {!hasData && (
              <ListMaybePlaceholder
                isLoading={isPending}
                isError={isError}
                onRetry={refetch}
                onGoBack={onGoBack}
                emptyType="results"
                sideBorders={false}
                topBorder={false}
                errorTitle={_(msg`Failed to load GIFs`)}
                errorMessage={_(msg`There was an issue connecting to Giphy.`)}
                emptyMessage={
                  isSearching
                    ? _(msg`No search results found for "${search}".`)
                    : _(
                        msg`No featured GIFs found. There may be an issue with Giphy.`,
                      )
                }
              />
            )}
          </>
        }
        stickyHeaderIndices={[0]}
        onEndReached={onEndReached}
        onEndReachedThreshold={4}
        keyExtractor={(item: GiphyGif) => item.id}
        keyboardDismissMode="on-drag"
        ListFooterComponent={
          hasData ? (
            <ListFooter
              isFetchingNextPage={isFetchingNextPage}
              error={cleanError(error)}
              onRetry={fetchNextPage}
              style={{borderTopWidth: 0}}
            />
          ) : null
        }
      />
    </>
  )
}

function DialogError({details}: {details?: string}) {
  const {_} = useLingui()
  const control = Dialog.useDialogContext()

  return (
    <Dialog.ScrollableInner
      style={a.gap_md}
      label={_(msg`An error has occurred`)}>
      <Dialog.Close />
      <ErrorScreen
        title={_(msg`Oh no!`)}
        message={_(
          msg`There was an unexpected issue in the application. Please let us know if this happened to you!`,
        )}
        details={details}
      />
      <Button
        label={_(msg`Close dialog`)}
        onPress={() => control.close()}
        color="primary"
        size="large"
        variant="solid">
        <ButtonText>
          <Trans>Close</Trans>
        </ButtonText>
      </Button>
    </Dialog.ScrollableInner>
  )
}

export function GifPreview({
  gif,
  loading,
  onSelectGif,
}: {
  gif: GiphyGif
  loading?: boolean
  onSelectGif: (gif: GiphyGif) => void
}) {
  const ax = useAnalytics()
  const {gtTablet} = useBreakpoints()
  const {_} = useLingui()
  const t = useTheme()

  const onPress = useCallback(() => {
    ax.metric('composer:gif:select', {})
    onSelectGif(gif)
  }, [ax, onSelectGif, gif])

  return (
    <Button
      label={_(msg`Select GIF "${gif.title}"`)}
      style={[a.flex_1, gtTablet ? {maxWidth: '33%'} : {maxWidth: '50%'}]}
      onPress={onPress}
      disabled={loading}>
      {({pressed}) => (
        <View
          style={[
            a.flex_1,
            a.mb_sm,
            a.rounded_sm,
            a.aspect_square,
            a.overflow_hidden,
            a.justify_center,
            a.align_center,
            {opacity: pressed || loading ? 0.6 : 1},
            t.atoms.bg_contrast_25,
          ]}>
          <Image
            style={[a.flex_1, a.w_full]}
            source={{uri: gif.previewUrl}}
            contentFit="cover"
            accessibilityLabel={gif.title}
            accessibilityHint=""
            autoplay={true}
            cachePolicy="none"
            accessibilityIgnoresInvertColors
          />
          {loading ? (
            <View
              style={[a.absolute, a.inset_0, a.justify_center, a.align_center]}>
              <Loader size="lg" />
            </View>
          ) : null}
        </View>
      )}
    </Button>
  )
}
