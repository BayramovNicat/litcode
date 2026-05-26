export type TemplateResult = {
  readonly __litcodeTemplate: true;
  readonly strings: TemplateStringsArray;
  readonly values: unknown[];
};

export interface RepeatResult<Item = unknown> {
  readonly __litcodeRepeat: true;
  readonly items: readonly Item[];
  key(item: Item, index: number): string | number;
  render(item: Item, index: number): View;
}

export type AnyNode =
  | Node
  | TemplateResult
  | RepeatResult
  | string
  | number
  | boolean
  | null
  | undefined;

export type View = AnyNode | View[];

type RequiredKeys<Props extends object> = {
  [Key in keyof Props]-?: object extends Pick<Props, Key> ? never : Key;
}[keyof Props];

export type Component<Props extends object = {}> =
  RequiredKeys<Props> extends never ? (props?: Props) => View : (props: Props) => View;

export type InferProps<T> = T extends Component<infer Props> ? Props : never;

export const specialPropKeys = ['children', 'dataset', 'style'] as const;

type SpecialPropKey = (typeof specialPropKeys)[number];

export type Props<P extends object = {}> = Omit<P, SpecialPropKey> & {
  children?: View | View[];
  dataset?: Partial<DOMStringMap>;
  style?: string;
};

export type Children = View;

export type MountHandle = {
  update(view: View): void;
  destroy(): void;
};
