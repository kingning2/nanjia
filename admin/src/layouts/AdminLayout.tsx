import { AppstoreOutlined, CloudSyncOutlined, SettingOutlined } from '@ant-design/icons'

import { ProLayout } from '@ant-design/pro-components'

import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import AppLogo from '../components/AppLogo'

import EnvToolbar from '../components/EnvToolbar'

import WindowTitleBar from '../components/WindowTitleBar'

import { ActiveEnvProvider, useActiveEnv } from '../context/ActiveEnvContext'



const menuRoutes = [

  {

    path: '/categories',

    name: '分类管理',

    icon: <AppstoreOutlined />

  },

  {

    path: '/home-settings',

    name: '系统设置',

    icon: <SettingOutlined />

  },

  {

    path: '/sync-center',

    name: '内容同步',

    icon: <CloudSyncOutlined />

  }

]



export default function AdminLayout() {

  return (

    <ActiveEnvProvider>

      <AdminLayoutShell />

    </ActiveEnvProvider>

  )

}



function AdminLayoutShell() {

  const location = useLocation()

  const navigate = useNavigate()

  const { activeEnv } = useActiveEnv()



  const selectedKey = location.pathname.startsWith('/sync-center')

    ? '/sync-center'

    : location.pathname.startsWith('/home-settings')

      ? '/home-settings'

      : location.pathname.startsWith('/categories')

        ? '/categories'

        : location.pathname



  return (

    <div className='app-shell'>

      <WindowTitleBar />

      <EnvToolbar />

      <div className='app-shell-body'>

        <ProLayout

          title='南嘉管理后台'

          logo={<AppLogo size={28} />}

          layout='mix'

          fixSiderbar

          headerRender={false}

          style={{ height: '100%' }}

          location={{ pathname: selectedKey }}

          route={{

            path: '/',

            routes: menuRoutes

          }}

          menuItemRender={(item, dom) => (

            <span

              onClick={() => {

                if (item.path) navigate(item.path)

              }}

              style={{ cursor: 'pointer' }}

            >

              {dom}

            </span>

          )}

          contentStyle={{ padding: 0 }}

        >

          {/* key 随环境变化，强制各内容页重新挂载并从新环境云库拉数据 */}

          <Outlet key={activeEnv?.id ?? 'no-env'} />

        </ProLayout>

      </div>

    </div>

  )

}


