import React, { useState } from 'react'

export default function SitePlan() {
  console.log('🗺️ SitePlan component rendered')
  const [imageError, setImageError] = useState(false)
  const [zoom, setZoom] = useState(1)

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5))
  const handleResetZoom = () => setZoom(1)

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Plan du Site</h1>
          
          {/* Contrôles de zoom */}
          <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-2">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-gray-600 rounded transition-colors"
              title="Zoom arrière"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            
            <span className="text-white font-medium min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-gray-600 rounded transition-colors"
              title="Zoom avant"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
            
            <button
              onClick={handleResetZoom}
              className="p-2 hover:bg-gray-600 rounded transition-colors ml-2"
              title="Réinitialiser"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Zone d'affichage du plan */}
      <div className="flex-1 overflow-auto p-6 bg-gray-900">
        <div className="flex items-center justify-center min-h-full">
          {!imageError ? (
            <div 
              className="transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            >
              <img
                src="/plan-site.jpg"
                alt="Plan du site Semmaris"
                className="max-w-full h-auto shadow-2xl rounded-lg"
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div className="text-center p-12 bg-gray-800 rounded-xl border-2 border-dashed border-gray-600">
              <svg className="w-24 h-24 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-bold text-white mb-2">Plan du site non disponible</h3>
              <p className="text-gray-400 mb-4">
                Veuillez placer l'image du plan dans le dossier <code className="bg-gray-700 px-2 py-1 rounded text-sm">/frontend/public/plan-site.jpg</code>
              </p>
              <div className="text-sm text-gray-500">
                <p>Formats supportés: PNG, JPG, SVG</p>
                <p>Taille recommandée: 1920x1080px ou supérieure</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions en bas */}
      {!imageError && (
        <div className="bg-gray-800 border-t border-gray-700 p-3 text-center text-sm text-gray-400">
          Utilisez la molette de la souris ou les boutons de zoom pour naviguer dans le plan
        </div>
      )}
    </div>
  )
}
