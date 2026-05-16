export type AnyNode = Node | string | number | boolean | null | undefined

export type View = AnyNode | AnyNode[]

export type Component<Props extends object = Record<string, never>> = (props: Props) => View

export type InferProps<T> = T extends Component<infer Props> ? Props : never

export type Children = View

export type MountHandle = {
  update(view: View): void
  destroy(): void
}
