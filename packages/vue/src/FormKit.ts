import { error, FormKitNode, FormKitSchemaDefinition } from '@formkit/core'
import {
  h,
  ref,
  defineComponent,
  InjectionKey,
  ConcreteComponent,
  // FunctionalComponent,
  VNodeProps,
  AllowedComponentProps,
  ComponentCustomProps,
  VNode,
  RendererNode,
  RendererElement,
  SetupContext,
  RenderFunction,
} from 'vue'
import { useInput } from './composables/useInput'
import { FormKitSchema } from './FormKitSchema'
// import { props } from './props'
import {
  FormKitInputs,
  FormKitInputEvents,
  FormKitInputSlots,
  FormKitBaseEvents,
  runtimeProps,
} from '@formkit/inputs'

// export type Inputs =
//   | FormKitInputs[keyof FormKitInputs]
//   | Exclude<Partial<FormKitInputs['text']>, 'type'>

// type Events<Props extends FormKitInputs<Props>> =
//   Props['type'] extends keyof FormKitInputEvents<Props>
//     ? FormKitInputEvents<Props>[Props['type']] | FormKitBaseEvents<Props>
//     : FormKitBaseEvents<Props>

type Slots<Props extends FormKitInputs<Props>> =
  Props['type'] extends keyof FormKitInputSlots<Props>
    ? FormKitInputSlots<Props>[Props['type']]
    : {}

type AsRecord<T> = Record<string, (...args: any[]) => any> & T

export type EventFns<T extends Record<string, (...args: any[]) => any>> = {
  (event: keyof T, ...args: Parameters<T[keyof T]>): ReturnType<T[keyof T]>
}

// type EventFns<P extends FormKitInputs<P>, T extends Events<P>> = ToFns<{
//   [P in keyof T]: (
//     event: P,
//     ...args: T[P] extends (...args: any[]) => any ? Parameters<T[P]> : any[]
//   ) => ReturnType<T[P] extends (...args: any[]) => any ? T[P] : () => any>
// }>

// type ToFns<T extends Record<string, (...args: any[]) => any>> = T[keyof T]

/**
 * The FormKit component.
 */
// export interface FormKit {
//   <P extends FormKitInputs<P>>(p: P): FunctionalComponent<
//     P,
//     AsRecord<Events<P>>,
//     AsRecord<Slots<P>>
//   >
// }

/**
 * The TypeScript definition for the FormKit component.
 * @public
 */
export type FormKitComponent = <P extends FormKitInputs<P>>(
  props: P & VNodeProps & AllowedComponentProps & ComponentCustomProps,
  context?: Pick<FormKitSetupContext<P>, 'attrs' | 'emit' | 'slots'>,
  setup?: FormKitSetupContext<P>
) => VNode<
  RendererNode,
  RendererElement,
  {
    [key: string]: any
  }
> & { __ctx?: FormKitSetupContext<P> }

/**
 * Type definition for the FormKit component Vue context.
 * @public
 */
export interface FormKitSetupContext<P extends FormKitInputs<P>> {
  props: {} & P
  expose(exposed: {}): void
  attrs: any
  slots: Slots<P>
  // emit: FormKitBaseEvents<P>
  // emit: EventFns<P, Events<P>>
  emit: P['type'] extends keyof FormKitInputEvents<P>
    ? FormKitInputEvents<P>[P['type']] | FormKitBaseEvents<P>
    : FormKitBaseEvents<P>
}

/**
 * Flag to determine if we are running on the server.
 */
const isServer = typeof window === 'undefined'

/**
 * The symbol that represents the formkit parent injection value.
 *
 * @public
 */
export const parentSymbol: InjectionKey<FormKitNode> = Symbol('FormKitParent')

/**
 * This variable is set to the node that is currently having its schema created.
 *
 * @internal
 */
let currentSchemaNode: FormKitNode | null = null

/**
 * Returns the node that is currently having its schema created.
 *
 * @public
 */
export const getCurrentSchemaNode = () => currentSchemaNode

// type?: string | FormKitTypeDefinition
// name?: string
// validation?: any
// modelValue?: any
// parent?: FormKitNode
// errors: string[]
// inputErrors: Record<string, string | string[]>
// index?: number
// config: Record<string, any>
// sync?: boolean
// dynamic?: boolean
// classes?: Record<string, string | Record<string, boolean> | FormKitClasses>
// plugins: FormKitPlugin[]

function setup<Props extends FormKitInputs<Props>>(
  props: Props,
  context: SetupContext<{}, AsRecord<Slots<Props>>>
): RenderFunction {
  const node = useInput<Props, any>(props, context)
  if (!node.props.definition) error(600, node)
  if (node.props.definition.component) {
    return () =>
      h(
        node.props.definition?.component as any,
        {
          context: node.context,
        },
        { ...context.slots }
      )
  }
  const schema = ref<FormKitSchemaDefinition>([])
  let memoKey: string | undefined = node.props.definition.schemaMemoKey
  const generateSchema = () => {
    const schemaDefinition = node.props?.definition?.schema
    if (!schemaDefinition) error(601, node)
    if (typeof schemaDefinition === 'function') {
      currentSchemaNode = node
      schema.value = schemaDefinition({ ...props.sectionsSchema })
      currentSchemaNode = null
      if (
        (memoKey && props.sectionsSchema) ||
        ('memoKey' in schemaDefinition &&
          typeof schemaDefinition.memoKey === 'string')
      ) {
        memoKey =
          (memoKey ?? schemaDefinition?.memoKey) +
          JSON.stringify(props.sectionsSchema)
      }
    } else {
      schema.value = schemaDefinition
    }
  }
  generateSchema()

  // // If someone emits the schema event, we re-generate the schema
  if (!isServer) {
    node.on('schema', generateSchema)
  }

  context.emit('node', node)
  const library = node.props.definition.library as
    | Record<string, ConcreteComponent>
    | undefined

  // // Expose the FormKitNode to template refs.
  context.expose({ node })
  return () =>
    h(
      FormKitSchema,
      { schema: schema.value, data: node.context, library, memoKey },
      { ...context.slots }
    )
}

/**
 * The root FormKit component.
 *
 * @public
 */
export const formkitComponent = defineComponent(setup as any, {
  props: runtimeProps as any,
  inheritAttrs: false,
}) as FormKitComponent
// ☝️ We need to cheat here a little bit since our runtime props and our
// public prop interface are different (we treat some attrs as props to allow
// for runtime "prop" creation).

export default formkitComponent
