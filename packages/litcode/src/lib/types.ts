import { type Signal } from './signals';

/**
 * Internal template object returned by `html`.
 */
export type TemplateResult = {
  readonly __litcodeTemplate: true;
  readonly strings: TemplateStringsArray;
  readonly values: unknown[];
};

/**
 * Internal repeat block returned by `repeat`.
 */
export interface RepeatResult<Item = unknown> {
  readonly __litcodeRepeat: true;
  readonly items: readonly Item[];
  key(item: Item, index: number): string | number;
  render(item: Item, index: number): View;
}

/**
 * Any value that can be rendered by Litcode.
 */
export type AnyNode =
  | Node
  | TemplateResult
  | RepeatResult
  | string
  | number
  | boolean
  | null
  | undefined;

/**
 * A renderable Litcode value.
 */
export type View = AnyNode | View[];

type RequiredKeys<Props extends object> = {
  [Key in keyof Props]-?: object extends Pick<Props, Key> ? never : Key;
}[keyof Props];

/**
 * A typed component function.
 */
export type Component<Props extends object = {}> =
  RequiredKeys<Props> extends never ? (props?: Props) => View : (props: Props) => View;

/**
 * Infers the props type from a component.
 */
export type InferProps<T> = T extends Component<infer Props> ? Props : never;

/**
 * Props that are handled specially by component root prop application.
 */
export const specialPropKeys = ['children', 'dataset', 'style'] as const;

type SpecialPropKey = (typeof specialPropKeys)[number];

/**
 * Component props helper with built-in `children`, `dataset`, and `style`.
 */
export type Props<P extends object = {}> = {
  [K in keyof Omit<P, SpecialPropKey>]: P[K] | Signal<P[K]>;
} & {
  children?: View | View[];
  dataset?: Partial<{
    [K in keyof DOMStringMap]: DOMStringMap[K] | Signal<DOMStringMap[K]>;
  }>;
  style?: string | Signal<string> | (() => string);
};

/**
 * Component children value.
 */
export type Children = View;

/**
 * Handle returned from `render`/`mount`.
 */
export type MountHandle = {
  update(view: View): void;
  destroy(): void;
};

