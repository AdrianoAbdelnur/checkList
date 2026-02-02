"use client"
import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
}

export default function Button({ children, loading, className = '', ...rest }: Props) {
  return (
    <button
      className={
        'w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 ' +
        className
      }
      disabled={Boolean(rest.disabled) || loading}
      {...rest}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4"></circle>
          <path d="M4 12a8 8 0 018-8" stroke="white" strokeWidth="4" strokeLinecap="round"></path>
        </svg>
      )}
      <span>{children}</span>
    </button>
  )
}
