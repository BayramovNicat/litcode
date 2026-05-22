import { html, cn, component, type View, type Props } from '../lib';

export type LabelProps = Props<Partial<HTMLLabelElement>>;

export const Label = component(({ className, children }: LabelProps = {}): View => {
  return html`<label
    class="${cn(
      'flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed',
      className,
    )}"
    >${children ?? ''}</label
  >`;
});
