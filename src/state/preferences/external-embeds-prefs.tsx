import {createContext, useCallback, useContext, useState} from 'react'
import {type PropsWithChildren} from 'react'

import {type EmbedPlayerSource} from '#/lib/strings/embed-player'
import * as persisted from '#/state/persisted'
import {useSession} from '#/state/session'
import {account} from '#/storage'

type ExternalEmbedsValue = Partial<Record<EmbedPlayerSource, 'show' | 'hide'>>
type StateContext = ExternalEmbedsValue
type SetContext = (
  source: EmbedPlayerSource,
  value: 'show' | 'hide' | undefined,
) => void

const stateContext = createContext<StateContext>({})
stateContext.displayName = 'ExternalEmbedsPrefsStateContext'
const setContext = createContext<SetContext>({} as SetContext)
setContext.displayName = 'ExternalEmbedsPrefsSetContext'

function readExternalEmbeds(did: string | undefined): ExternalEmbedsValue {
  if (!did) return {}
  let next = account.get([did, 'externalEmbeds'])
  if (next === undefined) {
    // Migrate the old global preference (set before this was scoped per-account).
    const legacy = persisted.get('externalEmbeds')
    if (legacy && Object.keys(legacy).length > 0) {
      account.set([did, 'externalEmbeds'], legacy)
      next = legacy
    }
  }
  return next ?? {}
}

export function Provider({children}: PropsWithChildren<{}>) {
  const {currentAccount} = useSession()
  const did = currentAccount?.did

  const [state, setState] = useState<ExternalEmbedsValue>(() =>
    readExternalEmbeds(did),
  )

  const setStateWrapped = useCallback(
    (source: EmbedPlayerSource, value: 'show' | 'hide' | undefined) => {
      setState(prev => {
        const next: ExternalEmbedsValue = {
          ...prev,
          [source]: value,
        }
        if (did) {
          account.set([did, 'externalEmbeds'], next)
        }
        return next
      })
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

export function useExternalEmbedsPrefs() {
  return useContext(stateContext)
}

export function useSetExternalEmbedPref() {
  return useContext(setContext)
}
