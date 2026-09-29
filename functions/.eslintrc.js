// Regras de análise estática das Cloud Functions.
// São independentes das convenções do JavaScript executado no navegador.
module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  // Lê os projetos TypeScript para validar os arquivos de servidor.
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignora a saída compilada: o código-fonte fica em src.
    "/generated/**/*", // Ignora arquivos produzidos por outras ferramentas.
  ],
  plugins: ["@typescript-eslint", "import"],
  // Mantém as convenções já adotadas pelo backend: aspas duplas e dois espaços.
  rules: {
    quotes: ["error", "double"],
    "import/no-unresolved": 0,
    indent: ["error", 2],
  },
};
