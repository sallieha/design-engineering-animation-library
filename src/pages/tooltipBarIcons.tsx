import type { ReactNode } from 'react'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  )
}

export const CommentIcon = () => (
  <Icon>
    <path d="M12 4.5c-4.4 0-8 3-8 6.8 0 1.7.7 3.200 1.900 4.400L5 19.500l3.800-1.400c1 .3 2.100.5 3.200.5 4.400 0 8-3 8-6.800S16.400 4.500 12 4.500Z" />
  </Icon>
)

export const InboxIcon = () => (
  <Icon>
    <path d="M4 13.500 6.500 6h11L20 13.500M4 13.500V18h16v-4.500M4 13.500h4.500a3.500 3.500 0 0 0 7 0H20" />
  </Icon>
)

export const PreviewIcon = () => (
  <Icon>
    <path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12Z" />
    <circle cx="12" cy="12" r="2.800" />
  </Icon>
)

export const ShareIcon = () => (
  <Icon>
    <path d="M12 15V4.500M8 8l4-4 4 4M5 13v5.500h14V13" />
  </Icon>
)

export const MenuIcon = () => (
  <Icon>
    <path d="M4 7h16M4 12h10M4 17h16" />
  </Icon>
)
