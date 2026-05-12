import type { Tag } from "../shared"
import { ALL_TAGS } from "../shared"
import "./TagFilter.css"

interface Props {
  active: Tag[]
  onChange: (tags: Tag[]) => void
}

export function TagFilter({ active, onChange }: Props) {
  function toggle(tag: Tag) {
    if (active.includes(tag)) {
      onChange(active.filter((t) => t !== tag))
    } else {
      onChange([...active, tag])
    }
  }

  return (
    <div className="tag-filter">
      <div className="tag-filter-label">[ FILTER BY DESIGNATION ]</div>
      <div className="tag-filter-list">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            className={`tag-chip ${active.includes(tag) ? "tag-chip--active" : ""}`}
            onClick={() => toggle(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}
