// Primeiro de tudo: descobre se é a primeira vez (antes de qualquer coisa salvar)
import './shared/firstRun.js'
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
// Tema em tudo (janelas soltas, listas suspensas) + nome de emojis/cores
import './shared/themeFixes.css'
// Celular: janelas compactas (retrato e paisagem) — sempre por último
import './mobile.css'
import { installNanquimInline } from './shared/nanquimInline.js'
installNanquimInline()
import { LanguageProvider } from './atualizacao2_0/UpIdioma.jsx'
import Splash from './shared/Splash.jsx'
import Onboarding from './shared/Onboarding.jsx'
import { startUpdateWatch } from './shared/updater.js'
import { installTouch } from './shared/touch.js'
installTouch()
import { installSwatchHints } from './shared/swatchHints.js'
installSwatchHints()
startUpdateWatch()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <ModeRoot />
      <Splash />
      <Onboarding />
    </LanguageProvider>
  </StrictMode>,
)