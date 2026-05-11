type AssistantMarkdownProps = {
  content: string
}

function renderInlineText(value: string) {
  return value.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-ui-bg-subtle px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }

    return <span key={index}>{part}</span>
  })
}

export default function AssistantMarkdown({ content }: AssistantMarkdownProps) {
  const lines = content.split("\n")

  return (
    <div className="space-y-2 text-sm leading-6 text-ui-fg-base">
      {lines.map((line, index) => {
        const trimmed = line.trim()

        if (!trimmed) {
          return <div key={index} className="h-2" />
        }

        if (trimmed.startsWith("- ")) {
          return (
            <div key={index} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <p>{renderInlineText(trimmed.slice(2))}</p>
            </div>
          )
        }

        return <p key={index}>{renderInlineText(trimmed.replace(/^#{1,6}\s+/, ""))}</p>
      })}
    </div>
  )
}
