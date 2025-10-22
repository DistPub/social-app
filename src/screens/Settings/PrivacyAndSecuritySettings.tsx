import {View} from 'react-native'
import {type AppBskyNotificationDeclaration} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useNotificationDeclarationQuery} from '#/state/queries/activity-subscriptions'
import {useAppPasswordsQuery} from '#/state/queries/app-passwords'
import {useSession} from '#/state/session'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {BellRinging_Stroke2_Corner0_Rounded as BellRingingIcon} from '#/components/icons/BellRinging'
import {EyeSlash_Stroke2_Corner0_Rounded as EyeSlashIcon} from '#/components/icons/EyeSlash'
import {Key_Stroke2_Corner2_Rounded as KeyIcon} from '#/components/icons/Key'
import {ShieldCheck_Stroke2_Corner0_Rounded as ShieldIcon} from '#/components/icons/Shield'
import * as Layout from '#/components/Layout'
import {InlineLinkText} from '#/components/Link'
import {Email2FAToggle} from './components/Email2FAToggle'
import {PwiOptOut} from './components/PwiOptOut'
import {ItemTextWithSubtitle} from './NotificationSettings/components/ItemTextWithSubtitle'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'PrivacyAndSecuritySettings'
>
export function PrivacyAndSecuritySettingsScreen({}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const {data: appPasswords} = useAppPasswordsQuery()
  const {currentAccount} = useSession()
  const {
    data: notificationDeclaration,
    isPending,
    isError,
  } = useNotificationDeclarationQuery()

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Privacy and Security</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Item>
            <SettingsList.ItemIcon
              icon={ShieldIcon}
              color={
                currentAccount?.emailAuthFactor
                  ? t.palette.primary_500
                  : undefined
              }
            />
            <SettingsList.ItemText>
              {currentAccount?.emailAuthFactor ? (
                <Trans>Email 2FA enabled</Trans>
              ) : (
                <Trans>Two-factor authentication (2FA)</Trans>
              )}
            </SettingsList.ItemText>
            <Email2FAToggle />
          </SettingsList.Item>
          <SettingsList.LinkItem
            to="/settings/app-passwords"
            label={_(msg`App passwords`)}>
            <SettingsList.ItemIcon icon={KeyIcon} />
            <SettingsList.ItemText>
              <Trans>App passwords</Trans>
            </SettingsList.ItemText>
            {appPasswords && appPasswords.length > 0 && (
              <SettingsList.BadgeText>
                {appPasswords.length}
              </SettingsList.BadgeText>
            )}
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            label={_(
              msg`Settings for allowing others to be notified of your posts`,
            )}
            to={{screen: 'ActivityPrivacySettings'}}
            contentContainerStyle={[a.align_start]}>
            <SettingsList.ItemIcon icon={BellRingingIcon} />
            <ItemTextWithSubtitle
              titleText={
                <Trans>Allow others to be notified of your posts</Trans>
              }
              subtitleText={
                <NotificationDeclaration
                  data={notificationDeclaration}
                  isError={isError}
                />
              }
              showSkeleton={isPending}
            />
          </SettingsList.LinkItem>
          <SettingsList.Divider />
          <SettingsList.Group>
            <SettingsList.ItemIcon icon={EyeSlashIcon} />
            <SettingsList.ItemText>
              <Trans>Logged-out visibility</Trans>
            </SettingsList.ItemText>
            <PwiOptOut />
          </SettingsList.Group>
          <SettingsList.Item>
            <Admonition.Outer type="tip" style={[a.flex_1]}>
              <Admonition.Row>
                <Admonition.Icon />
                <View style={[a.flex_1, a.gap_sm]}>
                  <Admonition.Text>
                    <Trans>
                      Note: Bluesky is an open and public network. This setting
                      only limits the visibility of your content on the Bluesky
                      app and website, and other apps may not respect this
                      setting. Your content may still be shown to logged-out
                      users by other apps and websites.
                    </Trans>
                  </Admonition.Text>
                  <Admonition.Text>
                    <InlineLinkText
                      label={_(
                        msg`Learn more about what is public on Bluesky.`,
                      )}
                      to="https://blueskyweb.zendesk.com/hc/en-us/articles/15835264007693-Data-Privacy">
                      <Trans>Learn more about what is public on Bluesky.</Trans>
                    </InlineLinkText>
                  </Admonition.Text>
                </View>
              </Admonition.Row>
            </Admonition.Outer>
          </SettingsList.Item>
          <SettingsList.Divider />
          <SettingsList.Item>
            <Admonition.Outer type="tip" style={[a.flex_1]}>
              <Admonition.Row>
                <Admonition.Icon />
                <View style={[a.flex_1, a.gap_sm]}>
                  <Admonition.Text>
                    注意你正在使用的app非官方应用，这里是fatesky，
                    正是如上所说的第三方应用（我们的确不会遵守未登录用户可见性设置）。
                  </Admonition.Text>
                  <Admonition.Text>
                    fatesky专注于打造实时的去中心化app，你所看到的帖子都是在AT去中心化网络中实时抓取的，
                    所以你可以获取到修正之后的最新帖子（如果用户确实修改过帖子）。
                  </Admonition.Text>
                  <Admonition.Text>
                    不仅如此，fatesky的平台政策与bluesky有很大差别，
                    只要AT去中心化网络中的PDS允许访问，
                    你就能查看到任何帖子，
                    在传输过程中fatesky不会有任何中间审查措施。
                    fatesky遵循在AT去中心化网络中进行审查的最佳实践，只通过标签机对帖子进行客户端审查。
                  </Admonition.Text>
                  <Admonition.Text>
                    你需要特别注意的是，
                    fatesky针对用户维护的block列表的处理方式与bluesky有根本性不同。
                  </Admonition.Text>
                  <Admonition.Text>
                    bluesky的处理逻辑是为用户全平台屏蔽block列表中的目标用户，
                    同时为目标用户全平台屏蔽block列表的创建者。
                  </Admonition.Text>
                  <Admonition.Text>
                    fatesky的处理逻辑是为用户在浏览Following动态源时屏蔽block列表中的目标用户，
                    同时为目标用户在浏览Following动态源时屏蔽block列表的创建者。
                    最后为用户在通知系统中屏蔽block列表中的目标用户消息。
                    其他场景（如浏览中国好声音动态源）不会有任何屏蔽措施。
                  </Admonition.Text>
                  <Admonition.Text>
                    fatesky之所以将block列表的作用范围限制在小范围，
                    是因为block动作本身就是用户个人行为，不应该对目标用户造成大范围影响，
                    另一个重要原因是，在AT去中心化网络中，所有帖子都是公开的，
                    如果施行全平台屏蔽，这本身就是掩耳盗铃的，是对用户不负责任的欺骗。
                  </Admonition.Text>
                  <Admonition.Text>
                    那fatesky有没有合理的，能为用户提供全平台屏蔽block列表中目标用户的措施呢？
                    有的，用户可以通过标签机进行客户端审查，这也是在AT去中心化网络中进行审查的最佳实践。
                  </Admonition.Text>
                  <Admonition.Text>
                    设想有一个标签机构建平台，用户可以无须编程构建并关注自己的标签机。
                    当用户将目标用户加入block列表时，标签机将产生一个hide标签。
                    只要用户将标签机的hide标签渲染逻辑配置为隐藏，
                    目标用户所有的帖子在客户端渲染时就都会被隐藏。
                  </Admonition.Text>
                  <Admonition.Text>
                    fatesky将与你一同期待这样的标签机构建平台出现。
                  </Admonition.Text>
                </View>
              </Admonition.Row>
            </Admonition.Outer>
          </SettingsList.Item>
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

function NotificationDeclaration({
  data,
  isError,
}: {
  data?: {
    value: AppBskyNotificationDeclaration.Record
  }
  isError?: boolean
}) {
  if (isError) {
    return <Trans>Error loading preference</Trans>
  }
  switch (data?.value?.allowSubscriptions) {
    case 'mutuals':
      return <Trans>Only followers who I follow</Trans>
    case 'none':
      return <Trans>No one</Trans>
    case 'followers':
    default:
      return <Trans>Anyone who follows me</Trans>
  }
}
