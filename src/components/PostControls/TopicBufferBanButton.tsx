import {memo} from 'react'
import {type Insets} from 'react-native'
import {type AppBskyFeedDefs} from '@atproto/api'
import {useLingui} from '@lingui/react'
import type React from 'react'

import {useCleanError} from '#/lib/hooks/useCleanError'
import {type Shadow} from '#/state/cache/post-shadow'
import { useAgent } from '#/state/session'
import {CircleBanSign_Stroke2_Corner0_Rounded as CircleBanSignIcon} from '#/components/icons/CircleBanSign'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as toast from '#/components/Toast'
import {PostControlButton, PostControlButtonIcon} from './PostControlButton'

export const TopicBufferBanButton = memo(function TopicBufferBanButton({
  post,
  big,
  hitSlop,
  onShowLess,
  postFeedContext,
}: {
  post: Shadow<AppBskyFeedDefs.PostView>
  big?: boolean
  hitSlop?: Insets
  onShowLess?: any
  postFeedContext?: any
}): React.ReactNode {
  const {_} = useLingui()
  const agent = useAgent()
  const cleanError = useCleanError()

  const topicBufferBan = async () => {
    const report = {
      reasonType: 'com.atproto.moderation.defs#reasonOther',
      reason: 'command:topic-buffer-ban',
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: post.uri,
        cid: post.cid,
      },
    }
    try {
      await agent.createModerationReport(report, {
        encoding: 'application/json',
        headers: {
          'atproto-proxy': `did:web:cgv.hukoubook.com#atproto_labeler`,
        },
      })
      if (onShowLess) {
        onShowLess({
          item: post.uri,
          feedContext: postFeedContext,
        })
      }
      toast.show(
        <toast.Outer>
          <toast.Icon icon={TrashIcon} />
          <toast.Text>
            主题词屏蔽成功
          </toast.Text>
        </toast.Outer>,
      )
    } catch (e: any) {
      const {raw, clean} = cleanError(e)
      toast.show(clean || raw || e, {
        type: 'error',
      })
    }
  }

  const onHandlePress = async () => {
      await topicBufferBan()
  }

  return (
    <PostControlButton
      testID="postTopicBufferBanBtn"
      big={big}
      label={
        `主题词屏蔽`
      }
      onPress={onHandlePress}
      hitSlop={hitSlop}>
      <PostControlButtonIcon
        fill={undefined}
        icon={CircleBanSignIcon}
      />
    </PostControlButton>
  )
})
