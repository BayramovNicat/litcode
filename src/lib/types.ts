export type AnyNode = Node | string | number | boolean | null | undefined;

export type View = AnyNode | View[];

type RequiredKeys<Props extends object> = {
  [Key in keyof Props]-?: object extends Pick<Props, Key> ? never : Key;
}[keyof Props];

export type Component<Props extends object = {}> =
  RequiredKeys<Props> extends never ? (props?: Props) => View : (props: Props) => View;

export type InferProps<T> = T extends Component<infer Props> ? Props : never;

export type Props<P extends object = {}> = Omit<P, 'children'> & {
  children?: View | View[];
};

export type Children = View;

export type MountHandle = {
  update(view: View): void;
  destroy(): void;
};
