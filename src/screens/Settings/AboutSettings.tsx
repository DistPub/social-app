import {useMemo} from 'react'
import {Platform} from 'react-native'
import {setStringAsync} from 'expo-clipboard'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {NativeStackScreenProps} from '@react-navigation/native-stack'
import {Statsig} from 'statsig-react-native-expo'

import {appVersion, BUNDLE_DATE, bundleInfo} from '#/lib/app-info'
import {STATUS_PAGE_URL} from '#/lib/constants'
import {CommonNavigatorParams} from '#/lib/routes/types'
import {useDevModeEnabled} from '#/state/preferences/dev-mode'
import * as Toast from '#/view/com/util/Toast'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {CodeLines_Stroke2_Corner2_Rounded as CodeLinesIcon} from '#/components/icons/CodeLines'
import {Globe_Stroke2_Corner0_Rounded as GlobeIcon} from '#/components/icons/Globe'
import {Newspaper_Stroke2_Corner2_Rounded as NewspaperIcon} from '#/components/icons/Newspaper'
import {Wrench_Stroke2_Corner2_Rounded as WrenchIcon} from '#/components/icons/Wrench'
import * as Layout from '#/components/Layout'
import {OTAInfo} from './components/OTAInfo'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AboutSettings'>
export function AboutSettingsScreen({}: Props) {
  const {_} = useLingui()
  const [devModeEnabled, setDevModeEnabled] = useDevModeEnabled()
  const stableID = useMemo(() => Statsig.getStableID(), [])

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>About</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.LinkItem
            to="https://bsky.social/about/support/tos"
            label={_(msg`Terms of Service`)}>
            <SettingsList.ItemIcon icon={NewspaperIcon} />
            <SettingsList.ItemText>
              <Trans>Terms of Service</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            to="https://bsky.social/about/support/privacy-policy"
            label={_(msg`Privacy Policy`)}>
            <SettingsList.ItemIcon icon={NewspaperIcon} />
            <SettingsList.ItemText>
              <Trans>Privacy Policy</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            to={STATUS_PAGE_URL}
            label={_(msg`Status Page`)}>
            <SettingsList.ItemIcon icon={GlobeIcon} />
            <SettingsList.ItemText>
              <Trans>Status Page</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.Divider />
          <SettingsList.LinkItem to="/sys/log" label={_(msg`System log`)}>
            <SettingsList.ItemIcon icon={CodeLinesIcon} />
            <SettingsList.ItemText>
              <Trans>System log</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.PressableItem
            label={_(msg`Version ${appVersion}`)}
            accessibilityHint={_(msg`Copies build version to clipboard`)}
            onLongPress={() => {
              const newDevModeEnabled = !devModeEnabled
              setDevModeEnabled(newDevModeEnabled)
              Toast.show(
                newDevModeEnabled
                  ? _(
                      msg({
                        message: 'Developer mode enabled',
                        context: 'toast',
                      }),
                    )
                  : _(
                      msg({
                        message: 'Developer mode disabled',
                        context: 'toast',
                      }),
                    ),
              )
            }}
            onPress={() => {
              setStringAsync(
                `Build version: ${appVersion}; Bundle info: ${bundleInfo}; Bundle date: ${BUNDLE_DATE}; Platform: ${Platform.OS}; Platform version: ${Platform.Version}; Anonymous ID: ${stableID}`,
              )
              Toast.show(_(msg`Copied build version to clipboard`))
            }}>
            <SettingsList.ItemIcon icon={WrenchIcon} />
            <SettingsList.ItemText>
              <Trans>Version {appVersion}</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeText>{bundleInfo}</SettingsList.BadgeText>
          </SettingsList.PressableItem>
          {devModeEnabled && <OTAInfo />}
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}
