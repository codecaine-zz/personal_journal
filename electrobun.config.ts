export default {
  app: {
    name: "Personal Journal",
    identifier: "personal.journal.app",
    version: "0.0.1",
  },
  build: {
    bun: {
      entrypoint: "src/index.ts",
      minify: true,
    },
    views: {
      main: {
        entrypoint: "src/renderer/index.html",
        minify: true,
      },
    },
  },
};
