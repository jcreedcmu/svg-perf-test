declare module 'canonical-json' {
  function stringify(value: any, replacer?: (key: string, value: any) => any, space?: string | number): string;
  function stringify(value: any, replacer?: (number | string)[] | null, space?: string | number): string;
  export = stringify;
}
