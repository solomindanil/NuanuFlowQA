import type { SyncMsg } from '../types'

const CHANNEL = 'voice-deck'

/** Связь «сцена ↔ пульт» между окнами одного браузера. */
export function createChannel(onMsg: (msg: SyncMsg) => void) {
  const ch = new BroadcastChannel(CHANNEL)
  ch.onmessage = (ev) => onMsg(ev.data as SyncMsg)
  return {
    post(msg: SyncMsg): void {
      ch.postMessage(msg)
    },
    close(): void {
      ch.close()
    },
  }
}
