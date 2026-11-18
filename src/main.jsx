import { installGlobalUndo } from './atualizacao2_0/GlobalUndo.js'
installGlobalUndo()
import { installDialogKeys } from './shared/Dialog.jsx'
installDialogKeys()
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ModeRoot from './modes/ModeRoot.jsx'
// Camada responsiva: carregada depois de todo o CSS do app
import './Responsive.css'
// Visual Nanquim (padrão): cores traduzidas + papel, tipografia e formas
import './shared/nanquim.generated.css'
import './shared/nanquim.css'
// Árvore e Neurônios seguindo o tema (Nanquim ou Gameficado)
import './shared/modeThemes.css'
import { installNanquimInline } from './shared/nanquimInline.js'
installNanquimInline()
import { LanguageProvider } from './atualizacao2_0/UpIdioma.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <ModeRoot />
    </LanguageProvider>
  </StrictMode>,
)