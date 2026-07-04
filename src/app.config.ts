export default defineAppConfig({
  pages: [
    'pages/splash/index',
    'pages/home/index',
    'pages/products/index',
    'pages/xiaohongshu/index',
    'pages/douyin/index',
    'pages/contact/index',
    'pages/project-detail/index',
    'pages/material-card-detail/index',
    'pages/category-projects/index',
    'pages/more-services/index'
  ],
  lazyCodeLoading: 'requiredComponents',
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#000000',
    navigationBarTitleText: '南嘉婚礼策划工作室',
    navigationBarTextStyle: 'white'
  }
})
