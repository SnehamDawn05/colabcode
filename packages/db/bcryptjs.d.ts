declare module "bcryptjs" {
  function hash(data: string, saltOrRounds: string | number): Promise<string>;
  function compare(data: string, encrypted: string): Promise<boolean>;
  function genSalt(rounds?: number): Promise<string>;
  function hashSync(data: string, saltOrRounds: string | number): string;
  function compareSync(data: string, encrypted: string): boolean;
  function genSaltSync(rounds?: number): string;

  export { hash, compare, genSalt, hashSync, compareSync, genSaltSync };
}
