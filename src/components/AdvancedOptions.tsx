import { useId, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import './advanced-options.css'

interface Props {
  module: string
  description: string
  expanded: boolean
  onChange: (expanded: boolean) => void
  children: ReactNode
}

export default function AdvancedOptions({ module, description, expanded, onChange, children }: Props) {
  const id = useId()
  return <div className="advanced-options">
    <button type="button" className="advanced-options-toggle" aria-label={`Opciones avanzadas de ${module}`} aria-expanded={expanded} aria-controls={id} onClick={() => onChange(!expanded)}>
      <SlidersHorizontal size={18}/><span><strong>Opciones avanzadas</strong><small>{description}</small></span><ChevronDown size={18} className={expanded ? 'expanded' : ''}/>
    </button>
    <div id={id} className="advanced-options-panel" hidden={!expanded}>{children}</div>
  </div>
}
