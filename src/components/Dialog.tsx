import { useState, useEffect, useRef } from 'react'

export type DialogType = 'alert' | 'confirm' | 'prompt'

interface DialogProps {
  type: DialogType
  title: string
  message: string
  defaultValue?: string
  onConfirm: (value?: string) => void
  onCancel: () => void
  lang: 'en' | 'ru'
}

export function Dialog({ type, title, message, defaultValue = '', onConfirm, onCancel, lang }: DialogProps) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (type === 'prompt') {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [type])

  const handleConfirm = () => {
    onConfirm(type === 'prompt' ? value : undefined)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-[min(90vw,440px)] bg-[#1a1d27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h3 className="text-white font-bold text-lg">{title}</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors text-2xl">×</button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
          
          {type === 'prompt' && (
            <input
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirm()
                if (e.key === 'Escape') onCancel()
              }}
              className="w-full mt-4 bg-[#0f1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 transition-colors font-medium"
              placeholder="..."
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/5 flex items-center justify-end gap-3 border-t border-white/5">
          {type !== 'alert' && (
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm font-semibold"
            >
              {lang === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-sm font-bold shadow-lg shadow-indigo-900/20 active:scale-95"
          >
            {type === 'alert' ? (lang === 'ru' ? 'Понятно' : 'OK') : (lang === 'ru' ? 'Подтвердить' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
