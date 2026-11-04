import type { ChangeEvent } from "react";
import type {
  FieldErrors,
  FieldValues,
  Path,
  UseFormClearErrors,
  UseFormRegister,
} from "react-hook-form";

export function clearableRegister<T extends FieldValues>(
  register: UseFormRegister<T>,
  errors: FieldErrors<T>,
  clearErrors: UseFormClearErrors<T>,
) {
  return (name: Path<T>) => {
    const field = register(name);
    return {
      ...field,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const result = field.onChange(event);
        if ((errors as Record<string, unknown>)[name]) clearErrors(name);
        return result;
      },
    };
  };
}
