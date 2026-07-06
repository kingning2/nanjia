/** 将 cf-shared 复制进各云函数目录，供「云端安装依赖」时 file:./cf-shared 可解析 */
const fs = require('fs')
const path = require('path')

const root = __dirname
const src = path.join(root, 'cf-shared')
const functions = ['portfolioHome', 'contactConfig', 'socialConfig', 'projectDetail', 'materialCardDetail', 'productCatalog']
const skip = new Set(['node_modules', 'package-lock.json'])

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const name of fs.readdirSync(from)) {
    if (skip.has(name)) continue
    const s = path.join(from, name)
    const d = path.join(to, name)
    if (fs.statSync(s).isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

for (const fn of functions) {
  const dest = path.join(root, 'functions', fn, 'cf-shared')
  fs.rmSync(dest, { recursive: true, force: true })
  copyDir(src, dest)
  console.log(`[bundle-cf-shared] ${fn}/cf-shared`)
}
