// 推荐使用.eslintrc.js后缀的配置文件
module.exports = {
  root: true,
  parserOptions: { tsconfigRootDir: __dirname },
  overrides: [
    {
      files: ["*.js", "*.jsx"],
      extends: "@byted/eslint-config-standard",
    },
    {
      files: ["*.ts", "*.tsx"],
      extends: "@byted/eslint-config-standard-ts",
    },
    {
      files: ["*"],
      rules: {
        "no-autofix/@typescript-eslint/no-unnecessary-condition": "off",
        "no-autofix/@typescript-eslint/no-unnecessary-boolean-literal-compare":
          "off",
        "no-autofix/react/jsx-no-leaked-render": "off",
      },
    },
  ],
};
