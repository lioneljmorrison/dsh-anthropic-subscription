import { jsx } from 'react/jsx-runtime'

const SETTINGS_NAMESPACE = 'dsh-anthropic-subscription'

export const inject = ['slots', 'remote.settings']

/** Add the same external-editor action used by the global settings page. */
export function apply(ctx: any): void {
  ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
    name: 'settings.models.provider-card',
    key: SETTINGS_NAMESPACE,
  }, () => jsx('button', {
    type: 'button',
    onClick: () => void ctx.remote.settings.openSettingsDocument(),
    children: 'Open settings.yaml',
  })))
}
