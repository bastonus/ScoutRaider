import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import RouterRoot from './RouterRoot'
import './index.css'
import 'leaflet/dist/leaflet.css'

import { AppProvider } from './AppContext'
import { AuthProvider } from './AuthContext'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProvider>
      <AuthProvider>
        <HashRouter>
          <RouterRoot />
        </HashRouter>
      </AuthProvider>
    </AppProvider>
  </React.StrictMode>,
)
