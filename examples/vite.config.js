export default {
  root: 'examples',
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./example.scss";`
      }
    }
  }
};
