import { has } from '@formkit/utils'
import type { FormKitValidationRule } from '@formkit/validation'

/**
 * Determine if the given input's value contains lowercase characters.
 * @param context - The FormKitValidationContext
 * @public
 */
const contains_lowercase: FormKitValidationRule = function (
  { value },
  set = 'default'
) {
  const sets = {
    default: /\p{Ll}/u,
    latin: /[a-z]/,
  }
  const selectedSet: 'default' | 'latin' = has(sets, set) ? set : 'default'
  return sets[selectedSet].test(String(value))
}

export default contains_lowercase
