"use client"
import React from 'react'

type Props = {
  id: string
  name?: string
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  error?: string | null
  icon?: React.ReactNode
}

export default function Input({ id, name, type = 'text', value, onChange, placeholder, error, icon }: Props) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {name ?? id}
      </label>
      <div className="flex items-center gap-3 border rounded-md bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-300">
        {icon && <div className="w-5 h-5 text-gray-400">{icon}</div>}
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="flex-1 outline-none text-sm"
        />
      </div>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
