import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import RouterRoot from './RouterRoot'
import './index.css'
import 'leaflet/dist/leaflet.css'

import { AppProvider } from './AppContext'
import { AuthProvider } from './AuthContext'
import ErrorBoundary from './components/common/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="L'application a rencontré une erreur inattendue">
      <AppProvider>
        <AuthProvider>
          <HashRouter>
            <RouterRoot />
          </HashRouter>
        </AuthProvider>
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
