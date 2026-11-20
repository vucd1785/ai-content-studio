/** Remotion (webpack) và Vite trả URL của file font khi import. */
declare module "*.ttf" {
  const src: string;
  export default src;
}
