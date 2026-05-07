import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
}) => {
  const filteredOptions = (option.values ?? []).map((v) => v.value)

  return (
    <div className="flex flex-col gap-y-3">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
        Select {title}
      </span>
      <div
        className="flex flex-wrap justify-between gap-2"
        data-testid={dataTestId}
      >
        {filteredOptions.map((v) => {
          return (
            <button
              onClick={() => updateOption(option.id, v)}
              key={v}
              className={clx(
                "min-h-11 flex-1 rounded-[8px] border px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] transition duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                {
                  "border-[var(--theme-accent)] bg-[var(--theme-surface)] text-[var(--theme-foreground)] shadow-[0_4px_12px_rgba(23,26,31,0.06)]":
                    v === current,
                  "border-transparent bg-[var(--theme-surface-muted)] text-[var(--theme-muted)] hover:bg-[var(--theme-surface)] hover:text-[var(--theme-foreground)]":
                    v !== current,
                }
              )}
              disabled={disabled}
              data-testid="option-button"
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OptionSelect
