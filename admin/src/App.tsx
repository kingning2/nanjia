import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { App as AntdApp } from 'antd'
import FeedbackSetup from './components/FeedbackSetup'
import AdminLayout from './layouts/AdminLayout'
import CategoriesPage from './pages/categories'
import CategoryNewPage from './pages/categories/new'
import CategoryEditPage from './pages/categories/edit'
import MaterialCardsPage from './pages/material-cards'
import MaterialCardNewPage from './pages/material-cards/new'
import MaterialCardEditPage from './pages/material-cards/edit'
import MaterialDetailsPage from './pages/material-details'
import MaterialDetailNewPage from './pages/material-details/new'
import MaterialDetailEditPage from './pages/material-details/edit'
import HomeSettingsPage from './pages/home-settings'
import ProjectsPage from './pages/projects'
import ProjectNewPage from './pages/projects/new'
import ProjectEditPage from './pages/projects/edit'
import SyncCenterPage from './pages/sync-center'
import './App.css'

function App() {
  return (
    <AntdApp>
      <FeedbackSetup>
        <BrowserRouter>
        <Routes>
          <Route path='/' element={<AdminLayout />}>
            <Route index element={<Navigate to='/categories' replace />} />
            <Route path='categories' element={<CategoriesPage />} />
            <Route path='categories/new' element={<CategoryNewPage />} />
            <Route path='categories/:categoryId/edit' element={<CategoryEditPage />} />
            <Route path='home-settings' element={<HomeSettingsPage />} />
            <Route path='sync-center' element={<SyncCenterPage />} />
            <Route path='categories/:categoryId/projects' element={<ProjectsPage />} />
            <Route
              path='categories/:categoryId/projects/new'
              element={<ProjectNewPage />}
            />
            <Route
              path='categories/:categoryId/projects/:projectId/edit'
              element={<ProjectEditPage />}
            />
            <Route
              path='categories/:categoryId/projects/:projectId/cards'
              element={<MaterialCardsPage />}
            />
            <Route
              path='categories/:categoryId/projects/:projectId/cards/new'
              element={<MaterialCardNewPage />}
            />
            <Route
              path='categories/:categoryId/projects/:projectId/cards/:cardId/edit'
              element={<MaterialCardEditPage />}
            />
            <Route
              path='categories/:categoryId/projects/:projectId/cards/:cardId/details'
              element={<MaterialDetailsPage />}
            />
            <Route
              path='categories/:categoryId/projects/:projectId/cards/:cardId/details/new'
              element={<MaterialDetailNewPage />}
            />
            <Route
              path='categories/:categoryId/projects/:projectId/cards/:cardId/details/:detailId/edit'
              element={<MaterialDetailEditPage />}
            />
          </Route>
        </Routes>
        </BrowserRouter>
      </FeedbackSetup>
    </AntdApp>
  )
}

export default App
