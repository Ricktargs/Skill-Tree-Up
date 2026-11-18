import { installGlobalUndo } from './atualizacao2_0/GlobalUndo.js'
installGlobalUndo()
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ModeRoot from './modes/ModeRoot.jsx'
// Camada responsiva: carregada depois de todo o CSS do app
import './Responsive.css'
import { LanguageProvider } from './atualizacao2_0/UpIdioma.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <ModeRoot />
    </LanguageProvider>
  </StrictMode>,
)