module.exports = {
  presets: [
    ['taro', { framework: 'react', ts: true }]
  ],
  plugins: [
    [
      'import',
      {
        libraryName: '@nutui/nutui-react-taro',
        libraryDirectory: 'dist/es/packages',
        style: false,
        camel2DashComponentName: false,
        customName: (name) =>
          `@nutui/nutui-react-taro/dist/es/packages/${name.toLowerCase()}`
      },
      'nutui-react-taro'
    ]
  ]
}
