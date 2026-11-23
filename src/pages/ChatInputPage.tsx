import { useEffect } from 'react'
import { ChatInput } from '../lib'
import './ChatInputPage.css'

/**
 * 7.0 — Chat Input & Send: a glass message bar whose send flies the send icon off,
 * floats your bubble up and washes color up the page, then brings a reply.
 * Same series as 5.0 and 6.0, so it shares their background and line art.
 */
function ChatInputPage() {
  useEffect(() => {
    document.body.setAttribute('data-bg-variant', 'five')
    return () => document.body.removeAttribute('data-bg-variant')
  }, [])

  return (
    <div className="chat-input-playground">
      <ChatInput />
    </div>
  )
}

export default ChatInputPage
