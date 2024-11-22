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

const cache = new Map();

export async function saveShortcutTopicBufferBan(did: string, value: boolean) {
  const key = `shortcut-topic-buffer-ban:${did}`
  const val = value ? '1' : '0'
  // cache promise value
  cache.set(key, Promise.resolve(value))
  await AsyncStorage.setItem(key, val)
}

export async function readShortcutTopicBufferBan(did: string) {
  const key = `shortcut-topic-buffer-ban:${did}`
  if (!cache.has(key)) {
    cache.set(key, AsyncStorage.getItem(key).then(data => data === '1'))
  }
  // return cached promise value
  return cache.get(key)
}

export const cgvCursorAtUri = { uri: '' }
const S32_CHAR = '234567abcdefghijklmnopqrstuvwxyz';
const s32decode = (s) => {
    let i = 0;
    for (const c of s) {
        i = i * 32 + S32_CHAR.indexOf(c);
    }
    return i;
};

export const TIDParse = (tid) => {
    const timestamp = s32decode(tid.slice(0, 11));
    const clockid = s32decode(tid.slice(11, 13));
    return { timestamp: timestamp, clockid: clockid };
};
export function useCGVCursorAtUri() {
  const [state, setState] = useState(cgvCursorAtUri.uri)
  const set = useCallback((val: string) => {
    cgvCursorAtUri.uri = val
    setState(val)
  },[])
  return [state, set] as const
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
