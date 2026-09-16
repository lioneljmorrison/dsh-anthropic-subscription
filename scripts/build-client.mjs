import { writeFile } from 'node:fs/promises'

const source = `window.__ModuleLoader__.load({
  id: 'dsh-anthropic-subscription',
  factory: (require) => {
    const { jsx } = require('react/jsx-runtime')
    const SETTINGS_NAMESPACE = 'dsh-anthropic-subscription'
    const inject = ['slots', 'remote.settings']
    function apply(ctx) {
      ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
        name: 'settings.models.provider-card',
        key: SETTINGS_NAMESPACE,
      }, () => jsx('button', {
        type: 'button',
        onClick: () => void ctx.remote.settings.openSettingsDocument(),
        children: 'Open settings.yaml',
      })))
    }
    return { inject, apply }
  },
})
`

await writeFile(new URL('../lib/client.js', import.meta.url), source)
