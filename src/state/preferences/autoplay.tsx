import {createContext, useCallback, useContext, useState} from 'react'
import {type PropsWithChildren} from 'react'

import * as persisted from '#/state/persisted'
import {useSession} from '#/state/session'
import {account} from '#/storage'
import {PlatformInfo} from '../../../modules/expo-bluesky-swiss-army'

type StateContext = boolean
type SetContext = (v: boolean) => void

const defaultAutoplayDisabled = PlatformInfo.getIsReducedMotionEnabled()

const stateContext = createContext<StateContext>(defaultAutoplayDisabled)
stateContext.displayName = 'AutoplayStateContext'
const setContext = createContext<SetContext>((_: boolean) => {})
setContext.displayName = 'AutoplaySetContext'

function readAutoplayDisabled(did: string | undefined): boolean {
  if (!did) return defaultAutoplayDisabled
  let next = account.get([did, 'disableAutoplay'])
  if (next === undefined) {
    // Migrate the old global preference (set before this was scoped per-account).
    const legacy = persisted.get('disableAutoplay')
    if (legacy !== undefined) {
      account.set([did, 'disableAutoplay'], legacy)
      next = legacy
    }
  }
  return next ?? defaultAutoplayDisabled
}

export function Provider({children}: PropsWithChildren<{}>) {
  const {currentAccount} = useSession()
  const did = currentAccount?.did

  const [state, setState] = useState<boolean>(() => readAutoplayDisabled(did))

  const setStateWrapped = useCallback(
    (autoplayDisabled: boolean) => {
      setState(autoplayDisabled)
      if (did) {
        account.set([did, 'disableAutoplay'], autoplayDisabled)
      }
    },
    [did],
  )

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export const useAutoplayDisabled = () => useContext(stateContext)
export const useSetAutoplayDisabled = () => useContext(setContext)
