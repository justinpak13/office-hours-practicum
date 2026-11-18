module.exports = {
  extends: ["plugin:react/recommended", "plugin:react-hooks/recommended"],
  rules: { "react/react-in-jsx-scope": "off" },
  globals: { React: "writable" },
  plugins: ["cypress"],
  overrides: [
    {
      // shadcn/ui components: props are typed with TypeScript through
      // forwardRef, which this rule can't see
      files: ["components/ui/**/*.tsx"],
      rules: {
        "react/prop-types": "off",
      },
    },
  ],
};
