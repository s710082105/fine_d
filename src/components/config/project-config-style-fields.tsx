import { Input } from 'antd'
import { ProjectConfig, StyleProfile } from '../../lib/types/project-config'
const { TextArea } = Input

interface StyleFieldProps {
  config: ProjectConfig
  updateStyle: (patch: Partial<StyleProfile>) => void
}

export function StyleFields({ config, updateStyle }: StyleFieldProps) {
  return (
    <div className="config-section">
      <label className="config-field">
        <span className="config-field__label">样式说明</span>
        <TextArea
          aria-label="样式说明"
          className="config-textarea"
          rows={10}
          value={config.style.instructions}
          onChange={(event) => updateStyle({ instructions: event.target.value })}
        />
      </label>
      <p className="form-hint">
        这里的内容会作为 AI 的项目上下文写入，直接描述版式、配色、字体和输出风格。
      </p>
    </div>
  )
}
