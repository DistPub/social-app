import {memo, useEffect, useMemo, useState} from 'react'
import {View} from 'react-native'
import {type AppBskyActorDefs, type AppBskyFeedPost} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {buildEmbedSnippet} from '#/lib/embed-snippet'
import {niceDate} from '#/lib/strings/time'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as ChevronBottomIcon,
  ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon,
} from '#/components/icons/Chevron'
import {CodeBrackets_Stroke2_Corner0_Rounded as CodeBracketsIcon} from '#/components/icons/CodeBrackets'
import {Text} from '#/components/Typography'

export type ColorModeValues = 'system' | 'light' | 'dark'

type EmbedDialogProps = {
  control: Dialog.DialogControlProps
  postAuthor: AppBskyActorDefs.ProfileViewBasic
  postCid: string
  postUri: string
  record: AppBskyFeedPost.Record
  timestamp: string
}

let EmbedDialog = ({control, ...rest}: EmbedDialogProps): React.ReactNode => {
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <EmbedDialogInner {...rest} />
    </Dialog.Outer>
  )
}
EmbedDialog = memo(EmbedDialog)
export {EmbedDialog}

function EmbedDialogInner({
  postAuthor,
  postCid,
  postUri,
  record,
  timestamp,
}: Omit<EmbedDialogProps, 'control'>) {
  const t = useTheme()
  const {_, i18n} = useLingui()
  const [copied, setCopied] = useState(false)
  const [showCustomisation, setShowCustomisation] = useState(false)
  const [colorMode, setColorMode] = useState<ColorModeValues>('system')

  // reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => {
        setCopied(false)
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [copied])

  const snippet = useMemo(() => {
    return buildEmbedSnippet({
      postAuthor,
      postCid,
      postUri,
      record,
      timestamp,
      colorMode,
      formattedTimestamp: niceDate(i18n, timestamp),
    })
  }, [i18n, postUri, postCid, record, timestamp, postAuthor, colorMode])

  return (
    <Dialog.Inner label={_(msg`Embed post`)} style={[{maxWidth: 500}]}>
      <View style={[a.gap_lg]}>
        <View style={[a.gap_sm]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Embed post</Trans>
          </Text>
          <Text
            style={[a.text_md, t.atoms.text_contrast_medium, a.leading_normal]}>
            <Trans>
              Embed this post in your website. Simply copy the following snippet
              and paste it into the HTML code of your website.
            </Trans>
          </Text>
        </View>
        <View
          style={[
            a.border,
            t.atoms.border_contrast_low,
            a.rounded_sm,
            a.overflow_hidden,
          ]}>
          <Button
            label={
              showCustomisation
                ? _(msg`Hide customization options`)
                : _(msg`Show customization options`)
            }
            color="secondary"
            variant="ghost"
            size="small"
            shape="default"
            onPress={() => setShowCustomisation(c => !c)}
            style={[
              a.justify_start,
              showCustomisation && t.atoms.bg_contrast_25,
            ]}>
            <ButtonIcon
              icon={showCustomisation ? ChevronBottomIcon : ChevronRightIcon}
            />
            <ButtonText>
              <Trans>Customization options</Trans>
            </ButtonText>
          </Button>

          {showCustomisation && (
            <View style={[a.gap_sm, a.p_md]}>
              <Text style={[t.atoms.text_contrast_medium, a.font_semi_bold]}>
                <Trans>Color theme</Trans>
              </Text>
              <SegmentedControl.Root
                label={_(msg`Color mode`)}
                type="radio"
                value={colorMode}
                onChange={setColorMode}>
                <SegmentedControl.Item value="system" label={_(msg`System`)}>
                  <SegmentedControl.ItemText>
                    <Trans>System</Trans>
                  </SegmentedControl.ItemText>
                </SegmentedControl.Item>
                <SegmentedControl.Item value="light" label={_(msg`Light`)}>
                  <SegmentedControl.ItemText>
                    <Trans>Light</Trans>
                  </SegmentedControl.ItemText>
                </SegmentedControl.Item>
                <SegmentedControl.Item value="dark" label={_(msg`Dark`)}>
                  <SegmentedControl.ItemText>
                    <Trans>Dark</Trans>
                  </SegmentedControl.ItemText>
                </SegmentedControl.Item>
              </SegmentedControl.Root>
            </View>
          )}
        </View>
        <View style={[a.flex_row, a.gap_sm]}>
          <View style={[a.flex_1]}>
            <TextField.Root>
              <TextField.Icon icon={CodeBracketsIcon} />
              <TextField.Input
                label={_(msg`Embed HTML code`)}
                editable={false}
                selection={{start: 0, end: snippet.length}}
                value={snippet}
              />
            </TextField.Root>
          </View>
          <Button
            label={_(msg`Copy code`)}
            color="primary"
            variant="solid"
            size="large"
            onPress={() => {
              navigator.clipboard.writeText(snippet)
              setCopied(true)
            }}>
            {copied ? (
              <>
                <ButtonIcon icon={CheckIcon} />
                <ButtonText>
                  <Trans>Copied!</Trans>
                </ButtonText>
              </>
            ) : (
              <ButtonText>
                <Trans>Copy code</Trans>
              </ButtonText>
            )}
          </Button>
        </View>
      </View>
      <Dialog.Close />
    </Dialog.Inner>
  )
}
