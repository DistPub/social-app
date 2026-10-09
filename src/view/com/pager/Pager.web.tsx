import {
  Children,
  type JSX,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {type GestureResponderEvent, View} from 'react-native'
import {flushSync} from 'react-dom'

import {s} from '#/lib/styles'
import {atoms as a} from '#/alf'

export interface PagerRef {
  setPage: (index: number) => void
}

export interface RenderTabBarFnProps {
  selectedPage: number
  onSelect?: (index: number) => void
  tabBarAnchor?: JSX.Element
}
export type RenderTabBarFn = (props: RenderTabBarFnProps) => JSX.Element

interface Props {
  ref?: React.Ref<PagerRef>
  initialPage?: number
  renderTabBar: RenderTabBarFn
  onPageSelected?: (index: number) => void
}

export function Pager({
  ref,
  children,
  initialPage = 0,
  renderTabBar,
  onPageSelected,
}: React.PropsWithChildren<Props>) {
  const [selectedPage, setSelectedPage] = useState(initialPage)
  const scrollYs = useRef<Array<number | null>>([])
  const anchorRef = useRef(null)
  const childCount = Children.count(children)

  const swipe = useRef({
    touching: false,
    skip: false,
    startX: 0,
    startY: 0,
    fired: false,
  })

  const isHorizontalScrollable = (target: any): boolean => {
    let el: Element | null = target
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth) {
        const overflowX = getComputedStyle(el).overflowX
        if (overflowX === 'auto' || overflowX === 'scroll') {
          return true
        }
      }
      el = el.parentElement
    }
    return false
  }

  const readTouch = (e: GestureResponderEvent) => {
    const nativeEvent = e.nativeEvent as any
    const touch = nativeEvent?.changedTouches?.[0] ?? nativeEvent?.touches?.[0]
    return touch ? {x: touch.pageX ?? 0, y: touch.pageY ?? 0} : null
  }

  const onTouchStart = (e: GestureResponderEvent) => {
    if (childCount < 2) return
    const point = readTouch(e)
    if (!point) return
    const target = (e.nativeEvent as any)?.target as Element | undefined
    swipe.current = {
      touching: true,
      skip: target ? isHorizontalScrollable(target) : false,
      startX: point.x,
      startY: point.y,
      fired: false,
    }
  }

  const onTouchMove = () => {}

  const onTouchEnd = (e: GestureResponderEvent) => {
    const state = swipe.current
    if (!state.touching || state.skip || state.fired) {
      swipe.current.touching = false
      return
    }
    swipe.current.touching = false
    const point = readTouch(e)
    if (!point) return
    const dx = point.x - state.startX
    const dy = point.y - state.startY

    if (Math.abs(dx) <= 48 || Math.abs(dx) <= 2 * Math.abs(dy)) return

    if (dx > 0) {
      if (selectedPage <= 0) return
      swipe.current.fired = true
      onTabBarSelect(selectedPage - 1)
    } else {
      if (selectedPage >= childCount - 1) return
      swipe.current.fired = true
      onTabBarSelect(selectedPage + 1)
    }
  }

  const onTouchCancel = () => {
    swipe.current.touching = false
    swipe.current.skip = false
    swipe.current.fired = false
  }

  useImperativeHandle(ref, () => ({
    setPage: (index: number) => {
      onTabBarSelect(index)
    },
  }))

  const onTabBarSelect = useCallback(
    (index: number) => {
      const scrollY = window.scrollY
      // We want to determine if the tabbar is already "sticking" at the top (in which
      // case we should preserve and restore scroll), or if it is somewhere below in the
      // viewport (in which case a scroll jump would be jarring). We determine this by
      // measuring where the "anchor" element is (which we place just above the tabbar).
      let anchorTop = anchorRef.current
        ? (anchorRef.current as Element).getBoundingClientRect().top
        : -scrollY // If there's no anchor, treat the top of the page as one.
      const isSticking = anchorTop <= 5 // This would be 0 if browser scrollTo() was reliable.

      if (isSticking) {
        scrollYs.current[selectedPage] = window.scrollY
      } else {
        scrollYs.current[selectedPage] = null
      }
      flushSync(() => {
        setSelectedPage(index)
        onPageSelected?.(index)
      })
      if (isSticking) {
        const restoredScrollY = scrollYs.current[index]
        if (restoredScrollY != null) {
          window.scrollTo(0, restoredScrollY)
        } else {
          window.scrollTo(0, scrollY + anchorTop)
        }
      }
    },
    [selectedPage, setSelectedPage, onPageSelected],
  )

  return (
    <View
      style={s.hContentRegion}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}>
      {renderTabBar({
        selectedPage,
        tabBarAnchor: <View ref={anchorRef} />,
        onSelect: e => onTabBarSelect(e),
      })}
      {Children.map(children, (child, i) => (
        <View
          style={selectedPage === i ? a.flex_1 : a.hidden}
          key={`page-${i}`}>
          {child}
        </View>
      ))}
    </View>
  )
}
