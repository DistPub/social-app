import {View} from 'react-native'
import {useLingui} from '@lingui/react'

import {usePreferencesQuery} from '#/state/queries/preferences'
import {useAgent} from '#/state/session'
import {useShortcutTopicBufferBan} from '#/state/session/agent-config'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useGutters} from '#/alf'
import {Admonition} from '#/components/Admonition'
import * as Toggle from '#/components/forms/Toggle'
import {CircleCheck_Stroke2_Corner0_Rounded as CircleCheck} from '#/components/icons/CircleCheck'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'

export function Screen() {
  const {_} = useLingui()
  const gutters = useGutters(['base'])
  const {data: preferences} = usePreferencesQuery()

  return (
    <Layout.Screen testID="ModerationShortcutTopicBufferBanSettings">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            中国好声音主题词屏蔽快捷方式
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Item>
            <Admonition type="tip" style={[a.flex_1]}>
                快捷方式只对中国好声音管理员有效
            </Admonition>
          </SettingsList.Item>
          {preferences ? (
            <Inner/>
          ) : (
            <View style={[gutters, a.justify_center, a.align_center]}>
              <Loader size="xl" />
            </View>
          )}
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

function Inner() {
  const {_} = useLingui()
  const agent = useAgent()
  const [showShortcut, setShowShortcut, done] = useShortcutTopicBufferBan(agent.did as string);

  return (
    <Toggle.Item
      type="checkbox"
      name="显示中国好声音主题词屏蔽快捷方式"
      label={`显示中国好声音主题词屏蔽快捷方式`}
      value={showShortcut}
      disabled={!done}
      onChange={value => setShowShortcut(value)}>
      <SettingsList.Item>
        <SettingsList.ItemIcon icon={CircleCheck} />
        <SettingsList.ItemText>
          显示中国好声音主题词屏蔽快捷方式
        </SettingsList.ItemText>
        <Toggle.Platform />
      </SettingsList.Item>
    </Toggle.Item>
  )
}
