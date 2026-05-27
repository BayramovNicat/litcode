import { component, html, repeat, type Props, type View } from '../core';
import { cn } from '../variants';

type SelectOptionValue = string | number;

export type SelectOption =
  | SelectOptionValue
  | {
      key?: SelectOptionValue;
      value: SelectOptionValue;
      label?: View;
      disabled?: boolean;
      selected?: boolean;
    };

export type SelectProps = Props<Omit<Partial<HTMLSelectElement>, 'options'>> & {
  items?: readonly SelectOption[];
};

type NormalizedSelectOption = {
  value: SelectOptionValue;
  label: View;
  disabled?: boolean;
  selected?: boolean;
};

function isSelectOptionObject(
  option: SelectOption,
): option is Exclude<SelectOption, SelectOptionValue> {
  return typeof option === 'object' && option !== null;
}

function optionKey(option: SelectOption, index: number): SelectOptionValue {
  return isSelectOptionObject(option) && option.key !== undefined ? option.key : index;
}

function normalizeOption(option: SelectOption): NormalizedSelectOption {
  if (!isSelectOptionObject(option)) {
    return {
      value: option,
      label: option,
    };
  }

  return {
    value: option.key ?? option.value,
    label: option.label ?? option.value,
    disabled: option.disabled,
    selected: option.selected,
  };
}

function renderOption(option: SelectOption): View {
  const item = normalizeOption(option);

  return html`<option value="${item.value}" disabled="${item.disabled}" selected="${item.selected}">
    ${item.label}
  </option>`;
}

const RawSelect = component<SelectProps>(
  ({ className, items = [], value }: SelectProps = {}): View => {
    const selectClass = cn(
      'h-8 w-full min-w-0 appearance-none rounded-(--radius) border border-input py-1 pr-8 pl-2.5 text-sm transition-colors select-none bg-transparent hover:bg-input/50 outline-none disabled:pointer-events-none disabled:cursor-not-allowed',
      'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
      'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
      'dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
      className,
    );
    const renderedOptions = repeat(items, optionKey, renderOption);

    if (value === undefined || value === null) {
      return html`<select class="${selectClass}">
        ${renderedOptions}
      </select>`;
    }

    return html`<select class="${selectClass}">
      ${renderedOptions}
    </select>`;
  },
);

export const Select = (props: SelectProps = {}): View => {
  return html`<div class="relative w-fit has-[select:disabled]:opacity-50">
    ${RawSelect(props)}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none select-none"
      aria-hidden="true"
      data-slot="native-select-icon"
    >
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  </div>`;
};
