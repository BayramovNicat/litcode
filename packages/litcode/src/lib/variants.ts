import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type VariantDefinition = Record<string, Record<string, ClassValue>>;

type VariantSelection<TVariants extends VariantDefinition> = {
  [Key in keyof TVariants]?: keyof TVariants[Key] & string;
};

type TvConfig<TVariants extends VariantDefinition> = {
  base?: ClassValue;
  variants?: TVariants;
  defaultVariants?: VariantSelection<TVariants>;
};

type TvFactory<TVariants extends VariantDefinition> = ((
  props?: VariantSelection<TVariants> & { class?: ClassValue; className?: ClassValue },
) => string) & { variants: TVariants };

/**
 * Extracts the variant prop shape from a `tv()` factory.
 */
export type VariantProps<T> = T extends { variants: infer TVariants extends VariantDefinition }
  ? VariantSelection<TVariants>
  : never;

/**
 * Merges class values using `clsx` and `tailwind-merge`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Creates a typed variant class factory.
 *
 * The returned function accepts variant selections plus `class` and
 * `className` overrides.
 */
export function tv<TVariants extends VariantDefinition>(
  config: TvConfig<TVariants>,
): TvFactory<TVariants> {
  const variants = config.variants ?? ({} as TVariants);
  const variantEntries = Object.entries(variants);

  const factory = (
    props: VariantSelection<TVariants> & { class?: ClassValue; className?: ClassValue } = {},
  ) => {
    const pieces: ClassValue[] = [config.base];

    for (let index = 0; index < variantEntries.length; index++) {
      const [name, options] = variantEntries[index];
      const selected =
        props[name as keyof TVariants] ?? config.defaultVariants?.[name as keyof TVariants];
      if (!selected) continue;

      const variantValue = options[selected as string];
      if (variantValue) pieces.push(variantValue);
    }

    pieces.push(props.class, props.className);
    return cn(...pieces);
  };

  return Object.assign(factory, { variants });
}
