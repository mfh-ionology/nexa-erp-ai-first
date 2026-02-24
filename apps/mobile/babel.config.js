module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
    env: {
      test: {
        // Transform dynamic import() to require() in Jest (VM doesn't support import())
        plugins: ['@babel/plugin-transform-dynamic-import'],
      },
    },
  };
};
