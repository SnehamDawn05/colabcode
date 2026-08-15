// Allow importing CSS files from node_modules (e.g. xterm)
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
