// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Skrip uji sekali pakai (_uji_*.mjs) dijalankan langsung oleh Node, bukan
    // dibundel ke dalam aplikasi, jadi mereka boleh memakai global Node.
    // Tanpa pengecualian ini `npx expo lint` gagal pada Buffer.
    files: ["_uji_*.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
  },
]);
