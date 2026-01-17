import {useCallback, useEffect, useState} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const PREFIX = 'agent-labelers'

export async function saveLabelers(did: string, value: string[]) {
  await AsyncStorage.setItem(`${PREFIX}:${did}`, JSON.stringify(value))
}

export async function readLabelers(did: string): Promise<string[] | undefined> {
  const rawData = await AsyncStorage.getItem(`${PREFIX}:${did}`)
  return rawData ? JSON.parse(rawData) : undefined
}

export async function saveShortcutTopicBufferBan(did: string, value: boolean) {
  await AsyncStorage.setItem(`shortcut-topic-buffer-ban:${did}`, value ? '1' : '0')
}

export async function readShortcutTopicBufferBan(did: string) {
  const data = await AsyncStorage.getItem(`shortcut-topic-buffer-ban:${did}`)
  return data === '1'
}

export function useShortcutTopicBufferBan(did: string) {
  const [state, setState] = useState(false);
  const [done, setDone] = useState(false);   // 是否完成首次读取

  // 读
  useEffect(() => {
    readShortcutTopicBufferBan(did)
      .then(val => setState(val))
      .catch(() => {})          // 失败就保持 initialValue
      .finally(() => setDone(true));
  }, [did]);

  // 写（包裹一层持久化）
  const set = useCallback((newValue: boolean) => {
    setState(newValue);
    saveShortcutTopicBufferBan(did, newValue);
  }, [did]);

  return [state, set, done] as const
}
