import React from 'react'
import {StyleSheet, TextProps} from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  Path,
  PathProps,
  Stop,
  SvgProps,
} from 'react-native-svg'
import {Image} from 'expo-image'

import {colors} from '#/lib/styles'
import {useKawaiiMode} from '#/state/preferences/kawaii'

const ratio = 57 / 64

type Props = {
  fill?: PathProps['fill']
  style?: TextProps['style']
} & Omit<SvgProps, 'style'>

export const Logo = React.forwardRef(function LogoImpl(props: Props, ref) {
  const {fill, ...rest} = props
  const gradient = fill === 'sky'
  const styles = StyleSheet.flatten(props.style)
  const _fill = gradient ? 'url(#sky)' : fill || styles?.color || colors.blue3
  // @ts-ignore it's fiiiiine
  const size = parseInt(rest.width || 32)

  const isKawaii = useKawaiiMode()

  if (isKawaii) {
    return (
      <Image
        source={
          size > 100
            ? require('../../../assets/kawaii.png')
            : require('../../../assets/kawaii_smol.png')
        }
        accessibilityLabel="Bluesky"
        accessibilityHint=""
        accessibilityIgnoresInvertColors
        style={[{height: size, aspectRatio: 1.4}]}
      />
    )
  }

  return (
    <Svg
      fill="none"
      // @ts-ignore it's fiiiiine
      ref={ref}
      viewBox="0 0 64 57"
      {...rest}
      style={[{width: size, height: size * ratio}, styles]}>

        <path d="M15.565 55.275c0 -2.15 3.005 -9.745 3.005 -9.745 2.895 -0.895 23.8 -0.135 26.985 -0.135 0 0 2.88 6.165 2.88 9.88S39.595 62 32.03 62s-16.465 -3.01 -16.465 -6.725" fill="#8b5738"/>
          <path cx="64.06" cy="93.5" rx="27.05" ry="11.75" fill="#ffb17a" d="M45.555 46.75A13.525 5.875 0 0 1 32.03 52.625A13.525 5.875 0 0 1 18.505 46.75A13.525 5.875 0 0 1 45.555 46.75z"/>
          <g>
            <path d="M19.335 53.075c1.51 0.86 3.9 0.795 5.755 1.13 2.36 0.43 3.695 2.23 8.245 2.15 1.625 -0.03 5.415 -0.215 5.205 -0.21 -0.13 -0.265 -0.87 -0.52 -2.31 -0.745 -1.32 -0.21 -2.27 -0.19 -3.8 -0.19 -1.17 0 -2.775 -0.35 -4.395 -1.24 -0.74 -0.405 -1.89 -0.855 -3.015 -1.085 -1.73 -0.355 -2.935 0.02 -5.35 -1.125 -1.155 -0.545 -2.09 -1.675 -2.31 -2.99l-0.57 1.64c0.75 1.375 1.435 2.035 2.545 2.665" fill="#cc8552"/>
            <path d="M44.22 51.73c-3.87 2.46 -7.14 2.185 -7.14 2.185 -0.275 0.18 1.98 0.665 3.655 0.385 3.29 -0.55 5.29 -2.2 6.59 -4.41 -0.18 -0.56 -0.575 -1.62 -0.575 -1.62 -0.375 0.905 -0.81 2.365 -2.53 3.46" fill="#cc8552"/>
            <path d="M37.255 58.71c-2.14 0.39 -4.19 -0.275 -6.295 -0.77 -2.885 -0.675 -8.305 -0.58 -8.305 -0.58 -0.325 0.16 2.555 1.205 3.955 1.325 1.275 0.11 2.625 0 3.835 0.495 1.705 0.695 3.355 1.045 5.005 1.045 3.135 0 7.23 -1.89 8.205 -4.345 0 0 -1.79 1.05 -3.18 1.755 -1.01 0.515 -2.1 0.875 -3.22 1.075" fill="#a86d44"/>
            <path d="M17.91 55.74c0.425 0.68 0.86 1.31 1.43 1.875 0.965 0.96 2.185 1.515 2.97 1.375 0 0 -2.78 -2.245 -2.485 -2.83 0.15 -0.3 5.92 0.175 5.92 0.175s-1.75 -0.92 -3.455 -1.25c-1.105 -0.215 -3.125 0.215 -4.965 -1.08 -1.015 -0.715 -1.17 -1.575 -1.17 -1.575s-0.365 1.245 -0.44 1.72c1.065 1.115 2.055 1.365 2.195 1.59" fill="#a86d44"/>
            <path d="M47.15 53.27c-1.01 0.905 -2.605 2.735 -2.605 3.68 0 0 1.79 -1.735 2.995 -2.53 0.3 -0.195 0.515 -0.445 0.75 -0.71 0 0 -0.12 -0.895 -0.31 -1.53 -0.075 0.425 -0.38 0.69 -0.83 1.09" fill="#a86d44"/>
          </g>
          <g>
            <radialGradient id="IconifyId17ecdb2904d178eab7492" cx="77.121" cy="66.694" r="76.184" gradientTransform="rotate(-3.714 -608.323 2.714)" gradientUnits="userSpaceOnUse">
              <stop offset=".104" stopColor="#ce93d8"/>
              <stop offset="1" stopColor="#ab47bc"/>
            </radialGradient>
            <path cx="64" cy="52.76" r="48.76" fill="url(#IconifyId17ecdb2904d178eab7492)" d="M56.38 26.38A24.38 24.38 0 0 1 32 50.76A24.38 24.38 0 0 1 7.62 26.38A24.38 24.38 0 0 1 56.38 26.38z"/>
            <radialGradient id="IconifyId17ecdb2904d178eab7493" cx="53.349" cy="46.135" r="69.389" gradientUnits="userSpaceOnUse">
              <stop offset=".28" stopColor="#81d4fa" stopOpacity="0"/>
              <stop offset=".964" stopColor="#81d4fa" stopOpacity=".9"/>
            </radialGradient>
            <path cx="64" cy="52.76" r="48.76" fill="url(#IconifyId17ecdb2904d178eab7493)" d="M56.38 26.38A24.38 24.38 0 0 1 32 50.76A24.38 24.38 0 0 1 7.62 26.38A24.38 24.38 0 0 1 56.38 26.38z"/>
            <path id="IconifyId17ecdb2904d178eab7494" gradientUnits="userSpaceOnUse" x1="74.69" y1="10.651" x2="35.942" y2="111.007" d="">
              <stop offset="0" stopColor="#673ab7"/>
              <stop offset=".937" stopColor="#673ab7" stopOpacity="0"/>
            </path>
            <path d="M22.955 11.185c2.27 0.195 6.92 1.895 3.535 6.255C24.265 20.305 21.485 22.97 20.5 25.275c-2.845 6.665 4.285 9.385 6.5 10.08 1.92 0.605 5.62 1.955 6.66 3.68C37.675 45.685 25.465 47.5 25.465 47.5s8.985 3.275 16.385 -1.73c2.8 -1.895 5.265 -6.305 2.855 -10.275 -1.17 -1.925 -4.395 -3.66 -5.185 -4.28 -3.38 -2.67 -5.465 -5.43 -3.785 -8.525 0.68 -1.25 2.1 -1.9 3.475 -2.28 3.85 -1.065 8.655 -0.875 9.91 -5.63C50.205 10.68 42.285 1.52 30 3.01c-5.1 0.615 -9.69 2.75 -13.445 6.26 -6.93 6.485 -6.33 11.85 -6.33 11.85s4.515 -10.65 12.73 -9.935" opacity=".7" fill="url(#IconifyId17ecdb2904d178eab7494)"/>
            <path id="IconifyId17ecdb2904d178eab7495" gradientUnits="userSpaceOnUse" x1="80.878" y1="24.934" x2="80.878" y2="108.077" d="">
              <stop offset=".235" stopColor="#1d44b3"/>
              <stop offset=".884" stopColor="#2044b3" stopOpacity=".074"/>
              <stop offset=".936" stopColor="#2144b3" stopOpacity="0"/>
            </path>
            <path d="M49.885 12.11c-1.74 -2.53 -4.145 -4.54 -6.68 -6.275 -4.045 -2.765 -9.275 -2.99 -9.275 -2.99 6.42 3.07 5.7 7.14 3.605 10.05 -2.55 3.545 -7.665 5.94 -9 10.255 -0.78 2.52 -0.3 5.17 2.155 6.78s11.29 5.885 11.595 10.945c0.23 3.81 -2.8 6.21 -2.8 6.21 3.545 -0.765 11.005 -5.985 8.795 -11.355 -1.07 -2.6 -5.935 -4.325 -3.485 -7.29 0.91 -1.105 7.265 -1.695 7.86 -8.125 0.275 -3.005 -1.345 -6.135 -2.77 -8.205" opacity=".39" fill="url(#IconifyId17ecdb2904d178eab7495)"/>
            <path id="IconifyId17ecdb2904d178eab7496" gradientUnits="userSpaceOnUse" x1="-2575.355" y1="437.519" x2="-2575.355" y2="471.206" gradientTransform="rotate(164.983 -1301.143 -38.63)scale(1 -1)" d="">
              <stop offset=".227" stopColor="#ffffff"/>
              <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
            </path>
            <path d="M12.355 30.83s-3.65 -9.68 3.845 -18.645c6.175 -7.39 11.75 -4.4 10.89 -1.25 -0.865 3.15 -3.55 4.12 -7.595 7.285C14.15 22.4 12.355 30.83 12.355 30.83" opacity=".85" fill="url(#IconifyId17ecdb2904d178eab7496)"/>
            <g>
              <path id="IconifyId17ecdb2904d178eab7497" gradientUnits="userSpaceOnUse" x1="85.871" y1="28.96" x2="85.871" y2="52.387" d="">
                <stop offset=".261" stopColor="#ffffff"/>
                <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
              </path>
              <path d="M46.48 17.385c-0.975 -0.485 -1.755 -1.095 -2.095 -2.13l-1.445 -4.785 -1.445 4.785c-0.34 1.03 -1.125 1.645 -2.095 2.13l-2.415 1.045 2.485 1.03c0.975 0.485 1.685 1.15 2.03 2.18l1.445 4.745 1.445 -4.745c0.34 -1.03 1.055 -1.695 2.03 -2.18l2.485 -1.03z" fill="url(#IconifyId17ecdb2904d178eab7497)"/>
              <path id="IconifyId17ecdb2904d178eab7498" gradientUnits="userSpaceOnUse" x1="76.221" y1="58.161" x2="76.221" y2="85.231" d="">
                <stop offset="0" stopColor="#ffffff"/>
                <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
              </path>
              <path d="M41.655 34.685c-0.975 -0.485 -1.755 -1.095 -2.095 -2.13l-1.445 -4.785 -1.445 4.785c-0.34 1.03 -1.125 1.645 -2.095 2.13l-2.415 1.045 2.485 1.03c0.975 0.485 1.685 1.15 2.03 2.18l1.445 4.745 1.445 -4.745c0.34 -1.03 1.055 -1.695 2.03 -2.18l2.485 -1.03z" fill="url(#IconifyId17ecdb2904d178eab7498)"/>
              <path d="M53.17 26.985c-0.735 -0.365 -1.325 -0.83 -1.585 -1.605l-1.09 -3.615 -1.09 3.615c-0.26 0.78 -0.85 1.24 -1.585 1.605L46 27.775l1.875 0.78c0.735 0.365 1.275 0.865 1.53 1.645l1.09 3.58 1.09 -3.58c0.26 -0.78 0.795 -1.28 1.53 -1.645l1.875 -0.78z" fill="#ffffff"/>
            </g>
          </g></Svg>
  )
})
