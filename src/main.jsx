import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Platform from './Platform'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/adboard" element={<Platform />} />
        <Route path="/" element={<Navigate to="/adboard" replace />} />
        <Route path="*" element={<Navigate to="/adboard" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
