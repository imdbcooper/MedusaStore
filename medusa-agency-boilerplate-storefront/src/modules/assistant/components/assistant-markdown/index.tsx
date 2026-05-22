type AssistantMarkdownProps = {
  content: string
}

type InlineNode = {
  type: "text" | "code" | "strong"
  value: string
}

type ListItem = {
  content: string
  ordered: boolean
  index?: number
}

const LIST_MARKER_RE = /^(?:(\d+)[.)]|[-*•])\s+/
const INLINE_TOKEN_RE = /(\*\*[^*]+\*\*|`[^`]+`)/g

function parseInlineText(value: string): InlineNode[] {
  return value
    .split(INLINE_TOKEN_RE)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return { type: "code", value: part.slice(1, -1) }
      }

      if (part.startsWith("**") && part.endsWith("**")) {
        return { type: "strong", value: part.slice(2, -2) }
      }

      return { type: "text", value: part }
    })
}

function renderInlineText(value: string) {
  return parseInlineText(value).map((part, index) => {
    if (part.type === "code") {
      return (
        <code key={index} className="rounded bg-ui-bg-subtle px-1 py-0.5 text-[0.85em]">
          {part.value}
        </code>
      )
    }

    if (part.type === "strong") {
      return <strong key={index} className="font-semibold text-ui-fg-base">{part.value}</strong>
    }

    return <span key={index}>{part.value}</span>
  })
}

function stripHeadingMarker(value: string) {
  return value.replace(/^#{1,6}\s+/, "")
}

function parseListItem(value: string): ListItem | null {
  const marker = value.match(LIST_MARKER_RE)
  if (!marker) {
    return null
  }

  const orderedIndex = marker[1] ? Number(marker[1]) : undefined
  return {
    content: value.slice(marker[0].length),
    ordered: Number.isFinite(orderedIndex),
    index: orderedIndex,
  }
}

function renderList(items: ListItem[], key: string) {
  const ordered = items[0]?.ordered === true
  const className = "space-y-1 pl-5"
  const children = items.map((item, index) => (
    <li key={`${key}_${index}`} className="pl-1">
      {renderInlineText(stripHeadingMarker(item.content))}
    </li>
  ))

  if (ordered) {
    return (
      <ol key={key} className={`${className} list-decimal`} start={items[0]?.index || 1}>
        {children}
      </ol>
    )
  }

  return (
    <ul key={key} className={`${className} list-disc`}>
      {children}
    </ul>
  )
}

export default function AssistantMarkdown({ content }: AssistantMarkdownProps) {
  const blocks: React.ReactNode[] = []
  let pendingList: ListItem[] = []

  function flushList() {
    if (!pendingList.length) {
      return
    }

    blocks.push(renderList(pendingList, `list_${blocks.length}`))
    pendingList = []
  }

  content.split("\n").forEach((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      blocks.push(<div key={`space_${index}`} className="h-2" />)
      return
    }

    const listItem = parseListItem(trimmed)
    if (listItem) {
      if (pendingList.length && pendingList[0].ordered !== listItem.ordered) {
        flushList()
      }
      pendingList.push(listItem)
      return
    }

    flushList()
    blocks.push(<p key={`paragraph_${index}`}>{renderInlineText(stripHeadingMarker(trimmed))}</p>)
  })

  flushList()

  return <div className="space-y-2 text-sm leading-6 text-ui-fg-base">{blocks}</div>
}
